"""Human review flow management."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import event_bus
from app.core.models import Task
from app.core.schemas import SSEEvent

logger = logging.getLogger(__name__)


class HumanReviewManager:
    """Manages the human-in-the-loop review process.

    When a task requires human review, this manager:
    1. Sets the task status to 'review'
    2. Broadcasts a 'review_required' event via SSE
    3. Waits for user action (approve/reject/modify) via WebSocket
    4. Processes the user's decision
    """

    def __init__(self, db_session_factory) -> None:
        self._db_factory = db_session_factory
        # Map of task_id -> asyncio.Event (for waiting on review)
        self._review_events: dict[str, asyncio.Event] = {}
        # Map of task_id -> user action
        self._review_results: dict[str, dict] = {}

    async def request_review(self, task: Task) -> None:
        """Mark a task as requiring human review and notify the frontend."""
        task.status = "review"
        task_id = str(task.id)

        # Create an event to wait on
        self._review_events[task_id] = asyncio.Event()

        # Broadcast review request
        await event_bus.broadcast(
            SSEEvent(
                type="review_required",
                project_id=task.project_id,
                task_id=task.id,
                agent_name=task.assigned_agent,
                content=f"需要审核: {task.title}",
                data={
                    "task_title": task.title,
                    "output_preview": str(task.output_data)[:500],
                },
            )
        )

        logger.info(f"Review requested for task {task_id}: {task.title}")

    async def wait_for_review(
        self, task_id: str, timeout: float = 3600.0
    ) -> dict | None:
        """Wait for user to review a task.

        Args:
            task_id: The task ID to wait for.
            timeout: Maximum wait time in seconds (default: 1 hour).

        Returns:
            The user's review action dict, or None if timeout.
        """
        event = self._review_events.get(task_id)
        if event is None:
            return None

        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return self._review_results.pop(task_id, None)
        except asyncio.TimeoutError:
            logger.warning(f"Review timeout for task {task_id}")
            return {"action": "timeout"}

    async def submit_review(
        self,
        task_id: str,
        action: str,
        feedback: str = "",
        modified_content: str = "",
    ) -> bool:
        """Process a user's review action.

        Args:
            task_id: The task being reviewed.
            action: One of 'approved', 'rejected', 'modified'.
            feedback: Optional feedback text.
            modified_content: Optional modified output content.

        Returns:
            True if the review was processed successfully.
        """
        async with self._db_factory() as session:
            task = await session.get(Task, task_id)
            if not task or task.status != "review":
                logger.warning(
                    f"Cannot review task {task_id}: status is {task.status if task else 'not found'}"
                )
                return False

            task.human_feedback = feedback

            if action == "approved":
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
            elif action == "rejected":
                task.status = "claimed"  # Send back for re-execution
            elif action == "modified":
                task.status = "claimed"
                if modified_content:
                    task.input_data["modified_output"] = modified_content
            else:
                logger.warning(f"Unknown review action: {action}")
                return False

            await session.commit()

        # Signal the waiting coroutine
        result = {
            "action": action,
            "feedback": feedback,
            "modified_content": modified_content,
        }
        self._review_results[task_id] = result
        event = self._review_events.get(task_id)
        if event:
            event.set()

        # Broadcast review result
        async with self._db_factory() as session:
            task = await session.get(Task, task_id)
            if task:
                await event_bus.broadcast(
                    SSEEvent(
                        type=f"task_{action}",
                        project_id=task.project_id,
                        task_id=task.id,
                        agent_name=task.assigned_agent,
                        content=f"审核结果: {action} - {task.title}",
                        data=result,
                    )
                )

        logger.info(f"Review processed for task {task_id}: {action}")
        return True

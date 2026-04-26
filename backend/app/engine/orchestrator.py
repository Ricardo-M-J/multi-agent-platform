"""Orchestrator: high-level interface for managing multi-agent workflows."""

import logging
from typing import Any

from app.core.database import async_session_factory
from app.engine.human_review import HumanReviewManager
from app.engine.task_engine import task_engine

logger = logging.getLogger(__name__)

# Global review manager instance
review_manager = HumanReviewManager(async_session_factory)


async def start_engine() -> None:
    """Start the task engine and all agent workers."""
    await task_engine.start()
    logger.info("Orchestrator started")


async def stop_engine() -> None:
    """Stop the task engine and all agent workers."""
    await task_engine.stop()
    logger.info("Orchestrator stopped")


async def submit_user_task(
    project_id: str,
    title: str,
    description: str = "",
    input_data: dict | None = None,
) -> dict:
    """Submit a task from the user to the multi-agent system.

    This is the main entry point for user interactions.
    The task will be assigned to the Manager Agent for decomposition.

    Args:
        project_id: The project ID.
        title: Task title/description from user.
        description: Optional detailed description.
        input_data: Optional structured input data.

    Returns:
        Dict with the created task info.
    """
    task = await task_engine.submit_task(
        project_id=project_id,
        title=title,
        description=description,
        input_data=input_data,
    )
    return {
        "task_id": str(task.id),
        "title": task.title,
        "status": task.status,
        "assigned_agent": task.assigned_agent,
    }


async def get_engine_status() -> dict:
    """Get the current status of the task engine."""
    return {
        "running": task_engine._running,
        "registered_agents": task_engine.get_registered_agents(),
    }

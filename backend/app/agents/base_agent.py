"""Base class for database-driven agents.

Implements the core polling loop: poll DB → claim task → build context → execute → write result.
"""

import asyncio
import json
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.events import event_bus
from app.core.models import AgentState, Artifact, Task
from app.core.schemas import SSEEvent
from app.engine.state_machine import TaskStateMachine
from app.memory.context_builder import ContextBuilder

logger = logging.getLogger(__name__)

# Load agent role definitions
_AGENTS_CONFIG_PATH = (
    __import__("pathlib").Path(__file__).resolve().parent.parent / "config" / "agents_config.yaml"
)
with open(_AGENTS_CONFIG_PATH, "r", encoding="utf-8") as f:
    _agents_config = yaml.safe_load(f)


class BaseDatabaseAgent(ABC):
    """Abstract base class for database-driven agents.

    Each agent polls the database for tasks assigned to it,
    builds context from the shared database, executes the task,
    and writes results back to the database.
    """

    def __init__(
        self,
        agent_name: str,
        db_session_factory,
    ) -> None:
        """
        Args:
            agent_name: The identifier for this agent (must match agents_config.yaml).
            db_session_factory: SQLAlchemy async session factory.
        """
        self.agent_name = agent_name
        self._db_factory = db_session_factory
        self._state_machine = TaskStateMachine()
        self._running = False
        self._poll_interval = settings.agent_poll_interval

        # Load role definition from config
        agent_cfg = _agents_config.get("agents", {}).get(agent_name, {})
        self.role = agent_cfg.get("role", agent_name)
        self.goal = agent_cfg.get("goal", "")
        self.backstory = agent_cfg.get("backstory", "")
        self.role_definition = (
            f"**角色**: {self.role}\n**目标**: {self.goal}\n**背景**: {self.backstory}"
        )

    async def start(self) -> None:
        """Start the agent's polling loop."""
        self._running = True
        logger.info(f"Agent '{self.agent_name}' started")
        while self._running:
            try:
                await self._poll_and_execute()
            except Exception as e:
                logger.error(f"Agent '{self.agent_name}' error: {e}", exc_info=True)
            await asyncio.sleep(self._poll_interval)

    async def stop(self) -> None:
        """Stop the agent's polling loop."""
        self._running = False
        logger.info(f"Agent '{self.agent_name}' stopped")

    async def _poll_and_execute(self) -> None:
        """Poll database for claimed tasks and execute them."""
        async with self._db_factory() as session:
            # Find the next claimed task assigned to this agent
            result = await session.execute(
                select(Task)
                .where(
                    Task.assigned_agent == self.agent_name,
                    Task.status == "claimed",
                )
                .order_by(Task.priority.desc(), Task.created_at.asc())
                .limit(1)
            )
            task = result.scalar_one_or_none()

            if task is None:
                return

            await self._execute_task(session, task)

    async def _execute_task(self, session: AsyncSession, task: Task) -> None:
        """Execute a single task: update status, build context, run, write result."""
        task_id = str(task.id)
        project_id = str(task.project_id)

        # Transition: claimed -> in_progress
        self._state_machine.transition(task.status, "in_progress", task_id)
        task.status = "in_progress"
        task.started_at = datetime.now(timezone.utc)
        await session.flush()

        # Update agent state
        await self._update_agent_state(session, project_id, task.id, "executing")

        # Broadcast start event
        await event_bus.broadcast(
            SSEEvent(
                type="agent_output",
                project_id=task.project_id,
                task_id=task.id,
                agent_name=self.agent_name,
                content=f"开始执行任务: {task.title}",
                data={"status": "in_progress"},
            )
        )

        try:
            # Build context from database
            context_builder = ContextBuilder(session, project_id)
            context = await context_builder.build_agent_context(
                self.agent_name, task, self.role_definition
            )

            # Broadcast thinking event
            await self._update_agent_state(session, project_id, task.id, "thinking")
            await event_bus.broadcast(
                SSEEvent(
                    type="agent_thinking",
                    project_id=task.project_id,
                    task_id=task.id,
                    agent_name=self.agent_name,
                    content="正在分析任务和构建上下文...",
                )
            )

            # Execute the task (subclass implements this)
            result = await self.execute(task, context)

            # Write result back to database
            if isinstance(result, str):
                task.output_data = {"content": result}
            elif isinstance(result, dict):
                task.output_data = result
            else:
                task.output_data = {"content": str(result)}

            # Save as artifact
            artifact = Artifact(
                project_id=task.project_id,
                task_id=task.id,
                agent_name=self.agent_name,
                artifact_type=self._get_artifact_type(),
                title=task.title,
                content=json.dumps(task.output_data, ensure_ascii=False),
            )
            session.add(artifact)

            # Determine next status
            if task.requires_human_review:
                new_status = "review"
            else:
                new_status = "completed"
                task.completed_at = datetime.now(timezone.utc)

            self._state_machine.transition("in_progress", new_status, task_id)
            task.status = new_status
            await session.flush()

            # Update agent state
            await self._update_agent_state(session, project_id, None, "idle")

            # Broadcast completion event
            await event_bus.broadcast(
                SSEEvent(
                    type="agent_output",
                    project_id=task.project_id,
                    task_id=task.id,
                    agent_name=self.agent_name,
                    content=f"任务完成: {task.title}",
                    data={
                        "status": new_status,
                        "output_preview": str(task.output_data)[:200],
                    },
                )
            )

            logger.info(
                f"Agent '{self.agent_name}' completed task '{task.title}' -> {new_status}"
            )

        except Exception as e:
            logger.error(
                f"Agent '{self.agent_name}' failed task '{task.title}': {e}",
                exc_info=True,
            )
            task.status = "failed"
            task.error_message = str(e)
            await session.flush()

            await self._update_agent_state(session, project_id, None, "error")

            await event_bus.broadcast(
                SSEEvent(
                    type="error",
                    project_id=task.project_id,
                    task_id=task.id,
                    agent_name=self.agent_name,
                    content=f"任务执行失败: {str(e)}",
                    data={"error": str(e)},
                )
            )

    @abstractmethod
    async def execute(self, task: Task, context: str) -> str | dict:
        """Execute the task. Must be implemented by subclasses.

        Args:
            task: The task to execute.
            context: The assembled execution context.

        Returns:
            The task result as a string or structured dict.
        """
        ...

    def _get_artifact_type(self) -> str:
        """Get the default artifact type for this agent."""
        return "text"

    async def _update_agent_state(
        self,
        session: AsyncSession,
        project_id: str,
        current_task_id: uuid.UUID | None,
        status: str,
        thought_process: str | None = None,
    ) -> None:
        """Update or create the agent's state record."""
        result = await session.execute(
            select(AgentState).where(
                AgentState.project_id == project_id,
                AgentState.agent_name == self.agent_name,
            )
        )
        state = result.scalar_one_or_none()

        if state is None:
            state = AgentState(
                project_id=project_id,
                agent_name=self.agent_name,
            )
            session.add(state)

        state.current_task_id = current_task_id
        state.status = status
        state.thought_process = thought_process
        state.last_heartbeat = datetime.now(timezone.utc)
        await session.flush()

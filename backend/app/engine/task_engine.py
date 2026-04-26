"""Task engine: orchestrates agent lifecycle and task execution."""

import asyncio
import logging
from typing import Any

from app.agents.base_agent import BaseDatabaseAgent
from app.agents.manager_agent import ManagerAgent
from app.agents.researcher_agent import ResearcherAgent
from app.agents.reviewer_agent import ReviewerAgent
from app.agents.writer_agent import WriterAgent
from app.config.settings import settings
from app.core.database import async_session_factory
from app.core.events import event_bus
from app.core.models import Project, Task
from app.core.schemas import SSEEvent

logger = logging.getLogger(__name__)


class TaskEngine:
    """Orchestrates the lifecycle of all agents and manages task execution.

    The engine starts agent worker loops and provides methods to
    submit tasks, control execution, and monitor progress.
    """

    def __init__(self) -> None:
        self._agents: dict[str, BaseDatabaseAgent] = {}
        self._agent_tasks: dict[str, asyncio.Task] = {}
        self._running = False

    def register_agent(self, agent: BaseDatabaseAgent) -> None:
        """Register an agent with the engine."""
        self._agents[agent.agent_name] = agent
        logger.info(f"Registered agent: {agent.agent_name}")

    async def start(self) -> None:
        """Start all registered agents."""
        if self._running:
            logger.warning("Task engine is already running")
            return

        self._running = True

        # Register default agents
        self.register_agent(ManagerAgent(async_session_factory))
        self.register_agent(ResearcherAgent(async_session_factory))
        self.register_agent(WriterAgent(async_session_factory))
        self.register_agent(ReviewerAgent(async_session_factory))

        # Start agent worker loops
        for name, agent in self._agents.items():
            task = asyncio.create_task(agent.start(), name=f"agent-{name}")
            self._agent_tasks[name] = task
            logger.info(f"Started agent worker: {name}")

        logger.info(f"Task engine started with {len(self._agents)} agents")

    async def stop(self) -> None:
        """Stop all agents gracefully."""
        self._running = False

        for name, agent in self._agents.items():
            await agent.stop()
            task = self._agent_tasks.get(name)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        self._agent_tasks.clear()
        logger.info("Task engine stopped")

    async def submit_task(
        self,
        project_id: str,
        title: str,
        description: str = "",
        input_data: dict | None = None,
    ) -> Task:
        """Submit a new top-level task to the project.

        The task is assigned to the Manager Agent, which will decompose
        it into subtasks for other agents.

        Args:
            project_id: The project to submit the task to.
            title: Task title.
            description: Task description.
            input_data: Optional structured input data.

        Returns:
            The created Task object.
        """
        async with async_session_factory() as session:
            # Update project status to running
            project = await session.get(Project, project_id)
            if project:
                project.status = "running"

            # Create the top-level task, assigned to manager
            task = Task(
                project_id=project_id,
                title=title,
                description=description,
                assigned_agent="manager",
                priority=10,
                input_data=input_data or {},
                status="claimed",  # Auto-claim for manager
            )
            session.add(task)
            await session.flush()
            await session.refresh(task)

            # Broadcast event
            await event_bus.broadcast(
                SSEEvent(
                    type="task_created",
                    project_id=task.project_id,
                    task_id=task.id,
                    agent_name="manager",
                    content=f"任务已提交: {title}",
                    data={"title": title},
                )
            )

            logger.info(f"Task submitted to project {project_id}: {title}")
            return task

    async def pause_project(self, project_id: str) -> None:
        """Pause all tasks in a project."""
        async with async_session_factory() as session:
            from sqlalchemy import update

            await session.execute(
                update(Task)
                .where(
                    Task.project_id == project_id,
                    Task.status.in_(["pending", "claimed"]),
                )
                .values(status="pending")  # Reset to pending so agents won't pick up
            )

            project = await session.get(Project, project_id)
            if project:
                project.status = "paused"

            await session.commit()

    async def resume_project(self, project_id: str) -> None:
        """Resume a paused project by re-claiming pending tasks."""
        async with async_session_factory() as session:
            from sqlalchemy import update

            await session.execute(
                update(Task)
                .where(
                    Task.project_id == project_id,
                    Task.status == "pending",
                    Task.assigned_agent.isnot(None),
                )
                .values(status="claimed")
            )

            project = await session.get(Project, project_id)
            if project:
                project.status = "running"

            await session.commit()

    def get_registered_agents(self) -> list[str]:
        """Get list of registered agent names."""
        return list(self._agents.keys())


# Global task engine instance
task_engine = TaskEngine()

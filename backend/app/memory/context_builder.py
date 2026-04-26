"""Context builder for assembling agent execution context from database."""

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Artifact, EventLog, Task

logger = logging.getLogger(__name__)


class ContextBuilder:
    """Builds execution context for agents from the three-layer memory architecture.

    L1: Structured memory (project config, agent role definitions)
    L2: Scenario memory (task summaries, agent outputs, dependencies)
    L3: Conversation memory (event logs, thought processes)
    """

    def __init__(self, db: AsyncSession, project_id: str) -> None:
        self.db = db
        self.project_id = project_id

    async def build_agent_context(
        self,
        agent_name: str,
        task: Task,
        role_definition: str,
        max_recent_events: int = 20,
    ) -> str:
        """Build the full execution context for an agent.

        Args:
            agent_name: Name of the agent executing the task.
            task: The current task to execute.
            role_definition: The agent's role/goal/backstory definition.
            max_recent_events: Maximum number of recent events to include.

        Returns:
            A formatted string containing all context layers.
        """
        # L1: Role definition (already provided)
        l1_context = f"## 你的角色\n{role_definition}\n"

        # L2: Project context and completed work
        l2_context = await self._build_scenario_context(agent_name, task)

        # L3: Recent events
        l3_context = await self._build_conversation_context(
            agent_name, max_recent_events
        )

        # Current task details
        task_context = f"""
## 你当前的任务
标题: {task.title}
描述: {task.description or '无'}

## 输入数据
{json.dumps(task.input_data, ensure_ascii=False, indent=2) if task.input_data else '无'}

## 人类反馈
{task.human_feedback or '无'}
"""

        return f"{l1_context}\n{l2_context}\n{task_context}\n{l3_context}"

    async def _build_scenario_context(self, agent_name: str, task: Task) -> str:
        """Build L2 scenario context: completed tasks, artifacts, dependencies."""
        sections = []

        # Project goal
        sections.append(f"## 项目背景\n目标: {task.title}")

        # Completed tasks summary
        result = await self.db.execute(
            select(Task)
            .where(
                Task.project_id == task.project_id,
                Task.status == "completed",
                Task.id != task.id,
            )
            .order_by(Task.completed_at.asc())
        )
        completed_tasks = result.scalars().all()

        if completed_tasks:
            task_summaries = []
            for t in completed_tasks:
                summary = f"- [{t.assigned_agent}] {t.title}"
                if t.output_data:
                    # Include a brief summary of the output
                    output_preview = self._truncate_output(t.output_data)
                    summary += f"\n  产出摘要: {output_preview}"
                task_summaries.append(summary)
            sections.append(
                "## 已完成的工作\n" + "\n".join(task_summaries)
            )

        # Relevant artifacts
        result = await self.db.execute(
            select(Artifact)
            .where(Artifact.project_id == task.project_id)
            .order_by(Artifact.created_at.desc())
            .limit(10)
        )
        artifacts = result.scalars().all()

        if artifacts:
            artifact_list = []
            for a in artifacts:
                artifact_list.append(
                    f"- [{a.artifact_type}] {a.title or '未命名'} "
                    f"(by {a.agent_name}, v{a.version})"
                )
            sections.append(
                "## 相关产物\n" + "\n".join(artifact_list)
            )

        # Pending tasks (what's coming next)
        result = await self.db.execute(
            select(Task)
            .where(
                Task.project_id == task.project_id,
                Task.status.in_(["pending", "claimed"]),
                Task.id != task.id,
            )
            .order_by(Task.priority.desc(), Task.created_at.asc())
        )
        pending_tasks = result.scalars().all()

        if pending_tasks:
            pending_list = [f"- {t.title} (分配给: {t.assigned_agent or '未分配'})" for t in pending_tasks]
            sections.append(
                "## 待执行的任务\n" + "\n".join(pending_list)
            )

        return "\n\n".join(sections)

    async def _build_conversation_context(
        self, agent_name: str, max_events: int
    ) -> str:
        """Build L3 conversation context: recent event logs."""
        result = await self.db.execute(
            select(EventLog)
            .where(EventLog.project_id == self.project_id)
            .order_by(EventLog.created_at.desc())
            .limit(max_events)
        )
        events = list(reversed(result.scalars().all()))

        if not events:
            return "## 最近活动\n暂无活动记录"

        event_lines = []
        for e in events:
            timestamp = e.created_at.strftime("%H:%M:%S") if e.created_at else "??:??:??"
            agent_prefix = f"[{e.agent_name}] " if e.agent_name else ""
            line = f"- {timestamp} {agent_prefix}{e.event_type}: {e.content or ''}"
            event_lines.append(line)

        return "## 最近活动\n" + "\n".join(event_lines)

    @staticmethod
    def _truncate_output(output_data: dict, max_length: int = 200) -> str:
        """Create a brief preview of task output data."""
        text = json.dumps(output_data, ensure_ascii=False)
        if len(text) > max_length:
            return text[:max_length] + "..."
        return text

"""Manager Agent: receives user tasks and decomposes them into subtasks."""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)


class ManagerAgent(BaseDatabaseAgent):
    """Manager Agent that decomposes high-level tasks into subtasks.

    When a user creates a top-level task assigned to the 'manager',
    this agent analyzes the task and creates subtasks in the database
    for other agents to pick up.
    """

    def __init__(self, db_session_factory) -> None:
        super().__init__("manager", db_session_factory)

    async def execute(self, task: Task, context: str, session) -> dict:
        """Decompose the task into subtasks and write them to the database."""
        logger.info(f"Manager decomposing task: {task.title}")

        # Get available agents from config (hot-reloaded)
        all_agents = self._config_reloader.get_all_agents()
        available_agents = list(all_agents.keys())
        agents_desc = "\n".join(
            f"- {name}: {cfg.get('role', '')} - {cfg.get('goal', '')}"
            for name, cfg in all_agents.items()
            if name != "manager"
        )

        # Get system prompt from config (hot-reloaded)
        system_prompt = self._get_system_prompt()

        # Build the decomposition prompt (use safe replacement to avoid
        # conflicts with JSON curly braces in the prompt template)
        prompt = system_prompt
        prompt = prompt.replace("{project_description}", task.description or task.title)
        prompt = prompt.replace("{task_description}", (task.input_data.get("content", task.title) if task.input_data else task.title))
        prompt = prompt.replace("{available_agents}", agents_desc)

        # Get LLM params from config
        params = self._get_llm_params()

        # Call LLM to decompose
        response = await call_llm(
            agent_role="manager",
            prompt=prompt,
            temperature=params.get("temperature", 0.3),
            max_tokens=params.get("max_tokens", 4096),
        )

        # Parse the JSON response
        response_text = str(response).strip()
        # Extract JSON from markdown code blocks if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            subtasks = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse manager response as JSON: {e}")
            logger.error(f"Raw response: {response_text}")
            return {
                "error": f"Failed to parse subtask JSON: {e}",
                "raw_response": response_text,
                "subtasks_created": 0,
            }

        # Create subtasks in the database (using the provided session)
        created_subtasks = []
        for i, subtask_def in enumerate(subtasks):
            if not isinstance(subtask_def, dict):
                continue

            # Resolve dependencies — all subtasks should reference the parent
            parent_id = task.id  # All subtasks are children of the original task

            subtask = Task(
                project_id=task.project_id,
                parent_task_id=parent_id,
                title=subtask_def.get("title", f"子任务 {i + 1}"),
                description=subtask_def.get("description", ""),
                assigned_agent=subtask_def.get("assigned_agent"),
                priority=subtask_def.get("priority", 0),
                input_data={
                    "project_description": (task.input_data or {}).get("project_description", ""),
                    "parent_task_title": task.title,
                    "parent_task_description": task.description or "",
                },
                requires_human_review=subtask_def.get(
                    "requires_human_review", False
                ),
                status="pending",  # Wait for user confirmation before agents pick up
            )
            session.add(subtask)
            created_subtasks.append(subtask.title)

        await session.flush()

        logger.info(
            f"Manager created {len(created_subtasks)} subtasks: {created_subtasks}"
        )

        return {
            "subtasks_created": len(created_subtasks),
            "subtask_titles": created_subtasks,
            "decomposition": subtasks,
        }

    def _get_artifact_type(self) -> str:
        return "plan"

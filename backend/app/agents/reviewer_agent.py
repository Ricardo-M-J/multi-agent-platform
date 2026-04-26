"""Reviewer Agent: evaluates and provides feedback on other agents' outputs."""

import json
import logging

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseDatabaseAgent):
    """Reviewer Agent that evaluates other agents' outputs."""

    def __init__(self, db_session_factory) -> None:
        super().__init__("reviewer", db_session_factory)

    async def execute(self, task: Task, context: str, session) -> dict:
        """Execute review task and return structured evaluation."""
        logger.info(f"Reviewer working on: {task.title}")

        # Get system prompt from config (hot-reloaded)
        system_prompt = self._get_system_prompt()
        prompt = system_prompt.replace("{context}", context)

        # Get LLM params from config
        params = self._get_llm_params()

        response = await call_llm(
            agent_role="reviewer",
            prompt=prompt,
            temperature=params.get("temperature", 0.3),
            max_tokens=params.get("max_tokens", 4096),
        )

        # Parse JSON response
        response_text = str(response).strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            result = {
                "overall_score": 0,
                "dimensions": {},
                "strengths": [],
                "issues": [],
                "suggestions": [],
                "approved": False,
                "raw_response": response_text,
            }

        return result

    def _get_artifact_type(self) -> str:
        return "review"

"""Researcher Agent: investigates topics and produces structured research results."""

import json
import logging

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)


class ResearcherAgent(BaseDatabaseAgent):
    """Researcher Agent that investigates topics and produces structured findings."""

    def __init__(self, db_session_factory) -> None:
        super().__init__("researcher", db_session_factory)

    async def execute(self, task: Task, context: str, session) -> dict:
        """Execute research task and return structured findings."""
        logger.info(f"Researcher working on: {task.title}")

        # Get system prompt from config (hot-reloaded)
        system_prompt = self._get_system_prompt()
        prompt = system_prompt.replace("{context}", context)

        # Get LLM params from config
        params = self._get_llm_params()

        response = await call_llm(
            agent_role="researcher",
            prompt=prompt,
            temperature=params.get("temperature", 0.5),
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
            # If parsing fails, wrap the raw text
            result = {
                "summary": response_text[:500],
                "key_findings": [],
                "data_sources": [],
                "recommendations": [],
                "gaps": [],
                "raw_response": response_text,
            }

        return result

    def _get_artifact_type(self) -> str:
        return "analysis"

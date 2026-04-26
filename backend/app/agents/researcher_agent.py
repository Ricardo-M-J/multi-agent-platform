"""Researcher Agent: investigates topics and produces structured research results."""

import json
import logging

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)

RESEARCHER_PROMPT = """你是一位严谨的研究员。请根据以下上下文和任务要求，进行深入调研分析。

{context}

## 输出要求
请以 JSON 格式输出你的研究结果，包含以下字段：
- summary: 研究摘要（200字以内）
- key_findings: 关键发现列表（每项包含 point 和 explanation）
- data_sources: 数据来源列表
- recommendations: 建议列表
- gaps: 研究空白或需要进一步调查的领域

请只输出 JSON，不要输出其他内容。"""


class ResearcherAgent(BaseDatabaseAgent):
    """Researcher Agent that investigates topics and produces structured findings."""

    def __init__(self, db_session_factory) -> None:
        super().__init__("researcher", db_session_factory)

    async def execute(self, task: Task, context: str, session) -> dict:
        """Execute research task and return structured findings."""
        logger.info(f"Researcher working on: {task.title}")

        prompt = RESEARCHER_PROMPT.format(context=context)

        response = await call_llm(
            agent_role="researcher",
            prompt=prompt,
            temperature=0.5,
            max_tokens=4096,
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

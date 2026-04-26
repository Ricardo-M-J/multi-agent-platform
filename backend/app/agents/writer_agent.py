"""Writer Agent: produces structured documents from research and analysis."""

import json
import logging

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)

WRITER_PROMPT = """你是一位专业的写作者。请根据以下上下文和任务要求，撰写结构化文档。

{context}

## 输出要求
请以 JSON 格式输出你的文档，包含以下字段：
- title: 文档标题
- document_type: 文档类型（report/article/summary/tutorial/review）
- sections: 章节列表（每项包含 heading 和 content）
- conclusion: 总结
- word_count: 大致字数

请只输出 JSON，不要输出其他内容。"""


class WriterAgent(BaseDatabaseAgent):
    """Writer Agent that produces structured documents."""

    def __init__(self, db_session_factory) -> None:
        super().__init__("writer", db_session_factory)

    async def execute(self, task: Task, context: str) -> dict:
        """Execute writing task and return structured document."""
        logger.info(f"Writer working on: {task.title}")

        prompt = WRITER_PROMPT.format(context=context)

        response = await call_llm(
            agent_role="writer",
            prompt=prompt,
            temperature=0.7,
            max_tokens=8192,
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
            # If parsing fails, wrap the raw text as a single-section document
            result = {
                "title": task.title,
                "document_type": "article",
                "sections": [{"heading": "内容", "content": response_text}],
                "conclusion": "",
                "raw_response": response_text,
            }

        return result

    def _get_artifact_type(self) -> str:
        return "document"

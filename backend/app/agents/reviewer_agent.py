"""Reviewer Agent: evaluates and provides feedback on other agents' outputs."""

import json
import logging

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)

REVIEWER_PROMPT = """你是一位严格的审核员。请根据以下上下文，审核评估相关产出。

{context}

## 审核维度
1. **准确性**: 内容是否准确，有无事实错误
2. **完整性**: 是否覆盖了所有必要的内容
3. **逻辑性**: 论述是否清晰、有条理
4. **可读性**: 语言是否清晰易懂
5. **实用性**: 对用户是否有实际价值

## 输出要求
请以 JSON 格式输出审核结果，包含以下字段：
- overall_score: 总体评分（1-10）
- dimensions: 各维度评分和评语（accuracy/completeness/logic/readability/usefulness）
- strengths: 优点列表
- issues: 问题列表（每项包含 description 和 severity）
- suggestions: 改进建议列表
- approved: 是否通过审核（布尔值）

请只输出 JSON，不要输出其他内容。"""


class ReviewerAgent(BaseDatabaseAgent):
    """Reviewer Agent that evaluates other agents' outputs."""

    def __init__(self, db_session_factory) -> None:
        super().__init__("reviewer", db_session_factory)

    async def execute(self, task: Task, context: str) -> dict:
        """Execute review task and return structured evaluation."""
        logger.info(f"Reviewer working on: {task.title}")

        prompt = REVIEWER_PROMPT.format(context=context)

        response = await call_llm(
            agent_role="reviewer",
            prompt=prompt,
            temperature=0.3,
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

"""Summary compression for managing context window size."""

import json
import logging

from app.llm.provider import call_llm

logger = logging.getLogger(__name__)


async def summarize_text(
    text: str,
    max_length: int = 500,
    agent_role: str = "writer",
) -> str:
    """Summarize a long text to fit within context window constraints.

    Args:
        text: The text to summarize.
        max_length: Target maximum length of the summary.
        agent_role: Agent role for model selection.

    Returns:
        A condensed summary of the text.
    """
    if len(text) <= max_length:
        return text

    prompt = f"""请将以下内容压缩为不超过{max_length}字的摘要，保留关键信息和数据点。
不要添加任何评论或解释，只输出摘要内容。

原始内容:
{text}"""

    try:
        summary = await call_llm(
            agent_role=agent_role,
            prompt=prompt,
            temperature=0.3,
            max_tokens=1024,
        )
        return str(summary)
    except Exception as e:
        logger.warning(f"Summarization failed, falling back to truncation: {e}")
        return text[:max_length] + "...[摘要生成失败，已截断]"


async def summarize_task_outputs(
    outputs: list[dict],
    max_total_length: int = 2000,
    agent_role: str = "writer",
) -> str:
    """Summarize multiple task outputs into a condensed overview.

    Args:
        outputs: List of task output dictionaries, each with 'title' and 'output_data'.
        max_total_length: Maximum total length of the combined summary.
        agent_role: Agent role for model selection.

    Returns:
        A condensed summary of all task outputs.
    """
    if not outputs:
        return ""

    total_length = sum(len(json.dumps(o, ensure_ascii=False)) for o in outputs)

    if total_length <= max_total_length:
        # No summarization needed
        lines = []
        for o in outputs:
            lines.append(f"### {o.get('title', '未命名')}\n{o.get('output_data', '')}")
        return "\n\n".join(lines)

    # Need to summarize: combine all outputs and summarize together
    combined = ""
    for o in outputs:
        combined += f"\n## {o.get('title', '未命名')}\n{json.dumps(o.get('output_data', {}), ensure_ascii=False)}\n"

    return await summarize_text(combined, max_total_length, agent_role)

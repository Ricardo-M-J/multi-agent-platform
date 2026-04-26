"""Manager Agent: receives user tasks and decomposes them into subtasks."""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base_agent import BaseDatabaseAgent
from app.core.models import Task
from app.llm.provider import call_llm

logger = logging.getLogger(__name__)

MANAGER_DECOMPOSE_PROMPT = """你是一个项目经理，需要将用户的高层任务拆分为可执行的子任务。

## 项目目标
{project_description}

## 用户任务
{task_description}

## 可用的 Agent 角色
{available_agents}

## 输出要求
请以 JSON 格式输出子任务列表，每个子任务包含：
- title: 子任务标题
- description: 子任务描述
- assigned_agent: 分配的 Agent 名称（从上面的可用角色中选择）
- priority: 优先级（数字越大越优先）
- depends_on: 依赖的子任务索引（从0开始，无依赖则为空列表）
- requires_human_review: 是否需要人工审核（布尔值）

请只输出 JSON 数组，不要输出其他内容。示例格式：
```json
[
  {{
    "title": "子任务标题",
    "description": "子任务描述",
    "assigned_agent": "researcher",
    "priority": 10,
    "depends_on": [],
    "requires_human_review": false
  }}
]
```"""


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

        # Get available agents from config
        from app.agents.base_agent import _agents_config
        available_agents = list(_agents_config.get("agents", {}).keys())
        agents_desc = "\n".join(
            f"- {name}: {cfg.get('role', '')} - {cfg.get('goal', '')}"
            for name, cfg in _agents_config.get("agents", {}).items()
            if name != "manager"
        )

        # Build the decomposition prompt
        prompt = MANAGER_DECOMPOSE_PROMPT.format(
            project_description=task.description or task.title,
            task_description=task.input_data.get("content", task.title)
            if task.input_data
            else task.title,
            available_agents=agents_desc,
        )

        # Call LLM to decompose
        response = await call_llm(
            agent_role="manager",
            prompt=prompt,
            temperature=0.3,
            max_tokens=4096,
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

            # Resolve dependencies
            depends_on = subtask_def.get("depends_on", [])
            parent_id = None
            if depends_on and i > 0:
                parent_id = task.id

            subtask = Task(
                project_id=task.project_id,
                parent_task_id=parent_id,
                title=subtask_def.get("title", f"子任务 {i + 1}"),
                description=subtask_def.get("description", ""),
                assigned_agent=subtask_def.get("assigned_agent"),
                priority=subtask_def.get("priority", 0),
                input_data=task.input_data,
                requires_human_review=subtask_def.get(
                    "requires_human_review", False
                ),
                status="claimed",
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

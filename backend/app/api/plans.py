"""Plan management API.

Allows users to edit the Manager's plan (pending subtasks) before confirming execution.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.models import Task
from app.core.schemas import SSEEvent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def get_plan(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get the current plan (all pending subtasks)."""
    result = await db.execute(
        select(Task)
        .where(
            Task.project_id == project_id,
            Task.status == "pending",
            Task.parent_task_id.isnot(None),
        )
        .order_by(Task.priority.desc(), Task.created_at.asc())
    )
    tasks = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "title": t.title,
            "description": t.description,
            "assigned_agent": t.assigned_agent,
            "priority": t.priority,
            "requires_human_review": t.requires_human_review,
            "parent_task_id": str(t.parent_task_id) if t.parent_task_id else None,
        }
        for t in tasks
    ]


@router.put("/tasks/{task_id}")
async def update_plan_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update a single task in the plan (change agent, description, etc.)."""
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Can only edit pending tasks")

    for field in ["title", "description", "assigned_agent", "priority", "requires_human_review"]:
        if field in body:
            setattr(task, field, body[field])

    await db.commit()
    await db.refresh(task)

    return {"message": "Task updated", "task_id": str(task_id)}


@router.delete("/tasks/{task_id}")
async def delete_plan_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a task from the plan."""
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Can only delete pending tasks")

    await db.delete(task)
    await db.commit()

    return {"message": "Task deleted", "task_id": str(task_id)}


@router.post("/tasks")
async def add_plan_task(
    project_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Add a new task to the plan."""
    # Find the parent task (the original top-level task)
    result = await db.execute(
        select(Task).where(
            Task.project_id == project_id,
            Task.parent_task_id.is_(None),
        )
    )
    parent = result.scalar_one_or_none()

    task = Task(
        project_id=project_id,
        parent_task_id=parent.id if parent else None,
        title=body.get("title", "新子任务"),
        description=body.get("description", ""),
        assigned_agent=body.get("assigned_agent"),
        priority=body.get("priority", 5),
        requires_human_review=body.get("requires_human_review", False),
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return {"message": "Task added", "task_id": str(task.id)}


@router.post("/confirm")
async def confirm_plan(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Confirm the plan: move all pending subtasks to claimed."""
    from sqlalchemy import update

    result = await db.execute(
        update(Task)
        .where(
            Task.project_id == project_id,
            Task.status == "pending",
            Task.parent_task_id.isnot(None),
        )
        .values(status="claimed")
    )
    await db.commit()

    from app.core.events import event_bus

    await event_bus.broadcast(
        SSEEvent(
            type="task_status_changed",
            project_id=project_id,
            content=f"计划已确认，{result.rowcount} 个子任务开始执行",
            data={"action": "plan_confirmed", "count": result.rowcount},
        )
    )

    return {"message": f"计划已确认，{result.rowcount} 个子任务开始执行", "count": result.rowcount}

"""Task management API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.models import Task
from app.core.schemas import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter()


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: uuid.UUID,
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new task within a project."""
    task = Task(
        project_id=project_id,
        parent_task_id=task_in.parent_task_id,
        title=task_in.title,
        description=task_in.description,
        assigned_agent=task_in.assigned_agent,
        priority=task_in.priority,
        input_data=task_in.input_data,
        requires_human_review=task_in.requires_human_review,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)

    # Broadcast event
    from app.core.events import event_bus
    from app.core.schemas import SSEEvent

    await event_bus.broadcast(
        SSEEvent(
            type="task_created",
            project_id=project_id,
            task_id=task.id,
            agent_name=task.assigned_agent,
            content=f"Task created: {task.title}",
            data={"title": task.title, "assigned_agent": task.assigned_agent},
        )
    )

    return task


@router.post("/confirm-plan")
async def confirm_plan(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Confirm the Manager's plan: move all pending subtasks to claimed so agents can pick them up."""
    from sqlalchemy import update

    result = await db.execute(
        update(Task)
        .where(
            Task.project_id == project_id,
            Task.status == "pending",
        )
        .values(status="claimed")
    )
    await db.commit()

    from app.core.events import event_bus
    from app.core.schemas import SSEEvent

    await event_bus.broadcast(
        SSEEvent(
            type="task_status_changed",
            project_id=project_id,
            content=f"计划已确认，{result.rowcount} 个子任务开始执行",
            data={"action": "plan_confirmed", "count": result.rowcount},
        )
    )

    return {"message": f"计划已确认，{result.rowcount} 个子任务开始执行", "count": result.rowcount}


@router.post("/{task_id}/review")
async def review_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Review a task: approve, reject, or request modifications.

    Body: { "action": "approve"|"reject"|"modify", "comment": "...", "modified_content": "..." }
    """
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    action = body.get("action", "approve")
    comment = body.get("comment", "")
    modified_content = body.get("modified_content")

    if action == "approve":
        task.status = "completed"
        task.completed_at = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        )
        task.human_feedback = comment
        new_status = "completed"
    elif action == "reject":
        task.status = "claimed"  # Send back for re-execution
        task.human_feedback = f"用户拒绝: {comment}"
        new_status = "claimed"
    elif action == "modify":
        task.status = "claimed"  # Send back with modified requirements
        task.human_feedback = f"用户修改要求: {comment}"
        if modified_content:
            task.description = modified_content
        new_status = "claimed"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    await db.commit()
    await db.refresh(task)

    from app.core.events import event_bus
    from app.core.schemas import SSEEvent

    await event_bus.broadcast(
        SSEEvent(
            type="task_approved" if action == "approve" else "task_rejected",
            project_id=project_id,
            task_id=task.id,
            agent_name=task.assigned_agent,
            content=f"任务{'通过' if action == 'approve' else '已退回'}: {task.title}",
            data={"action": action, "comment": comment, "new_status": new_status},
        )
    )

    return {"task_id": str(task_id), "status": new_status, "action": action}


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    project_id: uuid.UUID,
    status: str | None = None,
    assigned_agent: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List tasks for a project, with optional filters."""
    query = select(Task).where(Task.project_id == project_id)

    if status:
        query = query.where(Task.status == status)
    if assigned_agent:
        query = query.where(Task.assigned_agent == assigned_agent)

    query = query.order_by(Task.created_at.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific task."""
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a task (e.g., change status, add human feedback)."""
    task = await db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    await db.flush()
    await db.refresh(task)

    # Broadcast status change event
    if "status" in update_data and update_data["status"] != old_status:
        from app.core.events import event_bus
        from app.core.schemas import SSEEvent

        await event_bus.broadcast(
            SSEEvent(
                type="task_status_changed",
                project_id=project_id,
                task_id=task.id,
                agent_name=task.assigned_agent,
                content=f"Task status: {old_status} -> {task.status}",
                data={
                    "old_status": old_status,
                    "new_status": task.status,
                    "title": task.title,
                },
            )
        )

    return task

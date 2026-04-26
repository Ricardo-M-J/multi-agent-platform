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

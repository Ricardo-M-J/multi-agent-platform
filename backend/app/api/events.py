"""Event log API endpoints for querying project event history."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.models import EventLog, Project
from app.core.schemas import EventLogResponse

router = APIRouter()


@router.get("", response_model=list[EventLogResponse])
async def list_project_events(
    project_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=500, description="Number of events to return"),
    offset: int = Query(default=0, ge=0, description="Number of events to skip"),
    level: str | None = Query(default=None, description="Filter by event level (e.g. info, warning, error)"),
    db: AsyncSession = Depends(get_db),
):
    """Get historical event logs for a project, ordered by created_at descending."""
    # Verify project exists
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build query
    query = select(EventLog).where(EventLog.project_id == project_id)

    if level is not None:
        query = query.where(EventLog.event_level == level)

    query = query.order_by(EventLog.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()

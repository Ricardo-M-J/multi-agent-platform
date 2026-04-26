"""Agent state query API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.models import AgentState
from app.core.schemas import AgentStateResponse

router = APIRouter()


@router.get("", response_model=list[AgentStateResponse])
async def list_agent_states(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """List all agent states for a project."""
    result = await db.execute(
        select(AgentState)
        .where(AgentState.project_id == project_id)
        .order_by(AgentState.agent_name)
    )
    return result.scalars().all()


@router.get("/{agent_name}", response_model=AgentStateResponse)
async def get_agent_state(
    project_id: uuid.UUID,
    agent_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Get the current state of a specific agent."""
    result = await db.execute(
        select(AgentState).where(
            AgentState.project_id == project_id,
            AgentState.agent_name == agent_name,
        )
    )
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="Agent state not found")
    return state

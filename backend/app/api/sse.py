"""SSE (Server-Sent Events) endpoint for real-time event streaming."""

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.core.events import event_bus
from app.core.models import EventLog
from app.core.schemas import SSEEvent

logger = logging.getLogger(__name__)

router = APIRouter()


async def persist_event(event: SSEEvent) -> None:
    """Persist an SSE event to the event_logs table."""
    from app.core.database import async_session_factory

    async with async_session_factory() as session:
        log = EventLog(
            project_id=event.project_id,
            task_id=event.task_id,
            agent_name=event.agent_name,
            event_type=event.type,
            event_level="info",
            content=event.content,
            metadata_=event.data,
        )
        session.add(log)
        await session.commit()


@router.get("/stream")
async def event_stream(project_id: uuid.UUID):
    """SSE endpoint for real-time event streaming.

    Clients connect to this endpoint to receive real-time updates
    about agent activities, task status changes, and review requests.
    """
    generator = event_bus.event_stream(str(project_id))
    return EventSourceResponse(generator)

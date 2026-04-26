"""Event bus for broadcasting events to SSE clients and logging to database."""

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, AsyncIterator, Callable

from app.core.schemas import SSEEvent

logger = logging.getLogger(__name__)


class EventBus:
    """In-process event bus for SSE broadcasting and database event logging.

    Subscribers (SSE clients) register per project_id and receive events
    pushed via `broadcast()`. All broadcasts are also logged to the database.
    """

    def __init__(self) -> None:
        # project_id -> list of asyncio.Queue
        self._subscribers: dict[str, list[asyncio.Queue[SSEEvent]]] = defaultdict(list)
        # Optional callback to persist events to DB
        self._persist_callback: Callable | None = None

    def set_persist_callback(self, callback: Callable) -> None:
        """Set a callback function to persist events to the database."""
        self._persist_callback = callback

    def subscribe(self, project_id: str) -> asyncio.Queue[SSEEvent]:
        """Subscribe to events for a given project. Returns a queue to consume from."""
        queue: asyncio.Queue[SSEEvent] = asyncio.Queue(maxsize=100)
        self._subscribers[project_id].append(queue)
        logger.info(f"SSE client subscribed to project {project_id}")
        return queue

    def unsubscribe(self, project_id: str, queue: asyncio.Queue[SSEEvent]) -> None:
        """Remove a subscriber queue."""
        if project_id in self._subscribers:
            try:
                self._subscribers[project_id].remove(queue)
            except ValueError:
                pass
            if not self._subscribers[project_id]:
                del self._subscribers[project_id]
            logger.info(f"SSE client unsubscribed from project {project_id}")

    async def broadcast(self, event: SSEEvent) -> None:
        """Broadcast an event to all subscribers of the relevant project."""
        project_id = str(event.project_id)
        queues = self._subscribers.get(project_id, [])

        # Convert to SSE format
        sse_data = f"data: {event.model_dump_json()}\n\n"

        dead_queues: list[asyncio.Queue[SSEEvent]] = []
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dead_queues.append(queue)

        # Clean up dead queues
        for queue in dead_queues:
            self.unsubscribe(project_id, queue)

        # Persist to database if callback is set
        if self._persist_callback:
            try:
                await self._persist_callback(event)
            except Exception as e:
                logger.error(f"Failed to persist event: {e}")

        logger.debug(f"Broadcast event {event.type} to {len(queues)} subscribers")

    async def event_stream(self, project_id: str) -> AsyncIterator[str]:
        """Yield SSE-formatted events for a project. For use in SSE endpoint."""
        queue = self.subscribe(project_id)
        try:
            while True:
                event = await queue.get()
                yield f"data: {event.model_dump_json()}\n\n"
        except asyncio.CancelledError:
            self.unsubscribe(project_id, queue)
            raise


# Global event bus instance
event_bus = EventBus()

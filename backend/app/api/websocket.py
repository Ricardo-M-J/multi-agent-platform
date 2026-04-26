"""WebSocket endpoint for bidirectional control commands."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.events import event_bus
from app.core.models import Task
from app.core.schemas import SSEEvent, WSMessage

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections per project."""

    def __init__(self) -> None:
        # project_id -> list of WebSocket connections
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str) -> None:
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        logger.info(f"WebSocket connected for project {project_id}")

    def disconnect(self, websocket: WebSocket, project_id: str) -> None:
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        logger.info(f"WebSocket disconnected for project {project_id}")

    async def send_to_project(self, project_id: str, message: dict) -> None:
        """Send a message to all WebSocket clients of a project."""
        connections = self.active_connections.get(project_id, [])
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


ws_manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, project_id: uuid.UUID):
    """WebSocket endpoint for sending control commands.

    Supported message types:
    - pause: Pause the entire project
    - resume: Resume a paused project
    - approve: Approve a task under review
    - reject: Reject a task and send it back for rework
    - modify: Modify a task's output and re-execute
    - retry: Retry a failed task
    """
    pid = str(project_id)
    await ws_manager.connect(websocket, pid)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = WSMessage(**json.loads(raw))
            except Exception as e:
                await websocket.send_json({"error": f"Invalid message format: {e}"})
                continue

            logger.info(f"WebSocket command: {msg.type} for project {pid}")

            # Handle the command
            async with async_session_factory() as session:
                if msg.type == "pause":
                    await _handle_pause(session, project_id, pid)
                elif msg.type == "resume":
                    await _handle_resume(session, project_id, pid)
                elif msg.type == "approve":
                    await _handle_approve(session, project_id, msg.task_id, pid)
                elif msg.type == "reject":
                    await _handle_reject(
                        session, project_id, msg.task_id, msg.data.get("feedback", ""), pid
                    )
                elif msg.type == "modify":
                    await _handle_modify(
                        session, project_id, msg.task_id, msg.data.get("content", ""), pid
                    )
                elif msg.type == "retry":
                    await _handle_retry(session, project_id, msg.task_id, pid)
                else:
                    await websocket.send_json({"error": f"Unknown command: {msg.type}"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, pid)


async def _handle_pause(session, project_id: uuid.UUID, pid: str) -> None:
    from app.core.models import Project

    project = await session.get(Project, project_id)
    if project:
        project.status = "paused"
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="project_paused",
                project_id=project_id,
                content="Project paused by user",
            )
        )


async def _handle_resume(session, project_id: uuid.UUID, pid: str) -> None:
    from app.core.models import Project

    project = await session.get(Project, project_id)
    if project:
        project.status = "running"
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="project_resumed",
                project_id=project_id,
                content="Project resumed by user",
            )
        )


async def _handle_approve(
    session, project_id: uuid.UUID, task_id: uuid.UUID | None, pid: str
) -> None:
    if not task_id:
        return
    task = await session.get(Task, task_id)
    if task and task.status == "review":
        task.status = "completed"
        task.completed_at = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        )
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="task_approved",
                project_id=project_id,
                task_id=task_id,
                agent_name=task.assigned_agent,
                content=f"Task approved: {task.title}",
            )
        )


async def _handle_reject(
    session,
    project_id: uuid.UUID,
    task_id: uuid.UUID | None,
    feedback: str,
    pid: str,
) -> None:
    if not task_id:
        return
    task = await session.get(Task, task_id)
    if task and task.status == "review":
        task.status = "claimed"
        task.human_feedback = feedback
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="task_rejected",
                project_id=project_id,
                task_id=task_id,
                agent_name=task.assigned_agent,
                content=f"Task rejected: {task.title}. Feedback: {feedback}",
                data={"feedback": feedback},
            )
        )


async def _handle_modify(
    session,
    project_id: uuid.UUID,
    task_id: uuid.UUID | None,
    content: str,
    pid: str,
) -> None:
    if not task_id:
        return
    task = await session.get(Task, task_id)
    if task and task.status == "review":
        task.status = "claimed"
        task.input_data["modified_output"] = content
        task.human_feedback = "User modified the output"
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="task_modified",
                project_id=project_id,
                task_id=task_id,
                agent_name=task.assigned_agent,
                content=f"Task output modified: {task.title}",
                data={"modified_content": content},
            )
        )


async def _handle_retry(
    session, project_id: uuid.UUID, task_id: uuid.UUID | None, pid: str
) -> None:
    if not task_id:
        return
    task = await session.get(Task, task_id)
    if task and task.status == "failed":
        task.status = "claimed"
        task.error_message = None
        await session.commit()
        await event_bus.broadcast(
            SSEEvent(
                type="task_retry",
                project_id=project_id,
                task_id=task_id,
                agent_name=task.assigned_agent,
                content=f"Task queued for retry: {task.title}",
            )
        )

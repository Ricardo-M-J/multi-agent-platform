"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import projects, tasks, agents, sse, websocket
from app.core.database import engine
from app.core.events import event_bus
from app.core.models import Base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    # Set up event persistence callback
    from app.api.sse import persist_event
    event_bus.set_persist_callback(persist_event)

    # Start the task engine (agent workers)
    from app.engine.orchestrator import start_engine, stop_engine
    await start_engine()
    logger.info("Task engine started")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await stop_engine()
    await engine.dispose()


app = FastAPI(
    title="Multi-Agent Platform",
    description="Database-driven multi-agent collaboration platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/api/projects/{project_id}/tasks", tags=["tasks"])
app.include_router(agents.router, prefix="/api/projects/{project_id}/agents", tags=["agents"])
app.include_router(sse.router, prefix="/api/projects/{project_id}", tags=["sse"])
app.include_router(websocket.router, prefix="/api/projects/{project_id}", tags=["websocket"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/projects/{project_id}/submit-task")
async def submit_task(
    project_id: str,
    body: dict = None,
):
    """Submit a task to the multi-agent system for a project.

    The task will be assigned to the Manager Agent for decomposition
    into subtasks, which will then be executed by specialized agents.

    Body JSON: { "title": "...", "description": "...", "input_data": {...} }
    """
    from app.engine.orchestrator import submit_user_task

    body = body or {}
    result = await submit_user_task(
        project_id=project_id,
        title=body.get("title", ""),
        description=body.get("description", ""),
        input_data=body.get("input_data"),
    )
    return result


@app.get("/api/engine/status")
async def engine_status():
    """Get the current status of the task engine and registered agents."""
    from app.engine.orchestrator import get_engine_status

    return await get_engine_status()

"""Pydantic request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


# ─── Project Schemas ───


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    config: dict = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    config: dict | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Task Schemas ───


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    assigned_agent: str | None = None
    priority: int = 0
    input_data: dict = Field(default_factory=dict)
    requires_human_review: bool = False
    parent_task_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    status: str | None = None
    output_data: dict | None = None
    error_message: str | None = None
    human_feedback: str | None = None
    requires_human_review: bool | None = None
    priority: int | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    parent_task_id: uuid.UUID | None
    title: str
    description: str | None
    assigned_agent: str | None
    status: str
    priority: int
    input_data: dict
    output_data: dict
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    requires_human_review: bool
    human_feedback: str | None
    metadata_: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Agent State Schemas ───


class AgentStateResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    agent_name: str
    current_task_id: uuid.UUID | None
    status: str
    thought_process: str | None
    token_usage: dict
    last_heartbeat: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Artifact Schemas ───


class ArtifactCreate(BaseModel):
    task_id: uuid.UUID | None = None
    agent_name: str | None = None
    artifact_type: str | None = None
    title: str | None = None
    content: str
    is_final: bool = False


class ArtifactResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID | None
    agent_name: str | None
    artifact_type: str | None
    title: str | None
    content: str
    version: int
    is_final: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Event Log Schemas ───


class EventLogResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID | None
    agent_name: str | None
    event_type: str | None
    event_level: str
    content: str | None
    data: dict = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── WebSocket Schemas ───


class WSMessage(BaseModel):
    type: str  # pause, resume, approve, reject, modify, retry
    task_id: uuid.UUID | None = None
    data: dict = Field(default_factory=dict)


# ─── SSE Event Schemas ───


class SSEEvent(BaseModel):
    type: str  # task_status_changed, agent_thinking, agent_output, review_required, error
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    agent_name: str | None = None
    content: str | None = None
    data: dict = Field(default_factory=dict)

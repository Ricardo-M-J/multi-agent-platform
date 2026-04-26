"""SQLAlchemy ORM models for the multi-agent platform.

Supports both PostgreSQL and SQLite. Uses TypeDecorator for cross-compatible
JSON and UUID columns.
"""

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# ─── Cross-compatible type decorators ───


class JSONType(TypeDecorator):
    """JSON column that works with both PostgreSQL (JSONB) and SQLite (TEXT)."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is not None and not isinstance(value, str):
            return json.dumps(value, ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and isinstance(value, str):
            return json.loads(value)
        return value


class GUIDType(TypeDecorator):
    """UUID column that works with both PostgreSQL (UUID) and SQLite (TEXT/CHAR32)."""

    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


# ─── Base class ───


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    type_annotation_map = {
        dict: JSONType,
        uuid.UUID: GUIDType,
    }


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Models ───


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(GUIDType(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created")
    config: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="project", cascade="all, delete-orphan",
        foreign_keys="[Task.project_id]",
    )
    agent_states: Mapped[list["AgentState"]] = relationship(
        "AgentState", back_populates="project", cascade="all, delete-orphan",
        foreign_keys="[AgentState.project_id]",
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="project", cascade="all, delete-orphan",
        foreign_keys="[Artifact.project_id]",
    )
    event_logs: Mapped[list["EventLog"]] = relationship(
        "EventLog", back_populates="project", cascade="all, delete-orphan",
        foreign_keys="[EventLog.project_id]",
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUIDType(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUIDType(), ForeignKey("projects.id"), nullable=False
    )
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        GUIDType(), ForeignKey("tasks.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    input_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    output_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=False)
    human_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tasks", foreign_keys=[project_id])
    parent: Mapped["Task | None"] = relationship(
        "Task", remote_side=[id], foreign_keys=[parent_task_id], backref="subtasks"
    )


class AgentState(Base):
    __tablename__ = "agent_states"

    id: Mapped[uuid.UUID] = mapped_column(GUIDType(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUIDType(), ForeignKey("projects.id"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    current_task_id: Mapped[uuid.UUID | None] = mapped_column(
        GUIDType(), ForeignKey("tasks.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default="idle")
    thought_process: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_usage: Mapped[dict] = mapped_column(JSONType, default=dict)
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="agent_states", foreign_keys=[project_id])


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(GUIDType(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUIDType(), ForeignKey("projects.id"), nullable=False
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        GUIDType(), ForeignKey("tasks.id"), nullable=True
    )
    agent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    artifact_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="artifacts", foreign_keys=[project_id])


class EventLog(Base):
    __tablename__ = "event_logs"

    id: Mapped[uuid.UUID] = mapped_column(GUIDType(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        GUIDType(), ForeignKey("projects.id"), nullable=False
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        GUIDType(), ForeignKey("tasks.id"), nullable=True
    )
    agent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    event_level: Mapped[str] = mapped_column(String(20), default="info")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="event_logs", foreign_keys=[project_id])

"""SQLAlchemy async database setup with SQLite + PostgreSQL support."""

import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config.settings import settings

logger = logging.getLogger(__name__)

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    engine = create_async_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
        echo=settings.log_level == "debug",
    )
else:
    engine = create_async_engine(
        settings.database_url,
        pool_size=10,
        max_overflow=20,
        echo=settings.log_level == "debug",
    )

# Set SQLite pragmas for better performance
if _is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")  # 30s wait for lock
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that provides an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            # Only commit if there are pending changes
            if session.in_transaction() and session.is_active:
                await session.commit()
        except Exception:
            await session.rollback()
            raise

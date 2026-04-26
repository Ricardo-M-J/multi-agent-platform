from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    # Supports both PostgreSQL and SQLite:
    #   PostgreSQL: postgresql+asyncpg://user:pass@host:5432/db
    #   SQLite:     sqlite+aiosqlite:///./data/multi_agent.db
    database_url: str = "sqlite+aiosqlite:///./data/multi_agent.db"

    # LLM API Keys
    moonshot_api_key: str = ""
    deepseek_api_key: str = ""
    doubao_api_key: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # Agent settings
    agent_poll_interval: float = 2.0  # seconds
    agent_max_retries: int = 3
    agent_timeout: int = 300  # seconds


settings = Settings()

"""YAML configuration hot-reloader.

Monitors agents_config.yaml for changes and refreshes the in-memory cache.
"""

import logging
import os
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class ConfigHotReloader:
    """Monitors a YAML config file and auto-refreshes on change."""

    def __init__(self, config_path: str) -> None:
        self._config_path = config_path
        self._cached_config: dict | None = None
        self._cached_mtime: float = 0
        # Load immediately
        self._load()

    def _load(self) -> dict:
        """Load config from disk."""
        with open(self._config_path, "r", encoding="utf-8") as f:
            self._cached_config = yaml.safe_load(f) or {}
        self._cached_mtime = os.path.getmtime(self._config_path)
        return self._cached_config

    def get_config(self) -> dict:
        """Get latest config (re-reads file if changed)."""
        try:
            current_mtime = os.path.getmtime(self._config_path)
            if current_mtime > self._cached_mtime:
                logger.info(f"Config file changed, reloading: {self._config_path}")
                self._load()
        except OSError:
            pass
        return self._cached_config or {}

    def update_config(self, config: dict) -> None:
        """Update config in memory and write back to file."""
        import io
        # Use a string dump to preserve formatting
        with open(self._config_path, "w", encoding="utf-8") as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        self._cached_config = config
        self._cached_mtime = os.path.getmtime(self._config_path)
        logger.info(f"Config updated and saved: {self._config_path}")

    def get_agent_config(self, agent_name: str) -> dict:
        """Get config for a specific agent."""
        return self.get_config().get("agents", {}).get(agent_name, {})

    def get_all_agents(self) -> dict:
        """Get all agent configs."""
        return self.get_config().get("agents", {})

    def get_all_skills(self) -> dict:
        """Get all skill configs."""
        return self.get_config().get("skills", {})

    def get_skill(self, skill_name: str) -> dict:
        """Get config for a specific skill."""
        return self.get_config().get("skills", {}).get(skill_name, {})

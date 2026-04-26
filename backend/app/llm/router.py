"""LLM model router with fallback chain support."""

import logging
from typing import Any

import yaml
from pathlib import Path

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Load LLM configuration
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "llm_config.yaml"
with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
    _llm_config = yaml.safe_load(f)


class LLMRouter:
    """Routes LLM calls to appropriate models with fallback support.

    Uses LiteLLM format for model identifiers: provider/model_name
    e.g., "openai/moonshot-v1-128k", "deepseek/deepseek-chat"
    """

    def __init__(self) -> None:
        self.models_config = _llm_config.get("models", {})
        self.routing = _llm_config.get("routing", {})
        self.fallback_chain = _llm_config.get("fallback_chain", [])
        self.defaults = _llm_config.get("defaults", {})

        # Build provider -> api_base mapping
        self._provider_bases: dict[str, str] = {}
        for name, cfg in self.models_config.items():
            base = cfg.get("api_base", "")
            for model_name in cfg.get("models", {}).values():
                self._provider_bases[f"{cfg['provider']}/{model_name}"] = base

    def get_model_for_agent(self, agent_role: str) -> str:
        """Get the default model identifier for a given agent role."""
        return self.routing.get(agent_role, self.fallback_chain[0] if self.fallback_chain else "")

    def get_api_base(self, model_id: str) -> str:
        """Get the API base URL for a given model identifier."""
        return self._provider_bases.get(model_id, "")

    def get_api_key(self, model_id: str) -> str:
        """Get the API key for a given model identifier."""
        provider = model_id.split("/")[0]
        for name, cfg in self.models_config.items():
            if cfg.get("provider") == provider:
                env_var = cfg.get("api_key_env", "")
                return getattr(settings, env_var.lower(), "") or ""
        return ""

    def get_fallback_chain(self, model_id: str) -> list[str]:
        """Get the fallback chain for a given model, excluding the model itself."""
        chain = [m for m in self.fallback_chain if m != model_id]
        return chain

    def get_default_params(self) -> dict[str, Any]:
        """Get default LLM parameters."""
        return {
            "temperature": self.defaults.get("temperature", 0.7),
            "max_tokens": self.defaults.get("max_tokens", 4096),
            "timeout": self.defaults.get("timeout", 60),
        }


# Global router instance
llm_router = LLMRouter()

"""LiteLLM provider wrapper with fallback and retry support."""

import asyncio
import logging
import time
from typing import Any, AsyncIterator

from app.llm.router import llm_router

logger = logging.getLogger(__name__)


class LLMCallError(Exception):
    """Raised when all LLM providers in the fallback chain fail."""

    def __init__(self, model_id: str, message: str) -> None:
        self.model_id = model_id
        super().__init__(f"LLM call failed for {model_id}: {message}")


async def call_llm(
    model_id: str | None = None,
    agent_role: str | None = None,
    messages: list[dict[str, Any]] | None = None,
    prompt: str | None = None,
    system_prompt: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    stream: bool = False,
    **kwargs: Any,
) -> str | AsyncIterator[str]:
    """Call an LLM with automatic fallback.

    Args:
        model_id: LiteLLM model identifier (e.g., "openai/moonshot-v1-128k")
        agent_role: Agent role name (will look up default model from routing config)
        messages: Chat messages in OpenAI format
        prompt: Simple text prompt (converted to single message)
        system_prompt: System prompt prepended to messages
        temperature: Override default temperature
        max_tokens: Override default max tokens
        stream: If True, return an async iterator of text chunks
        **kwargs: Additional arguments passed to litellm.acompletion

    Returns:
        If stream=False: the complete response text
        If stream=True: an async iterator yielding text chunks

    Raises:
        LLMCallError: if all models in the fallback chain fail
    """
    # Resolve model_id
    if model_id is None and agent_role:
        model_id = llm_router.get_model_for_agent(agent_role)
    if model_id is None:
        raise LLMCallError("none", "Either model_id or agent_role must be provided")

    # Build messages
    if messages is None:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if prompt:
            messages.append({"role": "user", "content": prompt})

    # Get parameters
    defaults = llm_router.get_default_params()
    params = {
        "temperature": temperature or defaults["temperature"],
        "max_tokens": max_tokens or defaults["max_tokens"],
        "timeout": defaults["timeout"],
        **kwargs,
    }

    # Build fallback chain
    chain = [model_id] + llm_router.get_fallback_chain(model_id)

    last_error: Exception | None = None
    for current_model in chain:
        try:
            return await _call_single_model(
                current_model, messages, params, stream=stream
            )
        except Exception as e:
            last_error = e
            logger.warning(
                f"Model {current_model} failed: {e}, trying next in fallback chain..."
            )
            continue

    raise LLMCallError(model_id, str(last_error))


async def _call_single_model(
    model_id: str,
    messages: list[dict[str, Any]],
    params: dict[str, Any],
    stream: bool = False,
    retries: int = 2,
) -> str | AsyncIterator[str]:
    """Call a single model with retry support."""
    import litellm

    # Set API key and base for this model
    api_key = llm_router.get_api_key(model_id)
    api_base = llm_router.get_api_base(model_id)

    call_params = {
        "model": model_id,
        "messages": messages,
        "api_key": api_key,
        "api_base": api_base if api_base else None,
        "stream": stream,
        **params,
    }
    # Remove None values
    call_params = {k: v for k, v in call_params.items() if v is not None}

    for attempt in range(retries + 1):
        try:
            if stream:
                return _stream_response(litellm.acompletion(**call_params))
            else:
                response = await litellm.acompletion(**call_params)
                return response.choices[0].message.content or ""
        except Exception as e:
            if attempt < retries:
                wait_time = 2**attempt  # exponential backoff
                logger.info(f"Retry {attempt + 1} for {model_id} after {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                raise


async def _stream_response(response_iterator: Any) -> AsyncIterator[str]:
    """Convert litellm streaming response to async iterator of text chunks."""
    async for chunk in response_iterator:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content

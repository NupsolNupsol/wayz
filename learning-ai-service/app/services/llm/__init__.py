"""Which LLM this deployment uses, decided once."""

from __future__ import annotations

import threading

from ...config import settings
from .base import Completion, LLMProvider, Message
from .openai_provider import EchoProvider, OpenAIProvider

_lock = threading.Lock()
_provider: LLMProvider | None = None


def get_llm() -> LLMProvider:
    global _provider
    if _provider is not None:
        return _provider
    with _lock:
        if _provider is None:
            _provider = EchoProvider() if settings.LLM_PROVIDER == "echo" else OpenAIProvider()
    return _provider


def llm_status() -> dict[str, object]:
    """Readiness without constructing a client — a missing key is a fact, not an exception."""
    if settings.LLM_PROVIDER == "echo":
        return {"provider": "echo", "model": "echo", "configured": True}
    return {
        "provider": "openai",
        "model": settings.OPENAI_MODEL,
        "style": settings.OPENAI_API_STYLE,
        "configured": bool(settings.OPENAI_API_KEY),
    }


def reset_llm_for_tests() -> None:
    global _provider
    _provider = None


__all__ = [
    "Completion",
    "LLMProvider",
    "Message",
    "get_llm",
    "llm_status",
    "reset_llm_for_tests",
]

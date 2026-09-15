"""OpenAI, behind the provider seam.

Two call shapes are supported because both are legitimately current: `responses` is the API
OpenAI now recommends, and `chat.completions` is what nearly every OpenAI-compatible gateway
implements. `OPENAI_API_STYLE` picks one; nothing above this file knows which was used.

The key is read from configuration and never leaves this process: it is not in a response, not
in a log line, and not in any error this service is willing to show a person.
"""

from __future__ import annotations

from typing import Any

from ...config import settings
from ...errors import DependencyError
from ...logging_config import get_logger
from .base import Completion, Message

logger = get_logger(__name__)


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        from openai import OpenAI

        if not settings.OPENAI_API_KEY:
            raise DependencyError("OPENAI_API_KEY is not configured.")
        kwargs: dict[str, Any] = {
            "api_key": settings.OPENAI_API_KEY,
            "timeout": settings.OPENAI_TIMEOUT_SECONDS,
            "max_retries": 1,
        }
        if settings.OPENAI_BASE_URL:
            kwargs["base_url"] = settings.OPENAI_BASE_URL
        self._client = OpenAI(**kwargs)
        self._model = settings.OPENAI_MODEL

    # ------------------------------------------------------------------ calls

    def _via_responses(self, messages: list[Message], max_tokens: int, temperature: float):
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        rest = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
        response = self._client.responses.create(
            model=self._model,
            instructions=system or None,
            input=rest,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )
        return Completion(
            text=(response.output_text or "").strip(),
            model=getattr(response, "model", self._model),
            finish_reason=getattr(response, "status", None),
        )

    def _via_chat(self, messages: list[Message], max_tokens: int, temperature: float):
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        choice = response.choices[0]
        return Completion(
            text=(choice.message.content or "").strip(),
            model=response.model or self._model,
            finish_reason=choice.finish_reason,
        )

    def complete(
        self, messages: list[Message], *, max_tokens: int, temperature: float
    ) -> Completion:
        try:
            if settings.OPENAI_API_STYLE == "responses":
                return self._via_responses(messages, max_tokens, temperature)
            return self._via_chat(messages, max_tokens, temperature)
        except Exception as exc:  # noqa: BLE001
            # The type only. An OpenAI exception message can quote the request, and the
            # request contains a tenant's own procedures.
            logger.error("LLM call failed", provider=self.name, error=type(exc).__name__)
            raise DependencyError(
                f"OpenAI request failed: {type(exc).__name__}",
                public_message="تعذّر توليد الإجابة حالياً. حاول مرة أخرى بعد قليل.",
            ) from exc

    def status(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "model": self._model,
            "style": settings.OPENAI_API_STYLE,
            "configured": bool(settings.OPENAI_API_KEY),
        }


class EchoProvider:
    """A provider that answers from the retrieved context alone, with no vendor call.

    Used by the tests, and a usable degraded mode: it quotes the top passage and names its
    source rather than inventing anything, which is the behaviour the system prompt asks the
    real model for anyway.
    """

    name = "echo"

    def complete(
        self, messages: list[Message], *, max_tokens: int, temperature: float
    ) -> Completion:
        del max_tokens, temperature
        user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        return Completion(text=user[:1500], model="echo", finish_reason="stop")

    def status(self) -> dict[str, object]:
        return {"provider": self.name, "model": "echo", "configured": True}

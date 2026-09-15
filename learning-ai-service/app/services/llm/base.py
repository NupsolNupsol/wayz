"""The seam between "generate an answer" and "which vendor generates it".

Everything above this file talks in messages and gets back text. Swapping OpenAI for Azure,
Bedrock or a self-hosted endpoint is a new class here and one line of configuration — no
change to retrieval, to the prompt, or to the routers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Message:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass(frozen=True)
class Completion:
    text: str
    model: str
    finish_reason: str | None = None


class LLMProvider(Protocol):
    name: str

    def complete(
        self, messages: list[Message], *, max_tokens: int, temperature: float
    ) -> Completion: ...

    def status(self) -> dict[str, object]: ...

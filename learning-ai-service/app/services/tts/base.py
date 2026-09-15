"""The seam between "speak this Arabic" and "which engine speaks it".

Piper today; OpenAI TTS, Azure Speech, XTTS or a bought Saudi voice later. Everything above
this file passes text and gets back bytes plus a media type, so a swap is one class and one
setting — the chat pipeline has no idea Piper exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Speech:
    audio: bytes
    media_type: str
    voice: str


class TTSProvider(Protocol):
    name: str

    def available(self) -> bool:
        """Cheap, non-throwing check used by readiness and by provider selection."""
        ...

    def synthesise(self, text: str, *, language: str = "ar") -> Speech: ...

    def status(self) -> dict[str, object]: ...

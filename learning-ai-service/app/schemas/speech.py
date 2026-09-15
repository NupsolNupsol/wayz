from __future__ import annotations

from pydantic import BaseModel, Field


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: str = Field(default="ar", max_length=10)
    interaction_id: str | None = Field(default=None, max_length=64)

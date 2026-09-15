"""Chat in, grounded Arabic answer out.

The request carries *where the employee is*, never *who they are*: identity, tenant and role
come from the signed service token. A browser that lies about its page gets a worse answer;
a browser cannot lie about its tenant at all, because it is never asked.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..domain import Scope


class PageContext(BaseModel):
    """What a screen is willing to say about itself.

    Deliberately a small, named set of fields rather than anything the page happens to hold.
    No customer records, no payment details, no free-form dump of component state — a page
    contributes a stable key, a title, what kind of thing is on it and what the user may do.
    """

    page_key: str | None = Field(default=None, max_length=120)
    route: str | None = Field(default=None, max_length=300)
    module: str | None = Field(default=None, max_length=60)
    screen_title: str | None = Field(default=None, max_length=200)
    entity_type: str | None = Field(default=None, max_length=60)
    entity_status: str | None = Field(default=None, max_length=60)
    available_actions: list[str] = Field(default_factory=list)
    facts: dict[str, str] = Field(default_factory=dict)

    def trimmed(self) -> PageContext:
        """Caps everything a page can contribute, so no screen can flood the prompt."""
        return PageContext(
            page_key=self.page_key,
            route=(self.route or "")[:300] or None,
            module=self.module,
            screen_title=self.screen_title,
            entity_type=self.entity_type,
            entity_status=self.entity_status,
            available_actions=[a[:60] for a in self.available_actions[:20]],
            facts={k[:40]: str(v)[:120] for k, v in list(self.facts.items())[:12]},
        )


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    page: PageContext | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)
    conversation_id: str | None = Field(default=None, max_length=64)


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class SourceRef(BaseModel):
    document_id: str
    title: str
    scope: Scope
    module: str = "GENERAL"
    relevant_excerpt: str = ""
    score: float = 0.0
    tenant_name: str | None = None


class VideoRef(BaseModel):
    title: str
    url: str
    document_id: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceRef] = Field(default_factory=list)
    videos: list[VideoRef] = Field(default_factory=list)
    grounded: bool = False
    interaction_id: str
    page_key: str | None = None
    retrieved_count: int = 0
    model: str | None = None


ChatRequest.model_rebuild()

"""The wire shape of a knowledge document.

`tenant_id` appears on the *create* payload because the caller is a platform administrator
choosing which company a document belongs to — that is a control-plane decision made against a
control-plane credential. It never appears on anything an employee sends.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from ..domain import ALL_ROLES, DocumentStatus, Scope


class DocumentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=1)
    scope: Scope
    tenant_id: str | None = Field(default=None, max_length=120)
    tenant_name: str | None = Field(default=None, max_length=200)
    filename: str = Field(default="document.txt", max_length=200)
    allowed_roles: list[str] = Field(default_factory=list)
    module: str = Field(default="GENERAL", max_length=60)
    page_key: str | None = Field(default=None, max_length=120)
    language: str = Field(default="ar", max_length=10)
    version: int = Field(default=1, ge=1)
    notes: str = Field(default="", max_length=1000)

    @field_validator("allowed_roles")
    @classmethod
    def _known_roles(cls, value: list[str]) -> list[str]:
        cleaned = sorted({v.strip().upper() for v in value if v and v.strip()})
        unknown = [v for v in cleaned if v not in ALL_ROLES]
        if unknown:
            raise ValueError(f"Unknown role(s): {', '.join(unknown)}")
        return cleaned

    @field_validator("filename")
    @classmethod
    def _safe_filename(cls, value: str) -> str:
        """A filename is a label here, never a path.

        Nothing in this service opens a file by this name, but it is displayed, stored and
        echoed back — so a value containing a separator is refused rather than sanitised,
        because a caller that sent one meant something we do not support.
        """
        name = value.strip() or "document.txt"
        if any(part in name for part in ("/", "\\", "..", "\x00")):
            raise ValueError("Filename must not contain path separators.")
        return name[:200]

    @model_validator(mode="after")
    def _scope_agrees_with_tenant(self) -> DocumentCreate:
        if self.scope is Scope.TENANT and not self.tenant_id:
            raise ValueError("A tenant document must name its tenant.")
        if self.scope is Scope.GLOBAL and self.tenant_id:
            raise ValueError("A global document must not name a tenant.")
        return self


class DocumentSummary(BaseModel):
    id: str
    title: str
    filename: str
    scope: Scope
    tenant_id: str | None = None
    tenant_name: str | None = None
    allowed_roles: list[str] = Field(default_factory=list)
    module: str = "GENERAL"
    page_key: str | None = None
    language: str = "ar"
    version: int = 1
    status: DocumentStatus = DocumentStatus.PENDING
    error: str | None = None
    chunk_count: int = 0
    char_count: int = 0
    video_urls: list[str] = Field(default_factory=list)
    uploaded_by: str = ""
    created_at: datetime
    updated_at: datetime
    indexed_at: datetime | None = None


class DocumentDetail(DocumentSummary):
    content: str = ""
    notes: str = ""
    chunk_ids: list[str] = Field(default_factory=list)


class DocumentList(BaseModel):
    items: list[DocumentSummary]
    total: int


class ReindexResult(BaseModel):
    id: str
    status: DocumentStatus
    chunk_count: int
    error: str | None = None

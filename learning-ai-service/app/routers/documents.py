"""Knowledge management — control plane only.

Every route here demands a platform-administrator token. A tenant employee, including a
tenant's own administrator, cannot reach any of it: deciding which company a document belongs
to is a control-plane act, and the whole isolation story rests on nobody inside a tenant
being able to write a document into a different one.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from ..domain import DocumentStatus, Scope
from ..errors import NotFoundError, ValidationError
from ..logging_config import get_logger
from ..schemas.documents import (
    DocumentCreate,
    DocumentDetail,
    DocumentList,
    DocumentSummary,
    ReindexResult,
)
from ..security import Actor, current_platform_admin
from ..services import documents as docs
from ..services.registry import get_registry
from ..services.vector_store import GLOBAL_TENANT_KEY

logger = get_logger(__name__)

router = APIRouter(prefix="/v1/documents", tags=["knowledge"])


def _index_now(doc_id: str) -> DocumentSummary:
    """Indexing is synchronous.

    A background task would return "accepted" and leave the administrator watching a spinner
    that never resolves when the embedder is down. These documents are a few kilobytes; the
    honest answer is the one that waits and then says what happened.
    """
    try:
        docs.index_document(doc_id)
    except Exception as exc:  # noqa: BLE001
        # Swallowed on purpose: `index_document` has already written the failure onto the
        # record, and the administrator needs to see the document with its error attached
        # rather than a 500 that leaves them wondering whether anything was saved at all.
        logger.warning("Indexing did not complete", documentId=doc_id, error=type(exc).__name__)
    stored = get_registry().get_document(doc_id)
    if not stored:
        raise NotFoundError("No such document.")
    return docs.to_summary(stored)


@router.post("", response_model=DocumentSummary, status_code=201)
def create(
    payload: DocumentCreate,
    actor: Actor = Depends(current_platform_admin),
) -> DocumentSummary:
    doc = docs.create_document(payload, actor)
    logger.info(
        "Knowledge document created",
        documentId=doc["_id"],
        scope=doc["scope"],
        # Not `tenantId`: that name belongs to the actor's own tenant, and a platform admin
        # has none. Two different facts need two different keys.
        documentTenantId=doc["tenant_id"],
        **actor.log_fields(),
    )
    return _index_now(doc["_id"])


@router.post("/upload", response_model=DocumentSummary, status_code=201)
async def upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    scope: Scope = Form(...),
    tenant_id: str | None = Form(default=None),
    tenant_name: str | None = Form(default=None),
    allowed_roles: str = Form(default=""),
    module: str = Form(default="GENERAL"),
    page_key: str | None = Form(default=None),
    language: str = Form(default="ar"),
    notes: str = Form(default=""),
    actor: Actor = Depends(current_platform_admin),
) -> DocumentSummary:
    """Multipart upload of a `.txt`, for direct administrative use and for the test suite.

    The LockerFlow web UI goes through the JSON route instead: the browser reads the file, so
    the Node API forwards text rather than proxying a stream it would have to buffer anyway.
    """
    raw = await file.read()
    text = docs.validate_upload(file.filename or "document.txt", raw)
    payload = DocumentCreate(
        title=title,
        content=text,
        scope=scope,
        tenant_id=tenant_id or None,
        tenant_name=tenant_name or None,
        filename=file.filename or "document.txt",
        allowed_roles=[r for r in (allowed_roles or "").split(",") if r.strip()],
        module=module,
        page_key=page_key or None,
        language=language,
        notes=notes,
    )
    doc = docs.create_document(payload, actor)
    return _index_now(doc["_id"])


@router.get("", response_model=DocumentList)
def index(
    scope: Scope | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    _actor: Actor = Depends(current_platform_admin),
) -> DocumentList:
    # A tenant filter always means "this tenant's own"; global documents are asked for by
    # scope, never by passing the sentinel through from a client.
    resolved_tenant: str | None = None
    if scope is Scope.GLOBAL:
        resolved_tenant = GLOBAL_TENANT_KEY
    elif tenant_id:
        resolved_tenant = tenant_id

    rows, total = get_registry().list_documents(
        scope=scope.value if scope else None,
        tenant_id=resolved_tenant,
        limit=limit,
        skip=skip,
    )
    return DocumentList(items=[docs.to_summary(r) for r in rows], total=total)


@router.get("/{document_id}", response_model=DocumentDetail)
def detail(
    document_id: str,
    _actor: Actor = Depends(current_platform_admin),
) -> DocumentDetail:
    stored = get_registry().get_document(document_id)
    if not stored:
        raise NotFoundError("No such document.")
    return docs.to_detail(stored)


@router.delete("/{document_id}", status_code=200)
def remove(
    document_id: str,
    actor: Actor = Depends(current_platform_admin),
) -> dict[str, object]:
    docs.delete_document(document_id)
    logger.info("Knowledge document deleted", documentId=document_id, **actor.log_fields())
    return {"deleted": True, "id": document_id}


@router.patch("/{document_id}", response_model=DocumentSummary)
def update(
    document_id: str,
    payload: dict,
    _actor: Actor = Depends(current_platform_admin),
) -> DocumentSummary:
    title = payload.get("title")
    content = payload.get("content")
    if title is None and content is None:
        raise ValidationError("Nothing to update.")
    docs.replace_content(
        document_id,
        title=str(title) if title else None,
        content=str(content) if content is not None else None,
    )
    return _index_now(document_id)


@router.post("/{document_id}/reindex", response_model=ReindexResult)
def reindex(
    document_id: str,
    _actor: Actor = Depends(current_platform_admin),
) -> ReindexResult:
    summary = _index_now(document_id)
    return ReindexResult(
        id=summary.id,
        status=DocumentStatus(summary.status),
        chunk_count=summary.chunk_count,
        error=summary.error,
    )

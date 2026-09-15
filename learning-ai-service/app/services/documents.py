"""Ingestion: an Arabic `.txt` becomes a searchable, attributable, role-scoped document.

The order matters. The record is written *before* the vectors, with status PENDING, so a
document whose indexing dies half way is visible to the administrator who uploaded it with
the reason attached — rather than having vanished. Re-indexing then overwrites the same
point ids instead of adding a second copy beside them.
"""

from __future__ import annotations

import uuid
from typing import Any

from ..config import settings
from ..domain import DocumentStatus, Scope
from ..errors import NotFoundError, ValidationError
from ..logging_config import get_logger
from ..schemas.documents import DocumentCreate, DocumentDetail, DocumentSummary
from ..security import Actor
from . import vector_store
from .chunking import chunk_document, normalise
from .embeddings import get_embedder
from .registry import get_registry, now
from .youtube import extract_youtube_urls, video_titles

logger = get_logger(__name__)


def _new_id() -> str:
    return f"kdoc_{uuid.uuid4().hex[:16]}"


def validate_upload(filename: str, raw: bytes) -> str:
    """Everything we refuse before a document exists at all."""
    lowered = (filename or "").lower()
    if not any(lowered.endswith(ext) for ext in settings.allowed_extensions):
        raise ValidationError(
            f"Only {', '.join(settings.allowed_extensions)} files are accepted.",
            public_message="نوع الملف غير مدعوم. ارفع ملف نصي بصيغة .txt",
        )
    if len(raw) > settings.MAX_DOCUMENT_BYTES:
        raise ValidationError(
            "File is too large.",
            public_message=f"حجم الملف يتجاوز الحد المسموح ({settings.MAX_DOCUMENT_BYTES // 1024} كيلوبايت).",
        )
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        # The knowledge documents are hand-written Arabic; anything that is not UTF-8 is
        # either the wrong file or a file that will index as mojibake. Both are worth refusing.
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError(
                "File is not UTF-8.",
                public_message="تعذّر قراءة الملف. احفظه بترميز UTF-8 ثم أعد الرفع.",
            ) from exc
    if not text.strip():
        raise ValidationError(
            "File is empty.", public_message="الملف فارغ — لا يوجد محتوى لفهرسته."
        )
    return text


def _payload_for(doc: dict[str, Any], chunk_text: str, chunk_index: int) -> dict[str, Any]:
    return {
        "document_id": doc["_id"],
        "chunk_index": chunk_index,
        "title": doc["title"],
        "scope": doc["scope"],
        "tenant_id": doc["tenant_id"],
        "tenant_name": doc.get("tenant_name"),
        "module": doc.get("module") or "GENERAL",
        "page_key": doc.get("page_key"),
        "language": doc.get("language") or "ar",
        "allowed_roles": doc.get("allowed_roles") or [],
        "role_keys": vector_store.role_keys_for(doc.get("allowed_roles") or []),
        "video_urls": doc.get("video_urls") or [],
        "text": chunk_text,
    }


def index_document(doc_id: str) -> dict[str, Any]:
    """Embeds and stores a document's chunks. Safe to call again on an indexed document."""
    registry = get_registry()
    doc = registry.get_document(doc_id)
    if not doc:
        raise NotFoundError("No such document.")

    registry.update_document(doc_id, {"status": DocumentStatus.INDEXING.value, "error": None})
    try:
        chunks = chunk_document(
            doc["content"],
            target_chars=settings.CHUNK_TARGET_CHARS,
            overlap_chars=settings.CHUNK_OVERLAP_CHARS,
            min_split_chars=settings.CHUNK_MIN_SPLIT_CHARS,
        )
        if not chunks:
            raise ValidationError("Nothing to index.", public_message="لا يوجد محتوى لفهرسته.")

        # Replace rather than merge: a shortened document must not keep the chunks it lost.
        vector_store.delete_document(doc_id)

        vectors = get_embedder().encode([c.text for c in chunks])
        payloads = [_payload_for(doc, c.text, c.index) for c in chunks]
        ids = vector_store.upsert_chunks(document_id=doc_id, vectors=vectors, payloads=payloads)

        patch = {
            "status": DocumentStatus.INDEXED.value,
            "chunk_count": len(chunks),
            "chunk_ids": ids,
            "error": None,
            "indexed_at": now(),
            "updated_at": now(),
        }
        registry.update_document(doc_id, patch)
        logger.info(
            "Indexed knowledge document",
            documentId=doc_id,
            scope=doc["scope"],
            tenantId=doc["tenant_id"],
            chunks=len(chunks),
        )
        return {**doc, **patch}
    except Exception as exc:  # noqa: BLE001 - the failure is the thing we must record
        message = f"{type(exc).__name__}: {exc}"[:400]
        registry.update_document(
            doc_id,
            {"status": DocumentStatus.FAILED.value, "error": message, "updated_at": now()},
        )
        logger.error("Indexing failed", documentId=doc_id, error=type(exc).__name__)
        raise


def create_document(payload: DocumentCreate, actor: Actor) -> dict[str, Any]:
    content = normalise(payload.content)
    if not content:
        raise ValidationError(
            "Empty document.", public_message="الملف فارغ — لا يوجد محتوى لفهرسته."
        )

    urls = extract_youtube_urls(content)
    doc_id = _new_id()
    doc: dict[str, Any] = {
        "_id": doc_id,
        "title": payload.title.strip(),
        "filename": payload.filename,
        "content": content,
        "scope": payload.scope.value,
        # Global documents carry the sentinel so one payload index serves both scopes.
        "tenant_id": payload.tenant_id
        if payload.scope is Scope.TENANT
        else vector_store.GLOBAL_TENANT_KEY,
        "tenant_name": payload.tenant_name if payload.scope is Scope.TENANT else None,
        "allowed_roles": payload.allowed_roles,
        "module": (payload.module or "GENERAL").strip().upper(),
        "page_key": (payload.page_key or "").strip() or None,
        "language": payload.language or "ar",
        "version": payload.version,
        "notes": payload.notes,
        "status": DocumentStatus.PENDING.value,
        "error": None,
        "chunk_count": 0,
        "chunk_ids": [],
        "char_count": len(content),
        "video_urls": urls,
        "video_titles": video_titles(content, urls, payload.title.strip()),
        "uploaded_by": actor.subject,
        "created_at": now(),
        "updated_at": now(),
        "indexed_at": None,
    }
    get_registry().insert_document(doc)
    return doc


def replace_content(doc_id: str, *, title: str | None, content: str | None) -> dict[str, Any]:
    registry = get_registry()
    doc = registry.get_document(doc_id)
    if not doc:
        raise NotFoundError("No such document.")

    patch: dict[str, Any] = {"updated_at": now()}
    if title:
        patch["title"] = title.strip()
    if content is not None:
        cleaned = normalise(content)
        if not cleaned:
            raise ValidationError("Empty document.", public_message="الملف فارغ.")
        urls = extract_youtube_urls(cleaned)
        patch.update(
            {
                "content": cleaned,
                "char_count": len(cleaned),
                "video_urls": urls,
                "video_titles": video_titles(cleaned, urls, patch.get("title", doc["title"])),
                "version": int(doc.get("version") or 1) + 1,
            }
        )
    registry.update_document(doc_id, patch)
    return {**doc, **patch}


def delete_document(doc_id: str) -> None:
    registry = get_registry()
    if not registry.get_document(doc_id):
        raise NotFoundError("No such document.")
    # Vectors first: a record without vectors is a visible, fixable inconsistency, whereas
    # vectors without a record are retrievable content nobody can see or remove.
    vector_store.delete_document(doc_id)
    registry.delete_document(doc_id)
    logger.info("Deleted knowledge document", documentId=doc_id)


def to_summary(doc: dict[str, Any]) -> DocumentSummary:
    return DocumentSummary(
        id=doc["_id"],
        title=doc.get("title", ""),
        filename=doc.get("filename", ""),
        scope=Scope(doc.get("scope", Scope.GLOBAL.value)),
        tenant_id=None
        if doc.get("tenant_id") == vector_store.GLOBAL_TENANT_KEY
        else doc.get("tenant_id"),
        tenant_name=doc.get("tenant_name"),
        allowed_roles=list(doc.get("allowed_roles") or []),
        module=doc.get("module") or "GENERAL",
        page_key=doc.get("page_key"),
        language=doc.get("language") or "ar",
        version=int(doc.get("version") or 1),
        status=DocumentStatus(doc.get("status", DocumentStatus.PENDING.value)),
        error=doc.get("error"),
        chunk_count=int(doc.get("chunk_count") or 0),
        char_count=int(doc.get("char_count") or 0),
        video_urls=list(doc.get("video_urls") or []),
        uploaded_by=doc.get("uploaded_by") or "",
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        indexed_at=doc.get("indexed_at"),
    )


def to_detail(doc: dict[str, Any]) -> DocumentDetail:
    return DocumentDetail(
        **to_summary(doc).model_dump(),
        content=doc.get("content", ""),
        notes=doc.get("notes", ""),
        chunk_ids=list(doc.get("chunk_ids") or []),
    )

"""Where a knowledge document's record lives.

The vectors are in Qdrant; this is the catalogue beside them — what was uploaded, by whom,
for which company, whether indexing succeeded and why not. It is separate on purpose: the
Super Admin has to be able to see a document that *failed* to index, which by definition has
no vectors to be found by.

MongoDB, because the platform already runs one and this is one more database beside the
control plane and the tenants rather than a new piece of infrastructure. The in-memory
implementation exists so the test suite exercises the same calling code without a server.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any, Protocol

from ..config import settings
from ..errors import DependencyError
from ..logging_config import get_logger

logger = get_logger(__name__)

DOCUMENTS = "knowledge_documents"
EVENTS = "learning_events"


def now() -> datetime:
    return datetime.now(UTC)


class Registry(Protocol):
    def insert_document(self, doc: dict[str, Any]) -> None: ...
    def update_document(self, doc_id: str, patch: dict[str, Any]) -> None: ...
    def get_document(self, doc_id: str) -> dict[str, Any] | None: ...
    def delete_document(self, doc_id: str) -> bool: ...
    def list_documents(
        self, *, scope: str | None, tenant_id: str | None, limit: int, skip: int
    ) -> tuple[list[dict[str, Any]], int]: ...
    def record_event(self, event: dict[str, Any]) -> None: ...
    def update_event(self, interaction_id: str, patch: dict[str, Any]) -> bool: ...
    def analytics(self, *, days: int, tenant_id: str | None) -> dict[str, Any]: ...
    def ping(self) -> dict[str, Any]: ...


def _matches(doc: dict[str, Any], scope: str | None, tenant_id: str | None) -> bool:
    if scope and doc.get("scope") != scope:
        return False
    if tenant_id is not None and doc.get("tenant_id") != tenant_id:
        return False
    return True


class InMemoryRegistry:
    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}
        self._events: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def insert_document(self, doc: dict[str, Any]) -> None:
        with self._lock:
            self._docs[doc["_id"]] = dict(doc)

    def update_document(self, doc_id: str, patch: dict[str, Any]) -> None:
        with self._lock:
            if doc_id in self._docs:
                self._docs[doc_id].update(patch)

    def get_document(self, doc_id: str) -> dict[str, Any] | None:
        with self._lock:
            found = self._docs.get(doc_id)
            return dict(found) if found else None

    def delete_document(self, doc_id: str) -> bool:
        with self._lock:
            return self._docs.pop(doc_id, None) is not None

    def list_documents(
        self, *, scope: str | None, tenant_id: str | None, limit: int, skip: int
    ) -> tuple[list[dict[str, Any]], int]:
        with self._lock:
            rows = [d for d in self._docs.values() if _matches(d, scope, tenant_id)]
        rows.sort(key=lambda d: d.get("created_at") or now(), reverse=True)
        return [dict(r) for r in rows[skip : skip + limit]], len(rows)

    def record_event(self, event: dict[str, Any]) -> None:
        with self._lock:
            self._events.append(dict(event))

    def update_event(self, interaction_id: str, patch: dict[str, Any]) -> bool:
        with self._lock:
            for event in self._events:
                if event.get("interaction_id") == interaction_id:
                    event.update(patch)
                    return True
        return False

    def analytics(self, *, days: int, tenant_id: str | None) -> dict[str, Any]:
        cutoff = now().timestamp() - days * 86400
        with self._lock:
            events = [
                e
                for e in self._events
                if (e.get("at") or now()).timestamp() >= cutoff
                and (tenant_id is None or e.get("tenant_id") == tenant_id)
            ]
        return _summarise_events(events)

    def ping(self) -> dict[str, Any]:
        return {"ok": True, "driver": "memory", "error": None}


class MongoRegistry:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import MongoClient

        self._client = MongoClient(uri, serverSelectionTimeoutMS=5000, tz_aware=True)
        self._db = self._client[db_name]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        try:
            self._db[DOCUMENTS].create_index([("scope", 1), ("tenant_id", 1)])
            self._db[DOCUMENTS].create_index([("created_at", -1)])
            self._db[EVENTS].create_index([("at", -1)])
            self._db[EVENTS].create_index([("tenant_id", 1), ("at", -1)])
            self._db[EVENTS].create_index([("interaction_id", 1)])
        except Exception as exc:  # noqa: BLE001 - indexes are an optimisation, not a gate
            logger.warning("Could not create registry indexes", error=type(exc).__name__)

    def insert_document(self, doc: dict[str, Any]) -> None:
        self._db[DOCUMENTS].insert_one(dict(doc))

    def update_document(self, doc_id: str, patch: dict[str, Any]) -> None:
        self._db[DOCUMENTS].update_one({"_id": doc_id}, {"$set": patch})

    def get_document(self, doc_id: str) -> dict[str, Any] | None:
        return self._db[DOCUMENTS].find_one({"_id": doc_id})

    def delete_document(self, doc_id: str) -> bool:
        return self._db[DOCUMENTS].delete_one({"_id": doc_id}).deleted_count > 0

    def list_documents(
        self, *, scope: str | None, tenant_id: str | None, limit: int, skip: int
    ) -> tuple[list[dict[str, Any]], int]:
        where: dict[str, Any] = {}
        if scope:
            where["scope"] = scope
        if tenant_id is not None:
            where["tenant_id"] = tenant_id
        total = self._db[DOCUMENTS].count_documents(where)
        rows = list(self._db[DOCUMENTS].find(where).sort("created_at", -1).skip(skip).limit(limit))
        return rows, total

    def record_event(self, event: dict[str, Any]) -> None:
        self._db[EVENTS].insert_one(dict(event))

    def update_event(self, interaction_id: str, patch: dict[str, Any]) -> bool:
        result = self._db[EVENTS].update_one({"interaction_id": interaction_id}, {"$set": patch})
        return result.matched_count > 0

    def analytics(self, *, days: int, tenant_id: str | None) -> dict[str, Any]:
        from datetime import timedelta

        where: dict[str, Any] = {"at": {"$gte": now() - timedelta(days=days)}}
        if tenant_id:
            where["tenant_id"] = tenant_id
        # Capped rather than unbounded: this feeds a dashboard, not a data warehouse.
        events = list(self._db[EVENTS].find(where).sort("at", -1).limit(20000))
        return _summarise_events(events)

    def ping(self) -> dict[str, Any]:
        try:
            self._client.admin.command("ping")
            return {"ok": True, "driver": "mongodb", "error": None}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "driver": "mongodb", "error": type(exc).__name__}


def _summarise_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    """The dashboard's numbers, computed in one pass over recent events."""
    questions: dict[str, int] = {}
    pages: dict[str, int] = {}
    documents: dict[str, dict[str, Any]] = {}
    unanswered: list[dict[str, Any]] = []
    videos: dict[str, dict[str, Any]] = {}
    roles: dict[str, int] = {}
    tenants: dict[str, int] = {}
    totals = {
        "questions": 0,
        "grounded": 0,
        "ungrounded": 0,
        "speech_requests": 0,
        "helpful": 0,
        "not_helpful": 0,
        "video_clicks": 0,
    }

    for event in events:
        kind = event.get("kind")
        if kind == "CHAT":
            totals["questions"] += 1
            if event.get("grounded"):
                totals["grounded"] += 1
            else:
                totals["ungrounded"] += 1
                unanswered.append(
                    {
                        "question": (event.get("question") or "")[:200],
                        "page_key": event.get("page_key"),
                        "tenant_name": event.get("tenant_name"),
                        "role": event.get("role"),
                        "at": event.get("at"),
                    }
                )
            key = (event.get("question") or "").strip()[:160]
            if key:
                questions[key] = questions.get(key, 0) + 1
            page = event.get("page_key") or "unknown"
            pages[page] = pages.get(page, 0) + 1
            role = event.get("role") or "unknown"
            roles[role] = roles.get(role, 0) + 1
            tenant = event.get("tenant_name") or event.get("tenant_id") or "unknown"
            tenants[tenant] = tenants.get(tenant, 0) + 1
            for source in event.get("source_documents") or []:
                doc_id = source.get("document_id")
                if not doc_id:
                    continue
                row = documents.setdefault(
                    doc_id, {"document_id": doc_id, "title": source.get("title", ""), "uses": 0}
                )
                row["uses"] += 1
        elif kind == "SPEECH":
            totals["speech_requests"] += 1
        elif kind == "FEEDBACK":
            if event.get("helpful"):
                totals["helpful"] += 1
            else:
                totals["not_helpful"] += 1
        elif kind == "VIDEO_CLICK":
            totals["video_clicks"] += 1
            url = event.get("video_url")
            if url:
                row = videos.setdefault(
                    url, {"url": url, "title": event.get("video_title") or "", "clicks": 0}
                )
                row["clicks"] += 1

    def top(counts: dict[str, int], key_name: str) -> list[dict[str, Any]]:
        return [
            {key_name: k, "count": v}
            for k, v in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:15]
        ]

    return {
        "totals": totals,
        "top_questions": top(questions, "question"),
        "top_pages": top(pages, "page_key"),
        "by_role": top(roles, "role"),
        "by_tenant": top(tenants, "tenant"),
        "top_documents": sorted(documents.values(), key=lambda d: d["uses"], reverse=True)[:15],
        "top_videos": sorted(videos.values(), key=lambda v: v["clicks"], reverse=True)[:15],
        "unanswered": unanswered[:30],
    }


_registry: Registry | None = None
_registry_lock = threading.Lock()


def get_registry() -> Registry:
    global _registry
    if _registry is not None:
        return _registry
    with _registry_lock:
        if _registry is not None:
            return _registry
        if settings.REGISTRY_IN_MEMORY:
            _registry = InMemoryRegistry()
        else:
            try:
                _registry = MongoRegistry(settings.MONGODB_URI, settings.AI_DB_NAME)
            except Exception as exc:  # noqa: BLE001
                logger.error("Document registry unavailable", error=type(exc).__name__)
                raise DependencyError("The document registry is unavailable.") from exc
    return _registry


def reset_registry_for_tests() -> None:
    global _registry
    _registry = None

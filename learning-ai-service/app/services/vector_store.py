"""Qdrant, and the filter nobody can get past.

**One collection, filtered by payload — not a collection per tenant.** The reasoning:

* Every employee query has to search their company's procedures *and* the platform's own
  documentation in one ranked list. With a collection per tenant that is two searches and a
  hand-rolled merge; here it is one query whose filter says "mine or global".
* A Qdrant collection is not free — it carries its own segments and HNSW graph. A few hundred
  tenants of a dozen documents each would mean a few hundred mostly-empty indexes, which is
  the shape that falls over first.
* This mirrors what LockerFlow already does at the vector layer's own level of the stack:
  operational data is separated by *database*, and this is one index of explanatory text with
  a server-side filter, which is a different kind of thing with a different failure mode.

The trade is that isolation now rests on a filter rather than on a connection, so the filter
is treated as security code:

1. it is built in exactly one place, `access_filter`, from an `Actor` that came out of a
   signed token — there is no code path that builds a filter from a request body;
2. every hit is checked again after retrieval (`enforce_scope`), so a payload that does not
   match the caller is dropped even if the filter were somehow wrong;
3. the tests attack it directly at this layer rather than through the API.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, models

from ..config import settings
from ..domain import Role, Scope
from ..errors import DependencyError
from ..logging_config import get_logger
from ..security import Actor
from .embeddings import embedding_dimension

logger = get_logger(__name__)

#: Global documents need *a* value in the tenant field so one index answers both cases.
GLOBAL_TENANT_KEY = "__GLOBAL__"
#: A document with no role restriction carries this instead of an empty list, so "everyone"
#: and "nobody" cannot be confused by a missing field.
ANY_ROLE_KEY = "*"


@dataclass(frozen=True)
class Hit:
    id: str
    score: float
    document_id: str
    chunk_index: int
    title: str
    scope: Scope
    tenant_id: str
    tenant_name: str | None
    module: str
    page_key: str | None
    text: str
    video_urls: list[str]
    allowed_roles: list[str]


_lock = threading.Lock()
_client: QdrantClient | None = None
_ready = False
_last_error: str | None = None


def get_client() -> QdrantClient:
    global _client, _last_error
    if _client is not None:
        return _client
    with _lock:
        if _client is not None:
            return _client
        try:
            if settings.QDRANT_IN_MEMORY:
                _client = QdrantClient(location=":memory:")
            else:
                _client = QdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY or None,
                    timeout=int(settings.QDRANT_TIMEOUT_SECONDS),
                )
            _last_error = None
        except Exception as exc:  # noqa: BLE001
            _last_error = f"{type(exc).__name__}: {exc}"
            raise DependencyError("The vector database is unavailable.") from exc
    return _client


def ensure_collection() -> None:
    """Creates the collection and its payload indexes once, not per query."""
    global _ready, _last_error
    if _ready:
        return
    client = get_client()
    try:
        if not client.collection_exists(settings.QDRANT_COLLECTION):
            client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=models.VectorParams(
                    size=embedding_dimension(), distance=models.Distance.COSINE
                ),
            )
            logger.info("Created vector collection", collection=settings.QDRANT_COLLECTION)

        # Without these the filter still works but degrades to a scan, and the filter runs on
        # every single query — this is the difference between isolation being cheap and
        # isolation being the reason somebody is tempted to weaken it.
        #
        # Skipped for the in-memory client, which has no indexes and says so once per call.
        for field, schema in (
            ()
            if settings.QDRANT_IN_MEMORY
            else (
                ("tenant_id", models.PayloadSchemaType.KEYWORD),
                ("scope", models.PayloadSchemaType.KEYWORD),
                ("role_keys", models.PayloadSchemaType.KEYWORD),
                ("document_id", models.PayloadSchemaType.KEYWORD),
                ("module", models.PayloadSchemaType.KEYWORD),
                ("page_key", models.PayloadSchemaType.KEYWORD),
            )
        ):
            try:
                client.create_payload_index(
                    collection_name=settings.QDRANT_COLLECTION,
                    field_name=field,
                    field_schema=schema,
                    wait=True,
                )
            except Exception as exc:  # noqa: BLE001
                # Creating an index that already exists is the normal case on every restart.
                logger.debug("Payload index not created", field=field, error=type(exc).__name__)
        _ready = True
        _last_error = None
    except DependencyError:
        raise
    except Exception as exc:  # noqa: BLE001
        _last_error = f"{type(exc).__name__}: {exc}"
        raise DependencyError("The vector database could not be prepared.") from exc


def role_keys_for(allowed_roles: list[str]) -> list[str]:
    return sorted(set(allowed_roles)) if allowed_roles else [ANY_ROLE_KEY]


def access_filter(actor: Actor, *, page_key: str | None = None) -> models.Filter:
    """The only filter an employee query is ever run with.

    Reads the tenant and the role off the `Actor` — which came out of a signed token — and
    nothing else. `page_key` is a hint from the browser and therefore only ever *widens*
    ranking later; it never appears here, because a filter built from browser input is a
    filter an attacker helps build.
    """
    del page_key
    tenant_id = actor.require_tenant()
    role: Role = actor.require_role()

    # The scope alternatives are a nested filter inside `must` rather than a top-level
    # `should`, so the meaning is "role AND (mine OR global)" with no dependence on how a
    # particular Qdrant version combines a sibling `should` with a `must`.
    return models.Filter(
        must=[
            models.FieldCondition(
                key="role_keys",
                match=models.MatchAny(any=[ANY_ROLE_KEY, role.value]),
            ),
            models.Filter(
                should=[
                    # This company's own procedures.
                    models.Filter(
                        must=[
                            models.FieldCondition(
                                key="scope", match=models.MatchValue(value=Scope.TENANT.value)
                            ),
                            models.FieldCondition(
                                key="tenant_id", match=models.MatchValue(value=tenant_id)
                            ),
                        ]
                    ),
                    # LockerFlow's own documentation, which belongs to everybody.
                    models.Filter(
                        must=[
                            models.FieldCondition(
                                key="scope", match=models.MatchValue(value=Scope.GLOBAL.value)
                            ),
                            models.FieldCondition(
                                key="tenant_id",
                                match=models.MatchValue(value=GLOBAL_TENANT_KEY),
                            ),
                        ]
                    ),
                ]
            ),
        ],
    )


def enforce_scope(actor: Actor, hits: list[Hit]) -> list[Hit]:
    """The second fence. Cheap, and the reason a filter bug is not a data breach."""
    tenant_id = actor.require_tenant()
    role = actor.require_role().value
    kept: list[Hit] = []
    for hit in hits:
        if hit.scope is Scope.TENANT and hit.tenant_id != tenant_id:
            logger.error(
                "Dropped a cross-tenant hit after retrieval",
                documentId=hit.document_id,
                hitTenant=hit.tenant_id,
                **actor.log_fields(),
            )
            continue
        if hit.scope is Scope.GLOBAL and hit.tenant_id != GLOBAL_TENANT_KEY:
            continue
        if hit.allowed_roles and role not in hit.allowed_roles:
            logger.error(
                "Dropped a role-restricted hit after retrieval",
                documentId=hit.document_id,
                **actor.log_fields(),
            )
            continue
        kept.append(hit)
    return kept


def _point_id(document_id: str, chunk_index: int) -> str:
    # Qdrant point ids are UUIDs or unsigned integers, so the readable id is folded into a
    # deterministic UUID5 — re-indexing a document then overwrites its own points instead of
    # accumulating a second copy beside them.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"lockerflow-knowledge/{document_id}/{chunk_index}"))


def upsert_chunks(
    *,
    document_id: str,
    vectors: list[list[float]],
    payloads: list[dict[str, Any]],
) -> list[str]:
    ensure_collection()
    client = get_client()
    ids = [_point_id(document_id, i) for i in range(len(vectors))]
    client.upsert(
        collection_name=settings.QDRANT_COLLECTION,
        points=models.Batch(ids=ids, vectors=vectors, payloads=payloads),
        wait=True,
    )
    return ids


def delete_document(document_id: str) -> None:
    ensure_collection()
    get_client().delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id", match=models.MatchValue(value=document_id)
                    )
                ]
            )
        ),
        wait=True,
    )


def _to_hit(point: Any) -> Hit:
    payload = point.payload or {}
    scope_raw = str(payload.get("scope") or Scope.GLOBAL.value)
    return Hit(
        id=str(point.id),
        score=float(getattr(point, "score", 0.0) or 0.0),
        document_id=str(payload.get("document_id") or ""),
        chunk_index=int(payload.get("chunk_index") or 0),
        title=str(payload.get("title") or ""),
        scope=Scope(scope_raw) if scope_raw in Scope.__members__ else Scope.GLOBAL,
        tenant_id=str(payload.get("tenant_id") or ""),
        tenant_name=payload.get("tenant_name") or None,
        module=str(payload.get("module") or "GENERAL"),
        page_key=payload.get("page_key") or None,
        text=str(payload.get("text") or ""),
        video_urls=list(payload.get("video_urls") or []),
        allowed_roles=[r for r in (payload.get("allowed_roles") or []) if r],
    )


def search(
    *,
    actor: Actor,
    vector: list[float],
    limit: int,
) -> list[Hit]:
    """A filtered nearest-neighbour search. The filter is not optional and not a parameter."""
    ensure_collection()
    client = get_client()
    try:
        found = client.query_points(
            collection_name=settings.QDRANT_COLLECTION,
            query=vector,
            query_filter=access_filter(actor),
            limit=limit,
            with_payload=True,
        ).points
    except Exception as exc:  # noqa: BLE001
        logger.error("Vector search failed", error=f"{type(exc).__name__}")
        raise DependencyError("The knowledge index could not be searched.") from exc

    return enforce_scope(actor, [_to_hit(p) for p in found])


def collection_status() -> dict[str, Any]:
    try:
        client = get_client()
        exists = client.collection_exists(settings.QDRANT_COLLECTION)
        count = client.count(settings.QDRANT_COLLECTION, exact=False).count if exists else 0
        return {
            "url": settings.QDRANT_URL if not settings.QDRANT_IN_MEMORY else ":memory:",
            "collection": settings.QDRANT_COLLECTION,
            "exists": exists,
            "points": count,
            "ok": True,
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "url": settings.QDRANT_URL if not settings.QDRANT_IN_MEMORY else ":memory:",
            "collection": settings.QDRANT_COLLECTION,
            "exists": False,
            "points": 0,
            "ok": False,
            "error": type(exc).__name__,
        }


def reset_client_for_tests() -> None:
    global _client, _ready, _last_error
    _client = None
    _ready = False
    _last_error = None

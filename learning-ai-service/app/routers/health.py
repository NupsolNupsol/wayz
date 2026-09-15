"""Liveness and readiness.

`/health` answers "is the process up" and is the container's health check — it must not
touch Qdrant, because a vector database that is briefly unreachable is not a reason to
restart this service. `/health/ready` answers the operator's question: which dependency is
missing right now. Neither ever prints a URL with credentials in it or a key.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..services.embeddings import embedder_status
from ..services.llm import llm_status
from ..services.registry import get_registry
from ..services.tts import tts_status
from ..services.vector_store import collection_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "service": settings.APP_NAME, "environment": settings.ENVIRONMENT}


@router.get("/health/ready")
def ready() -> dict[str, object]:
    qdrant = collection_status()
    try:
        registry = get_registry().ping()
    except Exception as exc:  # noqa: BLE001
        registry = {"ok": False, "driver": "unknown", "error": type(exc).__name__}

    llm = llm_status()
    checks = {
        "qdrant": qdrant,
        "registry": registry,
        "embeddings": embedder_status(),
        "llm": llm,
        "tts": tts_status(),
        "serviceAuth": {"configured": bool(settings.AI_SERVICE_SECRET)},
    }
    # Ready means a question can be answered: index reachable, model configured, secret set.
    ready_now = (
        bool(qdrant.get("ok"))
        and bool(registry.get("ok"))
        and bool(llm.get("configured"))
        and bool(settings.AI_SERVICE_SECRET)
    )
    return {"status": "ready" if ready_now else "degraded", "checks": checks}

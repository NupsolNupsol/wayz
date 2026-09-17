"""Loads the starter knowledge into a fresh AI stack.

    docker compose exec learning-ai python -m app.seed_knowledge

A new deployment of this service has its own, empty MongoDB and Qdrant. Until something is
indexed, the assistant still answers — but from nothing, so it can cite nothing, and an
employee who asks how a screen works gets a polite shrug. This puts the three documents in
`knowledge-samples/` in place, scoped exactly as that folder's README describes, so a fresh
install can be seen working end to end before anybody writes real documentation.

It goes through the same `create_document` and `index_document` the upload endpoint uses, so
what it produces is indistinguishable from an administrator's upload — the same chunking, the
same embedding, the same scope and role filtering.

Run it as often as you like. A document already present — same title, same scope, same
organisation — is left alone, so a second run adds nothing and a re-deploy does not duplicate.

The organisation the two company-specific samples belong to is `KNOWLEDGE_SEED_TENANT_ID`
(default `wayz`). These are illustrations, not policy: replace them with real documents from
the platform console.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

from .domain import ActorKind, Scope
from .logging_config import get_logger
from .schemas.documents import DocumentCreate
from .security import Actor
from .services import documents as docs
from .services.registry import get_registry
from .services.vector_store import GLOBAL_TENANT_KEY, ensure_collection

logger = get_logger(__name__)

SAMPLES = Path(__file__).resolve().parent.parent / "knowledge-samples"

TENANT_ID = os.environ.get("KNOWLEDGE_SEED_TENANT_ID", "wayz")
TENANT_NAME = os.environ.get("KNOWLEDGE_SEED_TENANT_NAME", TENANT_ID.upper())


@dataclass(frozen=True)
class Starter:
    filename: str
    scope: Scope
    module: str
    page_key: str | None = None
    roles: tuple[str, ...] = ()


# Exactly the table in knowledge-samples/README.md.
STARTERS: tuple[Starter, ...] = (
    Starter("global-delivery-handover.txt", Scope.GLOBAL, "DELIVERY", "agent.delivery.details"),
    Starter("tenant-discount-policy.txt", Scope.TENANT, "ADMIN"),
    Starter("tenant-accounting-reversals.txt", Scope.TENANT, "ACCOUNTING", roles=("ACCOUNTANT", "TENANT_ADMIN")),
)

# Whoever runs the seed is the platform, acting without a request.
SEEDER = Actor(
    kind=ActorKind.PLATFORM_ADMIN,
    subject="knowledge-seed",
    tenant_id=None,
    tenant_slug=None,
    tenant_name=None,
    role=None,
    locale="ar",
    display_name="Knowledge seed",
)


def _title_of(text: str, fallback: str) -> str:
    """The first line is the title — see the samples README."""
    first = next((line.strip() for line in text.splitlines() if line.strip()), "")
    return (first or fallback)[:200]


def _already_there(title: str, scope: Scope) -> bool:
    tenant_key = TENANT_ID if scope is Scope.TENANT else GLOBAL_TENANT_KEY
    rows, _ = get_registry().list_documents(scope=scope.value, tenant_id=tenant_key, limit=500, skip=0)
    return any(row.get("title") == title for row in rows)


def seed() -> int:
    if not SAMPLES.is_dir():
        logger.error("No knowledge-samples folder in this image", path=str(SAMPLES))
        return 1

    ensure_collection()
    added = skipped = failed = 0

    for starter in STARTERS:
        path = SAMPLES / starter.filename
        if not path.is_file():
            logger.error("Starter document missing", filename=starter.filename)
            failed += 1
            continue

        text = path.read_text(encoding="utf-8-sig")
        title = _title_of(text, starter.filename)

        if _already_there(title, starter.scope):
            skipped += 1
            print(f"  exists   {starter.scope.value:<6} {title}")
            continue

        payload = DocumentCreate(
            title=title,
            content=text,
            scope=starter.scope,
            tenant_id=TENANT_ID if starter.scope is Scope.TENANT else None,
            tenant_name=TENANT_NAME if starter.scope is Scope.TENANT else None,
            filename=starter.filename,
            allowed_roles=list(starter.roles),
            module=starter.module,
            page_key=starter.page_key,
            language="ar",
            notes="Starter document from knowledge-samples. Replace with real documentation.",
        )
        doc = docs.create_document(payload, SEEDER)
        try:
            indexed = docs.index_document(doc["_id"])
        except Exception as exc:  # noqa: BLE001 - recorded on the document; reported here
            failed += 1
            print(f"  FAILED   {starter.scope.value:<6} {title}  — {type(exc).__name__}: {exc}")
            continue

        added += 1
        print(f"  added    {starter.scope.value:<6} {title}  ({indexed.get('chunk_count', '?')} chunks)")

    print(f"\n{added} added, {skipped} already present, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(seed())

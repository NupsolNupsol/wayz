"""Test wiring.

The environment is set before `app` is imported anywhere, because settings are read once at
import. Three substitutions make the suite fast and free without weakening what it proves:

* a hashing embedder instead of BGE-M3 — the isolation tests are about *filters*, and a
  filter does not care how a vector was produced;
* Qdrant in memory — the same client and the same filter code, no container;
* the echo LLM — the tests assert on what reaches the model, which is the part that can leak.

Retrieval, ingestion, scoping and authorisation are all exercised for real.
"""

from __future__ import annotations

import os

os.environ.setdefault("AI_SERVICE_SECRET", "test-secret-at-least-32-characters-long!!")
os.environ.setdefault("EMBEDDING_FAKE", "true")
os.environ.setdefault("QDRANT_IN_MEMORY", "true")
os.environ.setdefault("REGISTRY_IN_MEMORY", "true")
os.environ.setdefault("LLM_PROVIDER", "echo")
os.environ.setdefault("TTS_PROVIDER", "none")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("LOG_LEVEL", "WARNING")
# The hashing embedder scores a real match around 0.20-0.40 and hash-collision noise
# around 0.05, so the floor sits between them. The production default (0.30) is tuned
# for BGE-M3 cosine similarity, which is a different scale.
os.environ.setdefault("RETRIEVAL_MIN_SCORE", "0.15")
os.environ.setdefault("QDRANT_COLLECTION", "test_knowledge")

import time  # noqa: E402
import uuid  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.domain import ActorKind, Role, Scope  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.documents import DocumentCreate  # noqa: E402
from app.security import Actor  # noqa: E402
from app.services import registry as registry_module  # noqa: E402
from app.services import vector_store  # noqa: E402
from app.services.documents import create_document, index_document  # noqa: E402

TENANT_A = "tnt_alpha"
TENANT_B = "tnt_beta"

#: The sentence the isolation tests hunt for. If it ever appears in tenant B's results the
#: product has a data breach, not a bug.
SECRET_A = "الرمز السري لشركة ألفا هو زعفران-7741 ولا يجوز مشاركته"
SECRET_B = "الرمز السري لشركة بيتا هو ياقوت-9920 ولا يجوز مشاركته"


def service_token(
    *,
    kind: ActorKind = ActorKind.EMPLOYEE,
    subject: str = "usr_1",
    tenant_id: str | None = TENANT_A,
    tenant_slug: str | None = "alpha",
    tenant_name: str | None = "شركة ألفا",
    role: Role | None = Role.AGENT,
    secret: str | None = None,
    expires_in: int = 120,
    audience: str | None = None,
    issuer: str | None = None,
) -> str:
    """Mints exactly what the LockerFlow Node API mints, so the tests attack the real path."""
    issued = int(time.time())
    claims = {
        "iss": issuer or settings.AI_SERVICE_ISSUER,
        "aud": audience or settings.AI_SERVICE_AUDIENCE,
        "sub": subject,
        "iat": issued,
        "exp": issued + expires_in,
        "jti": uuid.uuid4().hex,
        "ctx": {
            "kind": kind.value,
            "tenantId": tenant_id,
            "tenantSlug": tenant_slug,
            "tenantName": tenant_name,
            "role": role.value if role else None,
            "locale": "ar",
            "displayName": "Test User",
        },
    }
    return jwt.encode(claims, secret or settings.AI_SERVICE_SECRET, algorithm="HS256")


def auth(**kwargs) -> dict[str, str]:
    return {"Authorization": f"Bearer {service_token(**kwargs)}"}


def employee(
    tenant_id: str = TENANT_A,
    role: Role = Role.AGENT,
    tenant_name: str = "شركة ألفا",
) -> Actor:
    return Actor(
        kind=ActorKind.EMPLOYEE,
        subject="usr_test",
        tenant_id=tenant_id,
        tenant_slug=tenant_id,
        tenant_name=tenant_name,
        role=role,
        locale="ar",
        display_name="Test",
    )


@pytest.fixture(autouse=True)
def clean_state():
    """A fresh index and a fresh catalogue for every test — no order dependence."""
    registry_module.reset_registry_for_tests()
    vector_store.reset_client_for_tests()
    yield
    registry_module.reset_registry_for_tests()
    vector_store.reset_client_for_tests()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def ingest(
    *,
    title: str,
    content: str,
    scope: Scope = Scope.TENANT,
    tenant_id: str | None = TENANT_A,
    tenant_name: str | None = "شركة ألفا",
    allowed_roles: list[str] | None = None,
    module: str = "GENERAL",
    page_key: str | None = None,
) -> str:
    payload = DocumentCreate(
        title=title,
        content=content,
        scope=scope,
        tenant_id=tenant_id if scope is Scope.TENANT else None,
        tenant_name=tenant_name if scope is Scope.TENANT else None,
        allowed_roles=allowed_roles or [],
        module=module,
        page_key=page_key,
        filename="doc.txt",
    )
    admin = Actor(
        kind=ActorKind.PLATFORM_ADMIN,
        subject="padm_1",
        tenant_id=None,
        tenant_slug=None,
        tenant_name=None,
        role=None,
        locale="en",
        display_name="Super Admin",
    )
    doc = create_document(payload, admin)
    index_document(doc["_id"])
    return doc["_id"]

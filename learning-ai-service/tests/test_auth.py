"""Nobody talks to this service without a token the LockerFlow API signed.

Also the separation between the two populations: a tenant employee cannot manage knowledge,
and a platform administrator cannot ask an employee's question — because they have no tenant,
so there is no correct set of documents for them to be answered from.
"""

from __future__ import annotations

import time

import jwt
import pytest

from app.config import settings
from app.domain import ActorKind, Role
from app.errors import AuthError
from app.security import verify_service_token
from tests.conftest import auth, service_token


def _admin_headers() -> dict[str, str]:
    return auth(kind=ActorKind.PLATFORM_ADMIN, subject="padm_1", tenant_id=None, role=None)


@pytest.mark.parametrize(
    "path,method",
    [
        ("/v1/chat", "post"),
        ("/v1/speech", "post"),
        ("/v1/documents", "get"),
        ("/v1/documents", "post"),
        ("/v1/analytics", "get"),
    ],
)
def test_requests_without_a_token_are_rejected(client, path, method):
    response = client.request(method, path, json={} if method == "post" else None)
    assert response.status_code == 401


def test_a_token_signed_with_the_wrong_secret_is_rejected(client):
    headers = {"Authorization": f"Bearer {service_token(secret='a-completely-different-secret')}"}
    assert client.post("/v1/chat", json={"question": "مرحبا"}, headers=headers).status_code == 401


def test_an_expired_token_is_rejected(client):
    headers = {"Authorization": f"Bearer {service_token(expires_in=-600)}"}
    assert client.post("/v1/chat", json={"question": "مرحبا"}, headers=headers).status_code == 401


def test_a_token_for_another_audience_is_rejected():
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {service_token(audience='some-other-service')}")


def test_a_token_from_another_issuer_is_rejected():
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {service_token(issuer='not-lockerflow')}")


def test_an_unsigned_token_is_rejected():
    unsigned = jwt.encode(
        {
            "iss": settings.AI_SERVICE_ISSUER,
            "aud": settings.AI_SERVICE_AUDIENCE,
            "sub": "usr_1",
            "iat": int(time.time()),
            "exp": int(time.time()) + 60,
            "ctx": {"kind": "EMPLOYEE", "tenantId": "tnt_x", "role": "AGENT"},
        },
        key="",
        algorithm="none",
    )
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {unsigned}")


def test_an_employee_token_without_a_tenant_is_rejected():
    """The failure mode this guards against is "reads everybody's documents"."""
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {service_token(tenant_id=None)}")


def test_an_employee_token_without_a_role_is_rejected():
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {service_token(role=None)}")


def test_an_unknown_role_is_rejected():
    issued = int(time.time())
    token = jwt.encode(
        {
            "iss": settings.AI_SERVICE_ISSUER,
            "aud": settings.AI_SERVICE_AUDIENCE,
            "sub": "usr_1",
            "iat": issued,
            "exp": issued + 60,
            "ctx": {"kind": "EMPLOYEE", "tenantId": "tnt_x", "role": "ROOT"},
        },
        settings.AI_SERVICE_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(AuthError):
        verify_service_token(f"Bearer {token}")


def test_a_platform_admin_token_never_carries_a_tenant_even_if_one_is_sent():
    actor = verify_service_token(
        f"Bearer {service_token(kind=ActorKind.PLATFORM_ADMIN, tenant_id='tnt_smuggled', role=Role.TENANT_ADMIN)}"
    )
    assert actor.is_platform_admin
    assert actor.tenant_id is None
    assert actor.role is None


def test_an_employee_cannot_manage_knowledge(client):
    for path, method in (("/v1/documents", "get"), ("/v1/analytics", "get")):
        response = getattr(client, method)(path, headers=auth())
        assert response.status_code == 403, path


def test_a_tenant_admin_is_still_only_an_employee_here(client):
    response = client.get("/v1/documents", headers=auth(role=Role.TENANT_ADMIN))
    assert response.status_code == 403


def test_a_platform_admin_cannot_ask_an_employee_question(client):
    response = client.post("/v1/chat", json={"question": "مرحبا"}, headers=_admin_headers())
    assert response.status_code == 403


def test_whoami_reports_the_signed_identity_not_a_claimed_one(client):
    response = client.get("/v1/whoami", headers=auth(tenant_id="tnt_alpha", role=Role.HR))
    assert response.status_code == 200
    assert response.json() == {
        "kind": "EMPLOYEE",
        "subject": "usr_1",
        "tenantId": "tnt_alpha",
        "tenantSlug": "alpha",
        "role": "HR",
        "locale": "ar",
    }


def test_health_needs_no_token(client):
    assert client.get("/health").status_code == 200


def test_logging_never_raises_on_a_reserved_or_duplicate_field():
    """A log line must not be able to fail a request.

    Found the hard way: a router logged both the document's tenant and the actor's under the
    same key and every upload returned a 500. Reserved LogRecord names (`module`, `name`,
    `filename`) are the same hazard from the other direction.
    """
    from app.logging_config import get_logger

    logger = get_logger("test")
    logger.info("reserved names are renamed", module="DELIVERY", name="x", filename="y")
    logger.error("unserialisable values are stringified", payload=object())

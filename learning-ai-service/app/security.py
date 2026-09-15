"""Who is asking, and how this service knows.

The browser never reaches this service. Every request arrives from the LockerFlow Node API
carrying a short-lived token that the API signed with a secret the two share, and the actor —
tenant, role, identity — is read out of that signature.

This is the whole basis of tenant isolation, so it is deliberately narrow:

* a `tenant_id` in a request body is not read by anything; only the signed one exists
* the token is rejected unless the issuer, the audience and the expiry all match
* an employee token with no tenant is refused outright — there is no "global employee"
* a platform-admin token carries no tenant and can never be used to run a chat query

`jwt` here is PyJWT; the Node side signs with HS256 and the same secret.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Header, Request

from .config import settings
from .domain import ActorKind, Role
from .errors import AuthError, ForbiddenError


@dataclass(frozen=True)
class Actor:
    """The trusted identity behind a request. Built only by `verify_service_token`."""

    kind: ActorKind
    subject: str
    tenant_id: str | None
    tenant_slug: str | None
    tenant_name: str | None
    role: Role | None
    locale: str
    display_name: str

    @property
    def is_platform_admin(self) -> bool:
        return self.kind is ActorKind.PLATFORM_ADMIN

    def require_tenant(self) -> str:
        if not self.tenant_id:
            raise ForbiddenError("Actor has no tenant.")
        return self.tenant_id

    def require_role(self) -> Role:
        if self.role is None:
            raise ForbiddenError("Actor has no role.")
        return self.role

    def log_fields(self) -> dict[str, Any]:
        """What may be written to a log line about this actor. No names, no e-mail."""
        return {
            "actorKind": self.kind.value,
            "actorId": self.subject,
            "tenantId": self.tenant_id,
            "role": self.role.value if self.role else None,
        }


def _decode(token: str) -> dict[str, Any]:
    if not settings.AI_SERVICE_SECRET:
        # Refusing everybody beats trusting everybody: a service started without its shared
        # secret has no way to tell LockerFlow from anyone else who can reach the port.
        raise AuthError("AI_SERVICE_SECRET is not configured.")
    try:
        return jwt.decode(
            token,
            settings.AI_SERVICE_SECRET,
            algorithms=["HS256"],
            audience=settings.AI_SERVICE_AUDIENCE,
            issuer=settings.AI_SERVICE_ISSUER,
            leeway=settings.AI_SERVICE_LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "aud", "iss", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthError(f"Rejected service token: {type(exc).__name__}") from exc


def actor_from_claims(claims: dict[str, Any]) -> Actor:
    ctx = claims.get("ctx")
    if not isinstance(ctx, dict):
        raise AuthError("Service token carries no actor context.")

    try:
        kind = ActorKind(str(ctx.get("kind", "")))
    except ValueError as exc:
        raise AuthError("Unknown actor kind.") from exc

    role_raw = ctx.get("role")
    role: Role | None = None
    if role_raw:
        try:
            role = Role(str(role_raw))
        except ValueError as exc:
            raise AuthError("Unknown role in service token.") from exc

    tenant_id = ctx.get("tenantId") or None

    if kind is ActorKind.EMPLOYEE:
        # An employee without a tenant could only ever be a bug, and the shape of that bug
        # is "reads everybody's documents". It stops here.
        if not tenant_id or role is None:
            raise AuthError("An employee token must carry both a tenant and a role.")
    else:
        # A control-plane administrator manages knowledge; they never hold a tenant seat, so
        # a tenant on this token would be a claim nobody is entitled to make.
        tenant_id = None
        role = None

    return Actor(
        kind=kind,
        subject=str(claims["sub"]),
        tenant_id=tenant_id,
        tenant_slug=(ctx.get("tenantSlug") or None) if tenant_id else None,
        tenant_name=(ctx.get("tenantName") or None) if tenant_id else None,
        role=role,
        locale=str(ctx.get("locale") or "ar"),
        display_name=str(ctx.get("displayName") or ""),
    )


def verify_service_token(authorization: str | None) -> Actor:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("Missing service bearer token.")
    return actor_from_claims(_decode(authorization[7:].strip()))


# ----------------------------------------------------------------- FastAPI dependencies


async def current_actor(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Actor:
    actor = verify_service_token(authorization)
    request.state.actor = actor
    return actor


async def current_platform_admin(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Actor:
    actor = await current_actor(request, authorization)
    if not actor.is_platform_admin:
        raise ForbiddenError("This endpoint is for platform administrators.")
    return actor


async def current_employee(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Actor:
    actor = await current_actor(request, authorization)
    if actor.is_platform_admin:
        raise ForbiddenError("This endpoint is for tenant employees.")
    return actor

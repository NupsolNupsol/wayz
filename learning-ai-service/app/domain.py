"""The vocabulary this service shares with LockerFlow.

Roles are copied from the Node API's `src/domain/types.ts` rather than invented here, so a
document restricted to `ACCOUNTANT` means the same thing on both sides of the wire. Adding a
role to LockerFlow means adding it here; anything unknown is refused at ingestion rather than
silently becoming a document nobody can read.
"""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    AGENT = "AGENT"
    DELIVERY_AGENT = "DELIVERY_AGENT"
    SUPERVISOR = "SUPERVISOR"
    CHIEF_CAPTAIN = "CHIEF_CAPTAIN"
    MANAGER = "MANAGER"
    PROJECT_MANAGER = "PROJECT_MANAGER"
    HR = "HR"
    ACCOUNTANT = "ACCOUNTANT"
    TENANT_ADMIN = "TENANT_ADMIN"


ALL_ROLES: tuple[str, ...] = tuple(r.value for r in Role)


class Scope(str, Enum):
    """Whose knowledge a document is.

    GLOBAL is the platform explaining itself — how a booking works, what a shift is. Every
    tenant may read it, subject to the role list on the document. TENANT is one company's own
    procedure and is readable by that company and by nobody else, ever.
    """

    GLOBAL = "GLOBAL"
    TENANT = "TENANT"


class DocumentStatus(str, Enum):
    PENDING = "PENDING"
    INDEXING = "INDEXING"
    INDEXED = "INDEXED"
    FAILED = "FAILED"


class ActorKind(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    PLATFORM_ADMIN = "PLATFORM_ADMIN"


#: Modules mirror the LockerFlow navigation groups. Free text is accepted too — this is the
#: list the Super Admin form offers, not a closed set the database enforces.
KNOWN_MODULES: tuple[str, ...] = (
    "GENERAL",
    "POS",
    "BOOKINGS",
    "STORAGE",
    "MOBILITY",
    "LAGOON",
    "DELIVERY",
    "GATE",
    "TILL",
    "SHIFTS",
    "INCIDENTS",
    "CUSTOMERS",
    "ASSETS",
    "MANAGER",
    "ACCOUNTING",
    "HR",
    "ADMIN",
    "ONBOARDING",
)

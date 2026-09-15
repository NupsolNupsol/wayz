"""A document restricted to some roles is invisible to the rest of the same company.

Sharing a tenant is not the same as being entitled to read everything in it — an accounting
policy is not an agent's business even though both work for the same employer.
"""

from __future__ import annotations

import pytest

from app.domain import Role
from app.services.retrieval import retrieve
from tests.conftest import TENANT_A, employee, ingest

POLICY = "سياسة الخصومات المحاسبية تتطلب موافقة المدير المالي قبل أي قيد عكسي."


@pytest.fixture
def accounting_only():
    ingest(
        title="سياسة المحاسبة الداخلية",
        content=f"سياسة المحاسبة\n\n{POLICY}",
        tenant_id=TENANT_A,
        allowed_roles=["ACCOUNTANT", "TENANT_ADMIN"],
        module="ACCOUNTING",
    )


def test_agent_cannot_retrieve_an_accounting_document(accounting_only):
    evidence = retrieve(employee(TENANT_A, Role.AGENT), "سياسة الخصومات المحاسبية", None)
    assert POLICY not in evidence.context_block
    assert evidence.sources == []


@pytest.mark.parametrize("role", [Role.ACCOUNTANT, Role.TENANT_ADMIN])
def test_listed_roles_can_retrieve_it(accounting_only, role):
    evidence = retrieve(employee(TENANT_A, role), "سياسة الخصومات المحاسبية", None)
    assert POLICY in evidence.context_block


def test_a_document_with_no_role_list_is_for_everyone():
    ingest(
        title="دليل عام",
        content="تعليمات عامة\n\nيبدأ الموظف يومه بتسجيل الدخول ثم فتح الوردية.",
        tenant_id=TENANT_A,
    )
    for role in (Role.AGENT, Role.HR, Role.CHIEF_CAPTAIN, Role.DELIVERY_AGENT):
        evidence = retrieve(employee(TENANT_A, role), "كيف يبدأ الموظف يومه", None)
        assert evidence.sources, role.value


def test_unknown_role_is_refused_at_ingestion():
    from pydantic import ValidationError as PydanticValidationError

    from app.domain import Scope
    from app.schemas.documents import DocumentCreate

    with pytest.raises(PydanticValidationError):
        DocumentCreate(
            title="خطأ",
            content="نص",
            scope=Scope.GLOBAL,
            allowed_roles=["SUPER_HERO"],
        )

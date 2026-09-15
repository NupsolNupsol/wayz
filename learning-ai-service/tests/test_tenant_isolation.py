"""Tenant A's documents are unreachable from tenant B. This is the release blocker.

Tested at the *retrieval* layer, not through the API, because that is where the guarantee
actually lives. An API test proves the route is wired up; this proves that no vector belonging
to another company can be returned to a caller, which is the thing that must be true even if
somebody later adds a new route.
"""

from __future__ import annotations

import pytest

from app.domain import Role, Scope
from app.schemas.chat import ChatRequest
from app.services.chat import answer
from app.services.retrieval import retrieve
from tests.conftest import SECRET_A, SECRET_B, TENANT_A, TENANT_B, employee, ingest


@pytest.fixture
def two_tenants():
    ingest(
        title="إجراء ألفا السري",
        content=f"إجراء داخلي لشركة ألفا.\n\n{SECRET_A}\n\nيطبق على جميع الفروع.",
        tenant_id=TENANT_A,
        tenant_name="شركة ألفا",
    )
    ingest(
        title="إجراء بيتا السري",
        content=f"إجراء داخلي لشركة بيتا.\n\n{SECRET_B}\n\nيطبق على جميع الفروع.",
        tenant_id=TENANT_B,
        tenant_name="شركة بيتا",
    )


def test_tenant_b_never_sees_tenant_a_secret(two_tenants):
    evidence = retrieve(employee(TENANT_B, tenant_name="شركة بيتا"), SECRET_A, None)

    assert SECRET_A not in evidence.context_block
    assert all(h.tenant_id != TENANT_A for h in evidence.hits)
    assert all("ألفا" not in s.title for s in evidence.sources)


def test_tenant_a_sees_its_own_secret(two_tenants):
    evidence = retrieve(employee(TENANT_A), SECRET_A, None)

    assert SECRET_A in evidence.context_block
    assert any(h.tenant_id == TENANT_A for h in evidence.hits)


def test_each_tenant_only_ever_gets_its_own(two_tenants):
    for tenant, mine, theirs in ((TENANT_A, SECRET_A, SECRET_B), (TENANT_B, SECRET_B, SECRET_A)):
        evidence = retrieve(employee(tenant), "ما هو الرمز السري للشركة؟", None)
        assert theirs not in evidence.context_block
        assert all(h.scope is Scope.GLOBAL or h.tenant_id == tenant for h in evidence.hits)
        del mine


def test_answer_for_tenant_b_cannot_quote_tenant_a(two_tenants):
    """End to end with the echo provider, which returns the prompt it was handed.

    That makes the assertion strong rather than weak: if the other tenant's sentence were
    anywhere in the model's input, it would be in this answer.
    """
    response = answer(
        employee(TENANT_B, tenant_name="شركة بيتا"),
        ChatRequest(question=f"اشرح لي هذا: {SECRET_A}"),
    )
    assert SECRET_A not in response.answer.replace(f"اشرح لي هذا: {SECRET_A}", "")


def test_global_documents_reach_every_tenant():
    ingest(
        title="دليل الحجوزات في LockerFlow",
        content="إنشاء حجز جديد\n\nيمكن للموظف إنشاء حجز جديد من صفحة الحجوزات ثم اختيار العميل.",
        scope=Scope.GLOBAL,
        tenant_id=None,
        tenant_name=None,
    )
    for tenant in (TENANT_A, TENANT_B):
        evidence = retrieve(employee(tenant), "كيف أنشئ حجز جديد", None)
        assert any(s.scope is Scope.GLOBAL for s in evidence.sources), tenant


def test_tenant_procedure_outranks_global_at_equal_relevance():
    text = "تسليم الطلب\n\nيتم تسليم الطلب بعد التحقق من هوية العميل ثم تأكيد الاستلام."
    ingest(
        title="دليل LockerFlow للتسليم",
        content=text,
        scope=Scope.GLOBAL,
        tenant_id=None,
        tenant_name=None,
    )
    ingest(title="إجراء ألفا للتسليم", content=text, tenant_id=TENANT_A)

    evidence = retrieve(employee(TENANT_A), "كيف يتم تسليم الطلب", None)

    assert evidence.sources[0].scope is Scope.TENANT


def test_deleted_documents_disappear_from_retrieval():
    from app.services.documents import delete_document

    doc_id = ingest(
        title="إجراء مؤقت",
        content=f"إجراء سيُحذف.\n\n{SECRET_A}",
        tenant_id=TENANT_A,
    )
    assert SECRET_A in retrieve(employee(TENANT_A), SECRET_A, None).context_block

    delete_document(doc_id)

    assert SECRET_A not in retrieve(employee(TENANT_A), SECRET_A, None).context_block


def test_empty_knowledge_base_returns_nothing_rather_than_anything():
    evidence = retrieve(employee(TENANT_A), "كيف أغلق الوردية؟", None)
    assert evidence.hits == []
    assert evidence.sources == []


def test_post_retrieval_fence_drops_a_foreign_hit_even_if_the_filter_missed_it():
    """The second fence, tested on its own.

    `enforce_scope` exists so that a mistake in filter construction is a dropped result and a
    logged error rather than a leak. It is checked directly because a bug in the filter would
    otherwise hide the fact that this net has a hole in it too.
    """
    from app.services.vector_store import Hit, enforce_scope

    foreign = Hit(
        id="x",
        score=0.99,
        document_id="kdoc_other",
        chunk_index=0,
        title="إجراء بيتا",
        scope=Scope.TENANT,
        tenant_id=TENANT_B,
        tenant_name="شركة بيتا",
        module="GENERAL",
        page_key=None,
        text=SECRET_B,
        video_urls=[],
        allowed_roles=[],
    )
    assert enforce_scope(employee(TENANT_A), [foreign]) == []


def test_role_restricted_hit_is_dropped_by_the_fence_too():
    from app.services.vector_store import Hit, enforce_scope

    restricted = Hit(
        id="x",
        score=0.99,
        document_id="kdoc_acc",
        chunk_index=0,
        title="سياسة المحاسبة",
        scope=Scope.TENANT,
        tenant_id=TENANT_A,
        tenant_name="شركة ألفا",
        module="ACCOUNTING",
        page_key=None,
        text="سياسة داخلية",
        video_urls=[],
        allowed_roles=[Role.ACCOUNTANT.value],
    )
    assert enforce_scope(employee(TENANT_A, Role.AGENT), [restricted]) == []
    assert enforce_scope(employee(TENANT_A, Role.ACCOUNTANT), [restricted]) == [restricted]

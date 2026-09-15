"""Ingestion: Arabic `.txt` in, searchable chunks with intact metadata out."""

from __future__ import annotations

import pytest

from app.domain import DocumentStatus, Scope
from app.errors import ValidationError
from app.services.documents import to_summary, validate_upload
from app.services.registry import get_registry
from app.services.retrieval import retrieve
from tests.conftest import TENANT_A, auth, employee, ingest

ARABIC_DOC = """إنشاء حجز جديد

يمكن للموظف إنشاء حجز جديد من خلال صفحة الحجوزات، ثم اختيار العميل من القائمة أو تسجيل عميل جديد.
بعد ذلك يختار المنتج ويحدد عدد الحقائب، ثم يؤكد الحجز ويستلم المبلغ.

فيديو الشرح:
https://www.youtube.com/watch?v=aBcDeFgHiJk
"""


def test_arabic_document_is_indexed_and_searchable():
    doc_id = ingest(title="إنشاء حجز جديد", content=ARABIC_DOC, tenant_id=TENANT_A)

    stored = get_registry().get_document(doc_id)
    assert stored["status"] == DocumentStatus.INDEXED.value
    assert stored["chunk_count"] >= 1
    assert stored["chunk_ids"]

    evidence = retrieve(employee(TENANT_A), "كيف أنشئ حجز جديد للعميل", None)
    assert evidence.sources
    assert evidence.sources[0].title == "إنشاء حجز جديد"


def test_youtube_links_are_extracted_and_returned_with_the_answer():
    ingest(title="إنشاء حجز جديد", content=ARABIC_DOC, tenant_id=TENANT_A)

    evidence = retrieve(employee(TENANT_A), "كيف أنشئ حجز جديد للعميل", None)

    assert [v.url for v in evidence.videos] == ["https://www.youtube.com/watch?v=aBcDeFgHiJk"]
    assert evidence.videos[0].title == "فيديو الشرح"


def test_duplicate_video_links_across_documents_are_returned_once():
    ingest(title="دليل أول", content=ARABIC_DOC, tenant_id=TENANT_A)
    ingest(
        title="دليل ثانٍ",
        content=ARABIC_DOC.replace("إنشاء حجز", "إنشاء حجز جديد فوري"),
        tenant_id=TENANT_A,
    )

    evidence = retrieve(employee(TENANT_A), "كيف أنشئ حجز جديد للعميل", None)

    assert len(evidence.videos) == 1


def test_non_youtube_urls_are_not_treated_as_training_videos():
    doc_id = ingest(
        title="دليل بروابط أخرى",
        content="عنوان\n\nراجع http://10.0.0.5/admin و https://vimeo.com/123456 للمزيد.",
        tenant_id=TENANT_A,
    )
    assert get_registry().get_document(doc_id)["video_urls"] == []


@pytest.mark.parametrize(
    "filename,raw,reason",
    [
        ("notes.pdf", b"%PDF-1.4", "extension"),
        ("notes.txt", b"", "empty"),
        ("notes.txt", b"   \n  ", "whitespace only"),
        ("notes.txt", b"\xff\xfe\x00bad", "not utf-8"),
    ],
)
def test_unsupported_uploads_are_refused(filename, raw, reason):
    with pytest.raises(ValidationError):
        validate_upload(filename, raw)
    del reason


def test_oversized_upload_is_refused():
    from app.config import settings

    with pytest.raises(ValidationError):
        validate_upload("big.txt", b"a" * (settings.MAX_DOCUMENT_BYTES + 1))


def test_utf8_bom_is_tolerated():
    text = validate_upload("notes.txt", "﻿مرحباً".encode())
    assert "مرحبا" in text.replace("مرحباً", "مرحبا")


def test_filename_with_a_path_separator_is_refused():
    from pydantic import ValidationError as PydanticValidationError

    from app.schemas.documents import DocumentCreate

    with pytest.raises(PydanticValidationError):
        DocumentCreate(
            title="عنوان",
            content="نص",
            scope=Scope.GLOBAL,
            filename="../../etc/passwd",
        )


def test_a_tenant_document_must_name_its_tenant_and_a_global_one_must_not():
    from pydantic import ValidationError as PydanticValidationError

    from app.schemas.documents import DocumentCreate

    with pytest.raises(PydanticValidationError):
        DocumentCreate(title="ع", content="نص", scope=Scope.TENANT, tenant_id=None)
    with pytest.raises(PydanticValidationError):
        DocumentCreate(title="ع", content="نص", scope=Scope.GLOBAL, tenant_id="tnt_x")


def test_reindexing_replaces_chunks_rather_than_duplicating_them():
    from app.services.documents import index_document, replace_content

    doc_id = ingest(
        title="إجراء طويل",
        content="عنوان الإجراء\n\n" + ("فقرة مطوّلة تشرح الخطوات بالتفصيل. " * 120),
        tenant_id=TENANT_A,
    )
    first = get_registry().get_document(doc_id)["chunk_count"]
    assert first > 1

    replace_content(doc_id, title=None, content="عنوان الإجراء\n\nنسخة مختصرة جداً.")
    index_document(doc_id)

    stored = get_registry().get_document(doc_id)
    assert stored["chunk_count"] == 1
    assert stored["version"] == 2

    evidence = retrieve(employee(TENANT_A), "فقرة مطوّلة تشرح الخطوات", None)
    assert all(len(h.text) < 200 for h in evidence.hits)


def test_summary_hides_the_global_sentinel_from_the_ui():
    doc_id = ingest(
        title="وثيقة عامة",
        content="عنوان\n\nنص عام.",
        scope=Scope.GLOBAL,
        tenant_id=None,
        tenant_name=None,
    )
    summary = to_summary(get_registry().get_document(doc_id))
    assert summary.scope is Scope.GLOBAL
    assert summary.tenant_id is None


def _admin_headers() -> dict[str, str]:
    from app.domain import ActorKind

    return auth(kind=ActorKind.PLATFORM_ADMIN, subject="padm_1", tenant_id=None, role=None)


def test_multipart_upload_route_indexes_a_txt(client):
    response = client.post(
        "/v1/documents/upload",
        headers=_admin_headers(),
        files={"file": ("booking.txt", ARABIC_DOC.encode("utf-8"), "text/plain")},
        data={"title": "إنشاء حجز جديد", "scope": "GLOBAL", "module": "BOOKINGS"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "INDEXED"
    assert body["video_urls"] == ["https://www.youtube.com/watch?v=aBcDeFgHiJk"]


def test_multipart_upload_refuses_a_pdf(client):
    response = client.post(
        "/v1/documents/upload",
        headers=_admin_headers(),
        files={"file": ("manual.pdf", b"%PDF-1.4 ...", "application/pdf")},
        data={"title": "دليل", "scope": "GLOBAL"},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"

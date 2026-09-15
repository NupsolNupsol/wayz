"""Chunking: small documents stay whole, large ones split where a reader would."""

from __future__ import annotations

from app.services.chunking import chunk_document, normalise

HEADING = "تسليم الطلب لموظف التوصيل"


def test_a_short_document_is_not_split():
    text = f"{HEADING}\n\nتحقق من الهوية ثم امسح الباركود ثم أكد التسليم."
    chunks = chunk_document(text)
    assert len(chunks) == 1
    assert chunks[0].text == normalise(text)


def test_a_long_document_is_split_and_every_piece_keeps_the_heading():
    text = (
        f"{HEADING}\n\n"
        + ("فقرة تشرح الخطوة بالتفصيل الكامل. " * 60)
        + "\n\n"
        + ("فقرة أخرى تشرح الاستثناءات. " * 60)
    )
    chunks = chunk_document(text, target_chars=800, min_split_chars=900)

    assert len(chunks) > 1
    assert all(c.text.startswith(HEADING) for c in chunks)
    assert all(c.heading == HEADING for c in chunks)


def test_no_chunk_is_only_a_heading():
    text = f"{HEADING}\n\n" + ("فقرة طويلة جداً تشرح كل شيء. " * 80)
    chunks = chunk_document(text, target_chars=500, min_split_chars=600)
    assert all(len(c.text) > len(HEADING) + 10 for c in chunks)


def test_empty_input_produces_no_chunks():
    assert chunk_document("") == []
    assert chunk_document("   \n\n   ") == []


def test_normalise_strips_bidi_marks_but_keeps_arabic():
    dirty = "تسليم‏ الطلب‮"
    assert normalise(dirty) == "تسليم الطلب"


def test_chunk_indices_are_sequential():
    text = f"{HEADING}\n\n" + ("نص. " * 900)
    chunks = chunk_document(text, target_chars=400, min_split_chars=500)
    assert [c.index for c in chunks] == list(range(len(chunks)))

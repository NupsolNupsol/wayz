"""The listen button: validated, bounded, and honest when no voice is installed."""

from __future__ import annotations

import pytest

from app.config import settings
from app.errors import ValidationError
from app.services.tts import normalise_for_speech
from tests.conftest import auth


def test_empty_text_is_refused():
    with pytest.raises(ValidationError):
        normalise_for_speech("   \n  ")


def test_markdown_and_emoji_are_not_pronounced():
    cleaned = normalise_for_speech("**خطوات** التسليم 🎥 [رابط](http://x) `code`")
    for junk in ("*", "`", "[", "]", "🎥"):
        assert junk not in cleaned
    assert "خطوات" in cleaned


def test_long_text_is_truncated_rather_than_synthesised_whole():
    long_text = "هذه جملة عربية كاملة. " * 400
    cleaned = normalise_for_speech(long_text)
    assert len(cleaned) <= settings.TTS_MAX_CHARS


def test_truncation_prefers_a_sentence_boundary():
    cleaned = normalise_for_speech("جملة قصيرة. " * 300)
    assert cleaned.endswith(".")


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({}, 422),
        ({"text": ""}, 422),
        ({"text": "x" * 5000}, 422),
    ],
)
def test_route_validates_its_request(client, payload, expected):
    assert client.post("/v1/speech", headers=auth(), json=payload).status_code == expected


def test_route_reports_a_missing_voice_without_leaking_internals(client):
    """`TTS_PROVIDER=none` in the test environment, so this is the no-voice path."""
    response = client.post("/v1/speech", headers=auth(), json={"text": "مرحبا بك"})

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "dependency_unavailable"
    assert body["message"] == "خدمة النطق غير مفعّلة على هذا الخادم."
    assert "Traceback" not in response.text
    assert "/models" not in response.text


def test_speech_needs_a_token(client):
    assert client.post("/v1/speech", json={"text": "مرحبا"}).status_code == 401

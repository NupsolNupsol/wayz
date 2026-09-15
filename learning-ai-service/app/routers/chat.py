"""Employee-facing endpoints: ask, speak, and say whether it helped."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field

from ..errors import ValidationError
from ..logging_config import get_logger
from ..schemas.chat import ChatRequest, ChatResponse
from ..schemas.speech import SpeechRequest
from ..security import Actor, current_actor, current_employee, current_platform_admin
from ..services import chat as chat_service
from ..services import tts
from ..services.registry import get_registry, now

logger = get_logger(__name__)

router = APIRouter(prefix="/v1", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
def ask(
    payload: ChatRequest,
    actor: Actor = Depends(current_employee),
) -> ChatResponse:
    return chat_service.answer(actor, payload)


@router.post("/speech")
def speak(
    payload: SpeechRequest,
    actor: Actor = Depends(current_employee),
) -> Response:
    speech = tts.synthesise(payload.text, language=payload.language)
    try:
        get_registry().record_event(
            {
                "kind": "SPEECH",
                "at": now(),
                "tenant_id": actor.tenant_id,
                "tenant_name": actor.tenant_name,
                "role": actor.role.value if actor.role else None,
                "user_id": actor.subject,
                "interaction_id": payload.interaction_id,
                "chars": len(payload.text),
                "voice": speech.voice,
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not record speech event", error=type(exc).__name__)

    # A weak ETag lets the browser reuse audio it already has for an answer it is re-reading.
    etag = hashlib.sha256(speech.audio).hexdigest()[:32]
    return Response(
        content=speech.audio,
        media_type=speech.media_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "ETag": f'W/"{etag}"',
            "X-TTS-Voice": speech.voice,
        },
    )


class FeedbackRequest(BaseModel):
    interaction_id: str = Field(max_length=64)
    helpful: bool
    comment: str = Field(default="", max_length=500)


@router.post("/feedback")
def feedback(
    payload: FeedbackRequest,
    actor: Actor = Depends(current_employee),
) -> dict[str, object]:
    registry = get_registry()
    registry.record_event(
        {
            "kind": "FEEDBACK",
            "at": now(),
            "interaction_id": payload.interaction_id,
            "tenant_id": actor.tenant_id,
            "tenant_name": actor.tenant_name,
            "role": actor.role.value if actor.role else None,
            "user_id": actor.subject,
            "helpful": payload.helpful,
            "comment": payload.comment[:500],
        }
    )
    return {"recorded": True}


class VideoClickRequest(BaseModel):
    interaction_id: str | None = Field(default=None, max_length=64)
    url: str = Field(max_length=500)
    title: str = Field(default="", max_length=200)
    document_id: str | None = Field(default=None, max_length=64)


@router.post("/events/video-click")
def video_click(
    payload: VideoClickRequest,
    actor: Actor = Depends(current_employee),
) -> dict[str, object]:
    from ..services.youtube import canonical_url

    # Only a link this service itself would have produced is recorded — the analytics table
    # must not become a place a client can write arbitrary URLs into.
    url = canonical_url(payload.url)
    if not url:
        raise ValidationError("Not a recognised training video URL.")
    get_registry().record_event(
        {
            "kind": "VIDEO_CLICK",
            "at": now(),
            "interaction_id": payload.interaction_id,
            "tenant_id": actor.tenant_id,
            "tenant_name": actor.tenant_name,
            "role": actor.role.value if actor.role else None,
            "user_id": actor.subject,
            "video_url": url,
            "video_title": payload.title[:200],
            "document_id": payload.document_id,
        }
    )
    return {"recorded": True}


@router.get("/analytics")
def analytics(
    days: int = Query(default=30, ge=1, le=365),
    tenant_id: str | None = Query(default=None),
    _actor: Actor = Depends(current_platform_admin),
) -> dict[str, object]:
    return get_registry().analytics(days=days, tenant_id=tenant_id or None)


@router.get("/whoami")
def whoami(actor: Actor = Depends(current_actor)) -> dict[str, object]:
    """What this service believes about the caller. Useful when wiring the two halves up."""
    return {
        "kind": actor.kind.value,
        "subject": actor.subject,
        "tenantId": actor.tenant_id,
        "tenantSlug": actor.tenant_slug,
        "role": actor.role.value if actor.role else None,
        "locale": actor.locale,
    }

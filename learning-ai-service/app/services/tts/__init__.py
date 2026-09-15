"""Speech: provider selection, length limits and the on-disk cache.

Speech is generated only when an employee asks for it — never for every answer — because the
same paragraph is otherwise synthesised again for every person who reads it. The cache keys on
a hash of the normalised text, so the second person to press listen gets the file the first
person's request produced.
"""

from __future__ import annotations

import hashlib
import os
import re
import threading
import time
from pathlib import Path

from ...config import settings
from ...errors import DependencyError, ValidationError
from ...logging_config import get_logger
from .base import Speech, TTSProvider
from .piper import EspeakTTSProvider, NullTTSProvider, PiperTTSProvider

logger = get_logger(__name__)

_lock = threading.Lock()
_provider: TTSProvider | None = None

_WHITESPACE = re.compile(r"\s+")
# Markdown a screen reader should not pronounce, and the emoji the UI adds around answers.
_STRIP = re.compile(r"[*_`#>\[\]()•]|[\U0001F300-\U0001FAFF]|[☀-➿]")


def get_tts() -> TTSProvider:
    global _provider
    if _provider is not None:
        return _provider
    with _lock:
        if _provider is not None:
            return _provider
        chosen = settings.TTS_PROVIDER
        if chosen == "none":
            _provider = NullTTSProvider()
        elif chosen == "espeak":
            _provider = EspeakTTSProvider()
        else:
            piper = PiperTTSProvider()
            if piper.available():
                _provider = piper
            else:
                # A voice that failed to download must not take the listen button with it.
                fallback = EspeakTTSProvider()
                logger.warning(
                    "Piper unavailable, falling back",
                    fallback=fallback.name,
                    available=fallback.available(),
                )
                _provider = fallback if fallback.available() else NullTTSProvider()
    return _provider


def normalise_for_speech(text: str) -> str:
    cleaned = _STRIP.sub(" ", text or "")
    cleaned = _WHITESPACE.sub(" ", cleaned).strip()
    if not cleaned:
        raise ValidationError("Nothing to speak.", public_message="لا يوجد نص لنطقه.")
    if len(cleaned) > settings.TTS_MAX_CHARS:
        # Truncated at a sentence end rather than mid-word: a long answer is still useful
        # spoken in part, and an unbounded one is a way to make the server do arbitrary work.
        window = cleaned[: settings.TTS_MAX_CHARS]
        cut = max(window.rfind("."), window.rfind("؟"), window.rfind("!"), window.rfind("\n"))
        cleaned = window[: cut + 1] if cut > settings.TTS_MAX_CHARS // 2 else window
    return cleaned


def _cache_path(text: str, voice: str) -> Path:
    digest = hashlib.sha256(f"{voice}|{text}".encode()).hexdigest()
    return Path(settings.TTS_CACHE_DIR) / f"{digest}.wav"


def _prune_cache(directory: Path) -> None:
    try:
        files = sorted(directory.glob("*.wav"), key=lambda p: p.stat().st_mtime)
        for stale in files[: max(len(files) - settings.TTS_CACHE_MAX_ENTRIES, 0)]:
            stale.unlink(missing_ok=True)
    except OSError:
        pass  # A cache that cannot be pruned is a disk-space problem, not a request failure.


def synthesise(text: str, *, language: str = "ar") -> Speech:
    provider = get_tts()
    cleaned = normalise_for_speech(text)
    voice = str(provider.status().get("voice") or provider.name)

    cache_dir = Path(settings.TTS_CACHE_DIR)
    path = _cache_path(cleaned, voice)
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        if path.is_file() and path.stat().st_size > 44:
            os.utime(path, (time.time(), time.time()))
            return Speech(audio=path.read_bytes(), media_type="audio/wav", voice=voice)
    except OSError:
        pass  # No cache is a slower answer, never a failed one.

    speech = provider.synthesise(cleaned, language=language)
    try:
        path.write_bytes(speech.audio)
        _prune_cache(cache_dir)
    except OSError:
        pass
    return speech


def tts_status() -> dict[str, object]:
    try:
        provider = get_tts()
        return {**provider.status(), "available": provider.available()}
    except DependencyError as exc:
        return {"provider": settings.TTS_PROVIDER, "available": False, "error": exc.code}


def reset_tts_for_tests() -> None:
    global _provider
    _provider = None


__all__ = [
    "Speech",
    "TTSProvider",
    "get_tts",
    "normalise_for_speech",
    "reset_tts_for_tests",
    "synthesise",
    "tts_status",
]

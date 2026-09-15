"""Local Arabic speech, with no per-request cost and no text leaving the machine.

Piper is invoked as a subprocess against its downloaded ONNX voice rather than through a
Python binding: the binding's wheel availability tracks Python minor versions and breaks on
upgrade, whereas the released binary and the voice file are just files in the image. The
text arrives on stdin and the WAV comes back on stdout, so nothing is written to a temporary
path an attacker could aim at.

`espeak-ng` is the fallback. It is not as pleasant, but it is in Debian, it speaks Arabic,
and "the listen button is unavailable" is a worse answer than "the listen button sounds
robotic".
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from ...config import settings
from ...errors import DependencyError
from ...logging_config import get_logger
from .base import Speech

logger = get_logger(__name__)


def _run(command: list[str], stdin: bytes, timeout: float) -> bytes:
    try:
        result = subprocess.run(  # noqa: S603 - fixed argv, no shell, text only on stdin
            command,
            input=stdin,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        raise DependencyError(f"{command[0]} is not installed.") from exc
    except subprocess.TimeoutExpired as exc:
        raise DependencyError("Speech synthesis timed out.") from exc

    if result.returncode != 0 or not result.stdout:
        # stderr can contain a model path; the type of failure is all a caller gets.
        logger.error(
            "Speech synthesis failed",
            binary=command[0],
            returncode=result.returncode,
            bytes=len(result.stdout or b""),
        )
        raise DependencyError("Speech synthesis failed.")
    return result.stdout


class PiperTTSProvider:
    name = "piper"

    def __init__(self) -> None:
        self._binary = settings.PIPER_BINARY
        self._model = settings.PIPER_MODEL_PATH
        self._config = settings.piper_config_path

    def available(self) -> bool:
        return bool(shutil.which(self._binary)) and Path(self._model).is_file()

    def synthesise(self, text: str, *, language: str = "ar") -> Speech:
        del language  # The voice file decides the language.
        if not self.available():
            raise DependencyError("The Piper voice is not installed.")
        command = [
            self._binary,
            "--model",
            self._model,
            "--output_file",
            "-",  # stdout
        ]
        if Path(self._config).is_file():
            command += ["--config", self._config]
        audio = _run(command, text.encode("utf-8"), settings.TTS_TIMEOUT_SECONDS)
        return Speech(audio=audio, media_type="audio/wav", voice=Path(self._model).stem)

    def status(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "binary": self._binary,
            "binaryFound": bool(shutil.which(self._binary)),
            "voiceFound": Path(self._model).is_file(),
            "voice": Path(self._model).stem,
        }


class EspeakTTSProvider:
    name = "espeak"

    def __init__(self) -> None:
        self._binary = settings.ESPEAK_BINARY
        self._voice = settings.ESPEAK_VOICE

    def available(self) -> bool:
        return bool(shutil.which(self._binary))

    def synthesise(self, text: str, *, language: str = "ar") -> Speech:
        if not self.available():
            raise DependencyError("espeak-ng is not installed.")
        command = [
            self._binary,
            "-v",
            language if language in ("ar", "en") else self._voice,
            "-s",
            "150",
            "--stdout",
            "--stdin",
        ]
        audio = _run(command, text.encode("utf-8"), settings.TTS_TIMEOUT_SECONDS)
        return Speech(audio=audio, media_type="audio/wav", voice=self._voice)

    def status(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "binary": self._binary,
            "binaryFound": bool(shutil.which(self._binary)),
            "voice": self._voice,
        }


class NullTTSProvider:
    """Explicitly no speech. Says so plainly instead of failing in an interesting way."""

    name = "none"

    def available(self) -> bool:
        return False

    def synthesise(self, text: str, *, language: str = "ar") -> Speech:
        del text, language
        raise DependencyError(
            "No speech provider is configured.",
            public_message="خدمة النطق غير مفعّلة على هذا الخادم.",
        )

    def status(self) -> dict[str, object]:
        return {"provider": self.name, "binaryFound": False}

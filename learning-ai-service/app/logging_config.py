"""Structured logging, and the rule about what never reaches a log line.

One JSON object per line, matching the shape the Node API already emits, so both halves of
the platform can be read by the same tooling. The redaction list is not decoration: an API
key or an Authorization header written to a log is a leaked credential whether or not the
log is ever read.
"""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

_request_id: ContextVar[str] = ContextVar("request_id", default="-")

# Substrings that disqualify a field from ever being logged, whatever it is called.
_FORBIDDEN_KEY_PARTS = (
    "secret",
    "token",
    "password",
    "api_key",
    "apikey",
    "authorization",
    "credential",
    "cookie",
)

_RESERVED = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
    "taskName",
}


def set_request_id(value: str | None = None) -> str:
    rid = value or uuid.uuid4().hex[:16]
    _request_id.set(rid)
    return rid


def get_request_id() -> str:
    return _request_id.get()


def _safe(key: str, value: Any) -> Any:
    if any(part in key.lower() for part in _FORBIDDEN_KEY_PARTS):
        return "[redacted]"
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    if isinstance(value, list | tuple):
        return [_safe(key, v) for v in value][:20]
    if isinstance(value, dict):
        return {k: _safe(k, v) for k, v in value.items()}
    return str(value)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "t": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
            "logger": record.name,
            "requestId": get_request_id(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED or key.startswith("_"):
                continue
            payload[key] = _safe(key, value)
        if record.exc_info:
            # The type and message, never the traceback — tracebacks go to the console
            # handler in development and are not part of the structured record.
            exc_type, exc_value, _ = record.exc_info
            payload["errorType"] = getattr(exc_type, "__name__", "Error")
            payload["errorMessage"] = str(exc_value)[:400]
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # Uvicorn's own access log duplicates what the request middleware already records,
    # in a format nothing else here uses.
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False
    logging.getLogger("uvicorn.error").handlers = [handler]
    logging.getLogger("uvicorn.error").propagate = False
    for noisy in ("httpx", "httpcore", "qdrant_client", "sentence_transformers", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


class StructuredLogger:
    """`logger.info("msg", tenantId=...)` instead of `extra={"tenantId": ...}`.

    The stdlib signature swallows keyword arguments into `%`-formatting and raises on
    anything it does not recognise, which makes structured fields verbose enough at every
    call site that people stop adding them. This is the thinnest possible adapter: it moves
    keywords into `extra`, where the JSON formatter already looks for them.
    """

    __slots__ = ("_log",)

    def __init__(self, logger: logging.Logger) -> None:
        self._log = logger

    def _emit(self, level: int, msg: str, kwargs: dict[str, Any], exc_info: bool = False) -> None:
        # `extra` keys that collide with a LogRecord attribute — `module`, `name`, `filename`,
        # `args` — make logging raise, and a field name like `module` is an entirely natural
        # thing to want here. Renaming beats an exception thrown from a log line: the worst
        # outcome of a logging call should be a slightly uglier log line.
        safe = {(f"{k}_" if k in _RESERVED else k): v for k, v in kwargs.items()}
        try:
            self._log.log(level, msg, extra=safe or None, exc_info=exc_info)
        except Exception:  # noqa: BLE001
            self._log.log(level, msg, exc_info=exc_info)

    def debug(self, msg: str, **kwargs: Any) -> None:
        self._emit(logging.DEBUG, msg, kwargs)

    def info(self, msg: str, **kwargs: Any) -> None:
        self._emit(logging.INFO, msg, kwargs)

    def warning(self, msg: str, **kwargs: Any) -> None:
        self._emit(logging.WARNING, msg, kwargs)

    def error(self, msg: str, **kwargs: Any) -> None:
        self._emit(logging.ERROR, msg, kwargs)

    def exception(self, msg: str, **kwargs: Any) -> None:
        self._emit(logging.ERROR, msg, kwargs, exc_info=True)


def get_logger(name: str) -> StructuredLogger:
    return StructuredLogger(logging.getLogger(name))

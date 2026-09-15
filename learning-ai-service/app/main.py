"""The FastAPI application.

Deliberately small: wiring, one request-scoped middleware and one error handler. Everything
that decides anything lives in `services/`.

There is no CORS configuration on purpose. A browser never calls this service — the only
client is the LockerFlow Node API, server to server, and adding an allowed origin here would
be adding a door that is not supposed to exist.
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings
from .errors import ServiceError
from .logging_config import configure_logging, get_logger, get_request_id, set_request_id
from .routers import chat, documents, health

configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Learning AI service starting",
        environment=settings.ENVIRONMENT,
        embeddingModel="hashing-stub" if settings.EMBEDDING_FAKE else settings.EMBEDDING_MODEL,
        llm=settings.LLM_PROVIDER,
        tts=settings.TTS_PROVIDER,
    )
    if not settings.AI_SERVICE_SECRET:
        # Loud, because a service in this state refuses every request and the reason is not
        # obvious from the 401s it returns.
        logger.error("AI_SERVICE_SECRET is not set — every request will be rejected")

    if settings.EMBEDDING_WARMUP:
        # In a thread, not inline: the container must start answering /health immediately, and
        # a 30-second blocking startup reads to an orchestrator as a service that failed to
        # come up. Readiness reports `embeddings.loaded` until this finishes.
        import threading

        def warm() -> None:
            try:
                from .services.embeddings import get_embedder

                get_embedder().encode(["تهيئة"])
                logger.info("Embedding model warmed")
            except Exception:  # noqa: BLE001 - readiness already reports the failure
                logger.error("Embedding warm-up failed; it will be retried on first use")

        threading.Thread(target=warm, name="embedding-warmup", daemon=True).start()

    yield
    logger.info("Learning AI service stopping")


app = FastAPI(
    title="LockerFlow Learning & AI Service",
    version="1.0.0",
    description=(
        "Tenant-aware Arabic RAG, knowledge ingestion and local text-to-speech for the "
        "LockerFlow employee learning system. Reached only by the LockerFlow Node API."
    ),
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None,
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = set_request_id(request.headers.get("x-request-id"))
    started = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled request error",
            path=request.url.path,
            method=request.method,
            durationMs=int((time.monotonic() - started) * 1000),
        )
        raise
    duration = int((time.monotonic() - started) * 1000)
    response.headers["x-request-id"] = rid
    # Health checks run every few seconds; logging them buries everything that matters.
    if not request.url.path.startswith("/health"):
        logger.info(
            "request",
            path=request.url.path,
            method=request.method,
            status=response.status_code,
            durationMs=duration,
        )
    return response


@app.exception_handler(ServiceError)
async def service_error_handler(_request: Request, exc: ServiceError) -> JSONResponse:
    # `detail` is for us and goes to the log; `message` is for a person and is in Arabic.
    logger.warning("Request refused", code=exc.code, detail=exc.detail[:300])
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "code": exc.code,
            "message": exc.public_message,
            "requestId": get_request_id(),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "code": "invalid_request",
            "message": "الطلب غير صالح.",
            "errors": [
                f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg', '')}"
                for e in exc.errors()[:10]
            ],
            "requestId": get_request_id(),
        },
    )


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
    # The type goes to the log; the caller gets a request id and nothing else. An employee
    # must never read a stack trace, a connection string or a provider's error text.
    logger.error("Unhandled error", error=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": "internal_error",
            "message": "حدث خطأ غير متوقع. حاول مرة أخرى.",
            "requestId": get_request_id(),
        },
    )


app.include_router(health.router)
app.include_router(documents.router)
app.include_router(chat.router)

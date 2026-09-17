"""Settings for the learning/AI service.

Everything configurable lives here and nowhere else, so a deployment can be described
entirely by its environment. Nothing in this file carries a working credential: the
defaults are the safe answers, and a service started without a secret refuses to trust
anybody rather than trusting everybody.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- service ------------------------------------------------------------
    APP_NAME: str = "lockerflow-learning-ai"
    ENVIRONMENT: Literal["development", "production", "test"] = "development"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8088

    # --- server-to-server authentication ------------------------------------
    # The LockerFlow Node API signs a short-lived token with this secret and this service
    # verifies it. There is no other way in: a browser never talks to this service, and a
    # tenant id in a request body is ignored in favour of the one inside the signature.
    AI_SERVICE_SECRET: str = ""
    AI_SERVICE_ISSUER: str = "lockerflow-api"
    AI_SERVICE_AUDIENCE: str = "lockerflow-ai"
    # How much clock skew between the two containers is tolerated, in seconds.
    AI_SERVICE_LEEWAY_SECONDS: int = 30

    # --- OpenAI --------------------------------------------------------------
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_BASE_URL: str | None = None
    OPENAI_TIMEOUT_SECONDS: float = 45.0
    OPENAI_MAX_OUTPUT_TOKENS: int = 900
    OPENAI_TEMPERATURE: float = 0.2
    # "responses" is the API OpenAI currently recommends; "chat" is the older
    # chat-completions shape, which is what most OpenAI-compatible gateways implement.
    OPENAI_API_STYLE: Literal["responses", "chat"] = "responses"
    LLM_PROVIDER: Literal["openai", "echo"] = "openai"

    # --- embeddings ----------------------------------------------------------
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    EMBEDDING_DEVICE: str = "cpu"
    # bge-m3 emits 1024 dimensions. Overridden automatically once the real model loads;
    # it is declared here so the collection can be created before the first embedding.
    EMBEDDING_DIM: int = 1024
    EMBEDDING_BATCH_SIZE: int = 8
    EMBEDDING_MAX_CHARS: int = 8000
    # Swaps the real model for a deterministic hashing stand-in. Tests use it so the core
    # suite neither downloads 2 GB nor needs a GPU; never set it on a real deployment.
    EMBEDDING_FAKE: bool = False
    # Load the model at startup in a background thread rather than on the first question.
    # BGE-M3 takes ~30 s to load, and without this the first employee to ask anything after a
    # deploy waits for it — usually long enough for the Node API's timeout to fire first.
    EMBEDDING_WARMUP: bool = True
    HF_HOME: str | None = None

    # --- Qdrant --------------------------------------------------------------
    # This service's own Qdrant, on its own internal network. The default used to name
    # `qdrant`, which was LockerFlow's container — so the AI stack could not start without
    # LockerFlow's stack having created it first.
    QDRANT_URL: str = "http://lockerflow-ai-qdrant:6333"
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION: str = "lockerflow_knowledge"
    QDRANT_TIMEOUT_SECONDS: float = 20.0
    # An in-memory Qdrant, for tests. Same client, same filters, no container.
    QDRANT_IN_MEMORY: bool = False

    # --- document registry (MongoDB) -----------------------------------------
    # This service's own MongoDB. The default used to be LockerFlow's `mongo` container; the
    # AI service keeps its own documents, embeddings and analytics and shares no collection
    # with the booking API, so it now keeps its own database too.
    MONGODB_URI: str = "mongodb://lockerflow-ai-mongo:27017"
    AI_DB_NAME: str = "lockerflow_ai"
    # Swaps Mongo for an in-process store. Tests only.
    REGISTRY_IN_MEMORY: bool = False

    # --- ingestion limits ----------------------------------------------------
    MAX_DOCUMENT_BYTES: int = 2 * 1024 * 1024
    ALLOWED_EXTENSIONS: str = ".txt,.md"
    CHUNK_TARGET_CHARS: int = 1100
    CHUNK_OVERLAP_CHARS: int = 150
    # A document shorter than this is never split: most knowledge files are one section.
    CHUNK_MIN_SPLIT_CHARS: int = 1400

    # --- retrieval -----------------------------------------------------------
    RETRIEVAL_TOP_K: int = 8
    RETRIEVAL_CANDIDATES: int = 40
    RETRIEVAL_MIN_SCORE: float = 0.30
    # Tenant procedure outranks platform documentation at equal relevance.
    TENANT_SCOPE_BOOST: float = 0.06
    PAGE_MATCH_BOOST: float = 0.05
    MAX_CONTEXT_CHARS: int = 9000

    # --- text to speech ------------------------------------------------------
    TTS_PROVIDER: Literal["piper", "espeak", "none"] = "piper"
    PIPER_BINARY: str = "piper"
    PIPER_MODEL_PATH: str = "/models/piper/ar_JO-kareem-low.onnx"
    PIPER_CONFIG_PATH: str = ""
    ESPEAK_BINARY: str = "espeak-ng"
    ESPEAK_VOICE: str = "ar"
    TTS_MAX_CHARS: int = 1200
    TTS_CACHE_DIR: str = "/var/cache/lockerflow-tts"
    TTS_CACHE_MAX_ENTRIES: int = 400
    TTS_TIMEOUT_SECONDS: float = 60.0

    @field_validator("ALLOWED_EXTENSIONS")
    @classmethod
    def _normalise_extensions(cls, value: str) -> str:
        return ",".join(e.strip().lower() for e in value.split(",") if e.strip())

    @property
    def allowed_extensions(self) -> tuple[str, ...]:
        return tuple(self.ALLOWED_EXTENSIONS.split(","))

    @property
    def piper_config_path(self) -> str:
        return self.PIPER_CONFIG_PATH or f"{self.PIPER_MODEL_PATH}.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()

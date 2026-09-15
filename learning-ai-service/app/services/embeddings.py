"""The embedding model, loaded once.

BGE-M3 is roughly 2 GB on disk and several seconds to load. Loading it per request would
make every question cost more than the answer is worth, so it is loaded lazily on first use
and then held for the life of the process — which is why the service declares readiness
separately from liveness: the container is up long before the model is.

`EMBEDDING_FAKE` swaps in a deterministic hashing embedder. That is not a stub standing in
for unfinished work: it is what lets the isolation and retrieval tests run in a second
without a 2 GB download, and it embeds Arabic exactly as consistently as it embeds anything
else, because it does not read the text as language at all.
"""

from __future__ import annotations

import hashlib
import math
import threading
from typing import Protocol

from ..config import settings
from ..errors import DependencyError
from ..logging_config import get_logger

logger = get_logger(__name__)


class Embedder(Protocol):
    dimension: int
    name: str

    def encode(self, texts: list[str], *, is_query: bool = False) -> list[list[float]]: ...


def _normalise(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(v * v for v in vector))
    return [v / length for v in vector] if length else vector


class HashingEmbedder:
    """A deterministic stand-in with the same contract as the real model.

    Bag-of-character-ngrams hashed into a fixed number of buckets. Identical text gives an
    identical vector and overlapping text gives a near vector, which is all the retrieval
    tests actually need in order to be about filtering rather than about semantics.
    """

    name = "hashing-stub"

    def __init__(self, dimension: int = 256) -> None:
        self.dimension = dimension

    def encode(self, texts: list[str], *, is_query: bool = False) -> list[list[float]]:
        del is_query
        out: list[list[float]] = []
        for text in texts:
            buckets = [0.0] * self.dimension
            cleaned = (text or "").strip()
            for token in cleaned.split():
                for n in (2, 3):
                    for i in range(max(len(token) - n + 1, 1)):
                        gram = token[i : i + n]
                        digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
                        buckets[int.from_bytes(digest, "big") % self.dimension] += 1.0
            out.append(_normalise(buckets))
        return out


class SentenceTransformerEmbedder:
    """BAAI/bge-m3 (or whatever `EMBEDDING_MODEL` names) through sentence-transformers."""

    def __init__(self, model_name: str, device: str) -> None:
        from sentence_transformers import SentenceTransformer  # imported lazily: heavy

        self.name = model_name
        self._model = SentenceTransformer(model_name, device=device)
        self.dimension = int(self._model.get_sentence_embedding_dimension())

    def encode(self, texts: list[str], *, is_query: bool = False) -> list[list[float]]:
        del is_query  # bge-m3 is symmetric and wants no instruction prefix.
        vectors = self._model.encode(
            [t[: settings.EMBEDDING_MAX_CHARS] for t in texts],
            batch_size=settings.EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return [[float(v) for v in row] for row in vectors]


_lock = threading.Lock()
_embedder: Embedder | None = None
_load_error: str | None = None


def get_embedder() -> Embedder:
    global _embedder, _load_error
    if _embedder is not None:
        return _embedder
    with _lock:
        if _embedder is not None:
            return _embedder
        if settings.EMBEDDING_FAKE:
            _embedder = HashingEmbedder(dimension=settings.EMBEDDING_DIM)
            logger.warning("Using the hashing embedder", model=_embedder.name)
            return _embedder
        try:
            logger.info("Loading embedding model", model=settings.EMBEDDING_MODEL)
            _embedder = SentenceTransformerEmbedder(
                settings.EMBEDDING_MODEL, settings.EMBEDDING_DEVICE
            )
            _load_error = None
            logger.info(
                "Embedding model ready",
                model=settings.EMBEDDING_MODEL,
                dimension=_embedder.dimension,
            )
        except Exception as exc:  # noqa: BLE001 - reported through readiness, never to a user
            _load_error = f"{type(exc).__name__}: {exc}"
            logger.error("Embedding model unavailable", error=_load_error)
            raise DependencyError("The embedding model could not be loaded.") from exc
    return _embedder


def embedder_status() -> dict[str, object]:
    """For the readiness endpoint. Never triggers a load — that is the point."""
    return {
        "model": "hashing-stub" if settings.EMBEDDING_FAKE else settings.EMBEDDING_MODEL,
        "loaded": _embedder is not None,
        "dimension": _embedder.dimension if _embedder else settings.EMBEDDING_DIM,
        "error": _load_error,
    }


def embedding_dimension() -> int:
    """The width of the vector space, without forcing a model load.

    The collection has to be created before the first document is embedded, so the
    configured width is the answer until a model is actually loaded and can give its own.
    """
    return _embedder.dimension if _embedder is not None else settings.EMBEDDING_DIM


def reset_embedder_for_tests() -> None:
    global _embedder, _load_error
    _embedder = None
    _load_error = None

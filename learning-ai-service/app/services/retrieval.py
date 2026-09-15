"""Turning a question into evidence the model is allowed to see.

Three things happen here and they happen in this order on purpose:

1. **Filter.** The Qdrant query carries the access filter built from the signed actor, and
   every hit is checked again afterwards. Nothing unauthorised exists past this line.
2. **Rank.** Among what the employee *may* see, a small, explicit boost prefers their own
   company's procedure over the platform's general documentation, and prefers a document
   pinned to the page they are standing on. Both are ranking nudges and neither can promote
   something the filter excluded.
3. **Budget.** Passages are packed up to a character budget so a long document cannot crowd
   the model's context and quietly drop the one short answer that mattered.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..config import settings
from ..domain import Scope
from ..logging_config import get_logger
from ..schemas.chat import PageContext, SourceRef, VideoRef
from ..security import Actor
from . import vector_store
from .embeddings import get_embedder
from .registry import get_registry
from .vector_store import Hit

logger = get_logger(__name__)


@dataclass
class Evidence:
    hits: list[Hit]
    sources: list[SourceRef]
    videos: list[VideoRef]
    context_block: str
    retrieved_count: int

    @property
    def has_evidence(self) -> bool:
        return bool(self.hits)


def _excerpt(text: str, limit: int = 320) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    window = cleaned[:limit]
    cut = window.rfind(" ")
    return (window[:cut] if cut > limit // 2 else window) + "…"


def _rank(hits: list[Hit], page: PageContext | None) -> list[Hit]:
    page_key = (page.page_key if page else None) or ""
    module = (page.module if page else None) or ""

    def adjusted(hit: Hit) -> float:
        score = hit.score
        if hit.scope is Scope.TENANT:
            score += settings.TENANT_SCOPE_BOOST
        if page_key and hit.page_key and hit.page_key == page_key:
            score += settings.PAGE_MATCH_BOOST
        elif module and hit.module and hit.module.upper() == module.upper():
            score += settings.PAGE_MATCH_BOOST / 2
        return score

    return sorted(hits, key=adjusted, reverse=True)


def _scope_label(hit: Hit) -> str:
    return "إجراء الشركة" if hit.scope is Scope.TENANT else "وثائق LockerFlow"


def search_text(question: str, page: PageContext | None) -> str:
    """What is actually embedded — the question plus what the screen is about.

    "ماذا أفعل هنا؟" carries no topic at all. Embedding it alone retrieves whatever happens
    to be nearest to a generic phrase, which for the commonest question in the product is
    the wrong answer by construction. The page's own words — its title, module and entity —
    are what make it a searchable question.

    This only shapes *ranking*. The access filter is built from the signed actor and is not
    touched by anything here, so a browser sending a misleading page context gets a worse
    answer and never a document it was not entitled to.
    """
    parts = [(question or "").strip()]
    if page:
        trimmed = page.trimmed()
        parts += [
            trimmed.screen_title or "",
            trimmed.module or "",
            trimmed.entity_type or "",
            trimmed.page_key.replace(".", " ") if trimmed.page_key else "",
            " ".join(trimmed.available_actions[:6]),
        ]
    return " ".join(p for p in parts if p).strip()


def retrieve(actor: Actor, question: str, page: PageContext | None) -> Evidence:
    """The authorised evidence for one question, ranked and budgeted."""
    cleaned = search_text(question, page)
    if not cleaned:
        return Evidence([], [], [], "", 0)

    vector = get_embedder().encode([cleaned], is_query=True)[0]
    candidates = vector_store.search(
        actor=actor, vector=vector, limit=settings.RETRIEVAL_CANDIDATES
    )
    retrieved_count = len(candidates)

    # A weak nearest neighbour is not evidence. Without a floor, an empty knowledge base
    # still returns "the least unrelated thing in it", and the model dutifully builds a
    # procedure around it — which is exactly the failure this product cannot have.
    strong = [h for h in candidates if h.score >= settings.RETRIEVAL_MIN_SCORE]
    ranked = _rank(strong, page)[: settings.RETRIEVAL_TOP_K]

    blocks: list[str] = []
    sources: list[SourceRef] = []
    videos: list[VideoRef] = []
    seen_documents: set[str] = set()
    seen_videos: set[str] = set()
    budget = settings.MAX_CONTEXT_CHARS
    used: list[Hit] = []

    registry = get_registry()
    for hit in ranked:
        passage = hit.text.strip()
        if not passage:
            continue
        if len(passage) + 200 > budget:
            if used:
                break
            passage = passage[: max(budget - 200, 400)]
        budget -= len(passage) + 200
        used.append(hit)

        blocks.append(
            "\n".join(
                [
                    f"[مرجع {len(blocks) + 1}]",
                    f"العنوان: {hit.title}",
                    f"النوع: {_scope_label(hit)}",
                    f"القسم: {hit.module}",
                    "النص:",
                    passage,
                ]
            )
        )

        if hit.document_id not in seen_documents:
            seen_documents.add(hit.document_id)
            sources.append(
                SourceRef(
                    document_id=hit.document_id,
                    title=hit.title,
                    scope=hit.scope,
                    module=hit.module,
                    relevant_excerpt=_excerpt(passage),
                    score=round(hit.score, 4),
                    tenant_name=hit.tenant_name if hit.scope is Scope.TENANT else None,
                )
            )

        for url in hit.video_urls:
            if url in seen_videos:
                continue
            seen_videos.add(url)
            captions = (registry.get_document(hit.document_id) or {}).get("video_titles") or {}
            videos.append(
                VideoRef(
                    title=str(captions.get(url) or hit.title)[:120],
                    url=url,
                    document_id=hit.document_id,
                )
            )

    logger.info(
        "Retrieved knowledge",
        candidates=retrieved_count,
        kept=len(used),
        sources=len(sources),
        videos=len(videos),
        pageKey=page.page_key if page else None,
        **actor.log_fields(),
    )

    return Evidence(
        hits=used,
        sources=sources,
        videos=videos,
        context_block="\n\n".join(blocks),
        retrieved_count=retrieved_count,
    )

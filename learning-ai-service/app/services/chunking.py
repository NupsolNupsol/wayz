"""Splitting a knowledge document, only when it is worth splitting.

Most documents here are one workflow — three or four Arabic paragraphs and perhaps a video
link. Cutting those into 300-character windows would be worse than useless: it destroys the
one thing that makes a procedure answerable, which is that its steps sit together and in
order. So a short document stays whole, and only a long one is divided, on paragraph
boundaries, with a little overlap so a step never loses the sentence that set it up.

Arabic has no special tokenisation need here — paragraphs are paragraphs — but the sentence
splitter does have to know about `؟` and `،`, which is why it is written out rather than
borrowed from an English-shaped library.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_PARAGRAPH_RE = re.compile(r"\n\s*\n+")
_SENTENCE_RE = re.compile(r"(?<=[.!?؟。])\s+|(?<=[:：])\s*\n")
_WHITESPACE_RE = re.compile(r"[ \t\u00a0]+")
# Zero-width joiners and bidi marks survive copy-paste out of Word and poison exact matching.
_INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    heading: str


def normalise(text: str) -> str:
    """Canonical form for storage and embedding — never for display back to the author."""
    cleaned = unicodedata.normalize("NFC", text or "")
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = _INVISIBLE_RE.sub("", cleaned)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return "\n".join(line.strip() for line in cleaned.split("\n")).strip()


def _looks_like_heading(paragraph: str) -> bool:
    stripped = paragraph.strip()
    return (
        bool(stripped)
        and "\n" not in stripped
        and len(stripped) <= 90
        and not stripped.endswith(".")
    )


def _split_long_paragraph(paragraph: str, limit: int) -> list[str]:
    """A single paragraph longer than the target, cut on sentence ends rather than mid-word."""
    sentences = [s.strip() for s in _SENTENCE_RE.split(paragraph) if s.strip()]
    if not sentences:
        return [paragraph[:limit]]

    parts: list[str] = []
    current = ""
    for sentence in sentences:
        while len(sentence) > limit:
            # A "sentence" this long has no punctuation at all; cut on a space near the limit.
            cut = sentence.rfind(" ", 0, limit) or limit
            parts.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if not current:
            current = sentence
        elif len(current) + len(sentence) + 1 <= limit:
            current = f"{current} {sentence}"
        else:
            parts.append(current)
            current = sentence
    if current:
        parts.append(current)
    return [p for p in parts if p]


def chunk_document(
    text: str,
    *,
    target_chars: int = 1100,
    overlap_chars: int = 150,
    min_split_chars: int = 1400,
) -> list[Chunk]:
    """The document as one chunk, or as several that each still make sense alone."""
    body = normalise(text)
    if not body:
        return []

    paragraphs = [p.strip() for p in _PARAGRAPH_RE.split(body) if p.strip()]
    heading = paragraphs[0] if paragraphs and _looks_like_heading(paragraphs[0]) else ""

    # The common case, and the one worth protecting: a whole small procedure, undivided.
    if len(body) <= min_split_chars:
        return [Chunk(index=0, text=body, heading=heading)]

    # The heading is put back on top of every chunk below, so it is not also a piece of its
    # own -- leaving it in produced a first chunk that was nothing but the title.
    body_paragraphs = paragraphs[1:] if heading else paragraphs

    pieces: list[str] = []
    for paragraph in body_paragraphs:
        if len(paragraph) > target_chars:
            pieces.extend(_split_long_paragraph(paragraph, target_chars))
        else:
            pieces.append(paragraph)

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        candidate = f"{current}\n\n{piece}" if current else piece
        if len(candidate) <= target_chars or not current:
            current = candidate
            continue
        chunks.append(current)
        tail = current[-overlap_chars:] if overlap_chars else ""
        # Start the overlap at a word boundary so the next chunk does not open mid-word.
        if tail and " " in tail:
            tail = tail[tail.index(" ") + 1 :]
        current = f"{tail}\n\n{piece}".strip() if tail else piece
    if current:
        chunks.append(current)

    # A tail too short to answer anything is folded back rather than stored: a two-line
    # remainder retrieves badly and then crowds out a chunk that would have helped.
    if len(chunks) > 1 and len(chunks[-1]) < 120:
        chunks[-2] = chunks[-2] + "\n\n" + chunks.pop()

    # The heading is repeated into every chunk: a fragment that has lost the title off
    # the top is a fragment a search for that title can no longer find.
    return [
        Chunk(
            index=index,
            text=(heading + "\n\n" + chunk) if heading else chunk,
            heading=heading,
        )
        for index, chunk in enumerate(chunks)
    ]

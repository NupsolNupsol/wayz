"""Finding the training videos inside a knowledge document.

A URL in a procedure document is a pointer for a human, not something this service is
interested in reading. It is extracted, normalised and stored as metadata — it is never
fetched. That is deliberate: a document is uploaded by an administrator and an uploaded
string that the server dereferences is an SSRF waiting to be written, so the server does
not dereference it at all. The browser renders it as a link, and the browser is the only
thing that ever contacts YouTube.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

# Deliberately not "any URL": only the video hosts we are prepared to render as a training
# link. Anything else in a document stays plain text.
_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}

_URL_RE = re.compile(r"https?://[^\s<>\"'\)\]،؛]+", re.IGNORECASE)
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,20}$")

#: A line that introduces the link below it, e.g. `فيديو الشرح:` — a caption, not a sentence.
_CAPTION_RE = re.compile(r"^.{2,60}[:：]\s*$")


def _video_id(url: str) -> str | None:
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        return None

    if host.endswith("youtu.be"):
        candidate = parsed.path.lstrip("/").split("/")[0]
    elif parsed.path.startswith(("/embed/", "/v/", "/shorts/", "/live/")):
        candidate = parsed.path.split("/")[2] if len(parsed.path.split("/")) > 2 else ""
    else:
        candidate = (parse_qs(parsed.query).get("v") or [""])[0]

    candidate = candidate.strip()
    return candidate if _ID_RE.match(candidate) else None


def canonical_url(url: str) -> str | None:
    """A watch URL we are willing to render, or None if this is not a YouTube video."""
    vid = _video_id(url)
    return f"https://www.youtube.com/watch?v={vid}" if vid else None


def extract_youtube_urls(text: str) -> list[str]:
    """Every distinct YouTube video in the document, in the order it appears."""
    seen: list[str] = []
    for raw in _URL_RE.findall(text or ""):
        cleaned = raw.rstrip(".,;:!؟?)")
        canonical = canonical_url(cleaned)
        if canonical and canonical not in seen:
            seen.append(canonical)
    return seen


def video_titles(text: str, urls: list[str], fallback: str) -> dict[str, str]:
    """A caption for each link, taken from the line that introduced it where there is one.

    The documents are written by hand and nearly always say `فيديو الشرح:` on the line above
    the link, which is a better label for a button than the document's own title.
    """
    lines = (text or "").splitlines()
    titles: dict[str, str] = {}
    for index, line in enumerate(lines):
        for raw in _URL_RE.findall(line):
            canonical = canonical_url(raw.rstrip(".,;:!؟?)"))
            if not canonical or canonical in titles:
                continue
            label = line.split("http")[0].strip(" -•\t:：")
            if not label:
                for back in range(index - 1, max(index - 3, -1), -1):
                    previous = lines[back].strip()
                    if not previous:
                        continue
                    if _CAPTION_RE.match(previous):
                        label = previous.rstrip(" :：")
                    break
            titles[canonical] = (label or fallback)[:120]
    return {url: titles.get(url, fallback)[:120] for url in urls}

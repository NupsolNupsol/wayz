"""Prompt text, kept in files rather than buried in a service.

A system prompt is the product's behaviour written down. It gets reviewed, diffed and argued
over like any other rule, and none of that happens to a 60-line string literal wedged inside
a function. It is read once at import and cached.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_HERE = Path(__file__).parent


@lru_cache(maxsize=8)
def load_prompt(name: str) -> str:
    path = _HERE / f"{name}.md"
    if not path.is_file():
        raise FileNotFoundError(f"No prompt named {name}")
    return path.read_text(encoding="utf-8").strip()


def system_prompt(locale: str = "ar") -> str:
    del locale  # Arabic-first by product decision; the seam is here when a second one lands.
    return load_prompt("system_ar")

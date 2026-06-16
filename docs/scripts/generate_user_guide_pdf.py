#!/usr/bin/env python3
"""Generate docs/User-Guide.pdf from docs/USER_GUIDE.md."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from pdf_renderer import generate_pdf

MD_PATH = ROOT / "docs" / "USER_GUIDE.md"
PDF_PATH = ROOT / "docs" / "User-Guide.pdf"
HEADER = "The Lighthouse - User Guide"


def main() -> int:
    if not MD_PATH.exists():
        print(f"Missing source file: {MD_PATH}", file=sys.stderr)
        return 1
    generate_pdf(MD_PATH, PDF_PATH, HEADER)
    print(f"Wrote {PDF_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

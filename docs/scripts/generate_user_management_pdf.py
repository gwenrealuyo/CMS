#!/usr/bin/env python3
"""Generate docs/User-Management-Guide.pdf from docs/USER_MANAGEMENT_GUIDE.md."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[2]
MD_PATH = ROOT / "docs" / "USER_MANAGEMENT_GUIDE.md"
PDF_PATH = ROOT / "docs" / "User-Management-Guide.pdf"


class GuidePDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "Church CMS - User Management Guide", align="C")
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def sanitize(text: str) -> str:
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u2192": "->",
        "\u2190": "<-",
        "\u2713": "[x]",
        "\u2610": "[ ]",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("ascii", "replace").decode("ascii")


def write_wrapped(pdf: GuidePDF, text: str, size: int = 10, style: str = ""):
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", style, size)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 5.5, sanitize(text))


def render_markdown(md_text: str) -> GuidePDF:
    pdf = GuidePDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    in_table = False
    table_rows: list[list[str]] = []

    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            in_table = False
            return
        col_count = max(len(r) for r in table_rows)
        page_w = pdf.w - pdf.l_margin - pdf.r_margin
        col_w = page_w / col_count
        pdf.set_font("Helvetica", "", 8)
        for i, row in enumerate(table_rows):
            if i == 1 and all(re.match(r"^[-:]+$", c.strip()) for c in row):
                continue
            pdf.set_fill_color(245, 245, 245 if i == 0 else 255)
            for j in range(col_count):
                cell = row[j] if j < len(row) else ""
                style = "B" if i == 0 else ""
                pdf.set_font("Helvetica", style, 8)
                pdf.cell(col_w, 6, sanitize(cell.strip())[:48], border=1, fill=(i == 0))
            pdf.ln()
        pdf.ln(2)
        table_rows = []
        in_table = False

    for raw_line in md_text.splitlines():
        line = raw_line.rstrip()

        if line.startswith("|") and "|" in line[1:]:
            cells = [c.strip() for c in line.strip("|").split("|")]
            in_table = True
            table_rows.append(cells)
            continue
        if in_table:
            flush_table()

        if not line.strip():
            pdf.ln(2)
            continue

        if line.strip() == "---":
            pdf.ln(1)
            pdf.set_draw_color(200, 200, 200)
            y = pdf.get_y()
            pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
            pdf.ln(4)
            continue

        if line.startswith("# "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 18)
            pdf.set_text_color(20, 50, 90)
            pdf.multi_cell(0, 8, sanitize(line[2:].strip()))
            pdf.ln(2)
            continue

        if line.startswith("## "):
            flush_table()
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 13)
            pdf.set_text_color(20, 50, 90)
            pdf.multi_cell(0, 7, sanitize(line[3:].strip()))
            pdf.ln(1)
            continue

        if line.startswith("### "):
            flush_table()
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(40, 40, 40)
            pdf.multi_cell(0, 6, sanitize(line[4:].strip()))
            pdf.ln(1)
            continue

        bullet = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if bullet:
            indent, marker, content = bullet.groups()
            pdf.set_x(pdf.l_margin)
            prefix = "- " if marker in "-*" else f"{marker} "
            write_wrapped(pdf, prefix + content.strip(), size=9)
            continue

        if line.startswith("**") and line.endswith("**"):
            write_wrapped(pdf, line.strip("*"), size=10, style="B")
            continue

        write_wrapped(pdf, re.sub(r"\*\*(.+?)\*\*", r"\1", line), size=9)

    flush_table()
    return pdf


def main() -> int:
    if not MD_PATH.exists():
        print(f"Missing source file: {MD_PATH}", file=sys.stderr)
        return 1

    md_text = MD_PATH.read_text(encoding="utf-8")
    pdf = render_markdown(md_text)
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(PDF_PATH))
    print(f"Wrote {PDF_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Normalize person/prospect name fields to title case on write."""

from __future__ import annotations

import re
from typing import Iterable, Mapping, MutableMapping, Optional

PERSON_NAME_FIELDS = (
    "first_name",
    "last_name",
    "middle_name",
    "suffix",
    "nickname",
    "maiden_name",
)

PROSPECT_NAME_FIELDS = (
    "first_name",
    "last_name",
    "middle_name",
    "suffix",
)

_ROMAN_NUMERAL = re.compile(r"^[ivxlcdm]+$", re.IGNORECASE)
_MC_MAC_PREFIX = re.compile(r"^(mac|mc)(.+)$", re.IGNORECASE)

# Lowercased when reformatting all-lower / all-upper input (not first meaningful surname style).
_NAME_PARTICLES = frozenset(
    {
        "a",
        "af",
        "av",
        "da",
        "das",
        "de",
        "del",
        "dela",
        "dem",
        "den",
        "der",
        "di",
        "do",
        "dos",
        "du",
        "e",
        "el",
        "la",
        "las",
        "le",
        "les",
        "lo",
        "los",
        "op",
        "san",
        "santa",
        "st",
        "ste",
        "ten",
        "ter",
        "van",
        "von",
        "y",
    }
)


def _letters_only(text: str) -> str:
    return "".join(ch for ch in text if ch.isalpha())


def _is_uniform_letter_case(text: str) -> bool:
    """True when alphabetic chars are all lowercase or all uppercase (safe to reformat)."""
    letters = _letters_only(text)
    if not letters:
        return False
    return letters.islower() or letters.isupper()


def _title_case_part(part: str) -> str:
    if not part:
        return part
    if _ROMAN_NUMERAL.fullmatch(part):
        return part.upper()

    match = _MC_MAC_PREFIX.fullmatch(part)
    if match:
        prefix, rest = match.group(1), match.group(2)
        if rest:
            prefix_out = "Mc" if prefix.lower() == "mc" else "Mac"
            return prefix_out + rest[:1].upper() + rest[1:].lower()

    return part[:1].upper() + part[1:].lower()


def _title_case_token(token: str) -> str:
    if not token:
        return token
    if _ROMAN_NUMERAL.fullmatch(token):
        return token.upper()
    if token.lower() in _NAME_PARTICLES:
        return token.lower()
    return "-".join(_title_case_part(part) if part else part for part in token.split("-"))


def title_case_name(value: Optional[str]) -> str:
    """
    Normalize a name string on write.

    - Mixed-case input (e.g. McDonald, de la Cruz) is preserved after strip.
    - All-lowercase or all-uppercase input is title-cased, with:
      - particles (de, la, del, van, …) lowercased
      - Mc/Mac mid-capitals (mcdonald → McDonald)
      - Roman-numeral tokens (iii → III)
    """
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""

    if not _is_uniform_letter_case(text):
        return text

    return " ".join(_title_case_token(token) for token in text.split())


def apply_title_case_name_fields(
    attrs: MutableMapping,
    fields: Iterable[str] = PERSON_NAME_FIELDS,
) -> MutableMapping:
    """Title-case any present name fields in a serializer attrs dict (in place)."""
    for field in fields:
        if field in attrs and attrs[field] is not None:
            attrs[field] = title_case_name(attrs[field])
    return attrs


def title_cased_name_kwargs(data: Mapping, fields: Iterable[str]) -> dict:
    """Return a kwargs dict with selected name fields title-cased."""
    out = {}
    for field in fields:
        if field in data:
            out[field] = title_case_name(data.get(field))
    return out

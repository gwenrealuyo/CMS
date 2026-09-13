"""Baptism and Holy Ghost journey verifiers (baptizer / witness)."""

from __future__ import annotations

from rest_framework import serializers

from apps.people.models import Journey, Person
from apps.people.name_formatting import format_person_display_name, title_case_name

UNSET = object()

BAPTISM_JOURNEY_TYPE = "BAPTISM"
SPIRIT_JOURNEY_TYPE = "SPIRIT"
BAPTISM_VERIFIER_EXCLUDED_ROLES = ("ADMIN", "VISITOR")


def baptism_verifier_queryset():
    """People who may be selected as baptizer or Holy Ghost witness."""
    return Person.objects.exclude(role__in=BAPTISM_VERIFIER_EXCLUDED_ROLES)

_STASH_PERSON_ATTR = {
    BAPTISM_JOURNEY_TYPE: "_baptism_verified_by",
    SPIRIT_JOURNEY_TYPE: "_spirit_verified_by",
}
_STASH_FIRST_ATTR = {
    BAPTISM_JOURNEY_TYPE: "_baptism_hist_first",
    SPIRIT_JOURNEY_TYPE: "_spirit_hist_first",
}
_STASH_LAST_ATTR = {
    BAPTISM_JOURNEY_TYPE: "_baptism_hist_last",
    SPIRIT_JOURNEY_TYPE: "_spirit_hist_last",
}

HISTORICAL_NAME_PAIR_ERROR = (
    "Enter both first and last name, or leave both blank."
)


def baptism_journey(person: Person | None, journey_type: str) -> Journey | None:
    if person is None or not getattr(person, "pk", None):
        return None
    prefetched = getattr(person, "_prefetched_objects_cache", None)
    if prefetched is not None and "journeys" in prefetched:
        for journey in prefetched["journeys"]:
            if journey.type == journey_type:
                return journey
        return None
    return (
        Journey.objects.filter(user=person, type=journey_type)
        .select_related("verified_by")
        .first()
    )


def journey_verified_by(person: Person | None, journey_type: str) -> Person | None:
    journey = baptism_journey(person, journey_type)
    return journey.verified_by if journey else None


def historical_verifier_names(
    person: Person | None, journey_type: str
) -> tuple[str, str]:
    journey = baptism_journey(person, journey_type)
    if not journey:
        return "", ""
    return (
        (journey.historical_verified_first_name or "").strip(),
        (journey.historical_verified_last_name or "").strip(),
    )


def format_historical_verifier_name(first_name: str, last_name: str) -> str | None:
    name = " ".join(
        part for part in ((first_name or "").strip(), (last_name or "").strip()) if part
    ).strip()
    return name or None


def journey_verifier_display_name(journey: Journey | None) -> str | None:
    if journey is None:
        return None
    if journey.verified_by_id:
        return verifier_display_name(journey.verified_by)
    return format_historical_verifier_name(
        journey.historical_verified_first_name,
        journey.historical_verified_last_name,
    )


def person_verifier_display_name(person: Person | None, journey_type: str) -> str | None:
    return journey_verifier_display_name(baptism_journey(person, journey_type))


def verifier_display_name(person: Person | None) -> str | None:
    if person is None:
        return None
    return format_person_display_name(person) or None


def validate_historical_name_pair(first_name, last_name, *, first_field: str) -> None:
    first = (first_name or "").strip()
    last = (last_name or "").strip()
    if bool(first) != bool(last):
        raise serializers.ValidationError({first_field: HISTORICAL_NAME_PAIR_ERROR})


def normalize_historical_name(value) -> str:
    if value is UNSET or value is None:
        return ""
    return title_case_name(str(value))


def stash_baptism_verifiers(
    person: Person,
    *,
    baptized_by=UNSET,
    hg_witnessed_by=UNSET,
    baptized_by_first_name=UNSET,
    baptized_by_last_name=UNSET,
    hg_witnessed_by_first_name=UNSET,
    hg_witnessed_by_last_name=UNSET,
) -> None:
    if baptized_by is not UNSET:
        setattr(person, _STASH_PERSON_ATTR[BAPTISM_JOURNEY_TYPE], baptized_by)
    if hg_witnessed_by is not UNSET:
        setattr(person, _STASH_PERSON_ATTR[SPIRIT_JOURNEY_TYPE], hg_witnessed_by)
    if baptized_by_first_name is not UNSET:
        setattr(
            person,
            _STASH_FIRST_ATTR[BAPTISM_JOURNEY_TYPE],
            normalize_historical_name(baptized_by_first_name),
        )
    if baptized_by_last_name is not UNSET:
        setattr(
            person,
            _STASH_LAST_ATTR[BAPTISM_JOURNEY_TYPE],
            normalize_historical_name(baptized_by_last_name),
        )
    if hg_witnessed_by_first_name is not UNSET:
        setattr(
            person,
            _STASH_FIRST_ATTR[SPIRIT_JOURNEY_TYPE],
            normalize_historical_name(hg_witnessed_by_first_name),
        )
    if hg_witnessed_by_last_name is not UNSET:
        setattr(
            person,
            _STASH_LAST_ATTR[SPIRIT_JOURNEY_TYPE],
            normalize_historical_name(hg_witnessed_by_last_name),
        )


def stashed_verifier(person: Person, journey_type: str):
    attr = _STASH_PERSON_ATTR.get(journey_type)
    if not attr or not hasattr(person, attr):
        return UNSET
    return getattr(person, attr)


def stashed_historical_names(person: Person, journey_type: str):
    first_attr = _STASH_FIRST_ATTR.get(journey_type)
    last_attr = _STASH_LAST_ATTR.get(journey_type)
    if not first_attr or not last_attr:
        return UNSET, UNSET
    first = getattr(person, first_attr, UNSET)
    last = getattr(person, last_attr, UNSET)
    return first, last


def apply_stashed_verifiers_to_journey(
    journey: Journey, person: Person, journey_type: str
) -> None:
    verified_by = stashed_verifier(person, journey_type)
    first_name, last_name = stashed_historical_names(person, journey_type)
    apply_verifier_fields(
        journey,
        verified_by=verified_by,
        first_name=first_name,
        last_name=last_name,
    )


def apply_verifier_fields(
    journey: Journey,
    *,
    verified_by=UNSET,
    first_name=UNSET,
    last_name=UNSET,
) -> None:
    live_person = verified_by is not UNSET and verified_by is not None
    hist_in_payload = first_name is not UNSET or last_name is not UNSET
    first = "" if first_name is UNSET else (first_name or "")
    last = "" if last_name is UNSET else (last_name or "")
    has_hist = bool(first or last)

    if live_person:
        journey.verified_by = verified_by
        journey.historical_verified_first_name = ""
        journey.historical_verified_last_name = ""
        return

    if hist_in_payload:
        journey.historical_verified_first_name = first
        journey.historical_verified_last_name = last
        if has_hist or verified_by is not UNSET:
            journey.verified_by = None
        return

    if verified_by is not UNSET:
        journey.verified_by = verified_by

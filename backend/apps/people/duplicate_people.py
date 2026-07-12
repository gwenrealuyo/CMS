"""Helpers for finding possible duplicate Person records."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from django.db.models import Count
from django.db.models.functions import Lower, Trim

from apps.people.models import Person


def _person_summary(person: Person) -> Dict[str, Any]:
    return {
        "id": person.id,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "middle_name": person.middle_name or "",
        "username": person.username,
        "email": person.email or "",
        "phone": person.phone or "",
        "member_id": person.member_id or "",
        "role": person.role,
        "status": person.status or "",
        "branch_id": person.branch_id,
        "branch_name": person.branch.name if person.branch_id else None,
        "branch_code": person.branch.code if person.branch_id else None,
    }


def _group_same_branch(people: List[Person]) -> bool:
    branch_ids = {p.branch_id for p in people}
    return len(branch_ids) == 1


def find_possible_people_duplicate_groups(
    *,
    match: str = "both",
    branch_id: Optional[int] = None,
    same_branch_only: bool = False,
) -> List[Dict[str, Any]]:
    """
    Return groups of people that look like duplicates.

    match: "name" | "member_id" | "both"
    - name: same first+last (case-insensitive, trimmed); both parts non-empty
    - member_id: same non-empty LAMP ID (case-insensitive, trimmed)
    """
    match = (match or "both").strip().lower()
    if match not in ("name", "member_id", "both"):
        match = "both"

    base = Person.objects.all().select_related("branch")
    if branch_id is not None:
        base = base.filter(branch_id=branch_id)

    groups: List[Dict[str, Any]] = []

    if match in ("name", "both"):
        name_qs = (
            base.annotate(
                fn=Lower(Trim("first_name")),
                ln=Lower(Trim("last_name")),
            )
            .exclude(fn="")
            .exclude(ln="")
        )
        name_keys = (
            name_qs.values("fn", "ln")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
            .order_by("-count", "ln", "fn")
        )
        for row in name_keys:
            people = list(
                name_qs.filter(fn=row["fn"], ln=row["ln"]).order_by("id")
            )
            same_branch = _group_same_branch(people)
            if same_branch_only and not same_branch:
                continue
            groups.append(
                {
                    "match_type": "name",
                    "key": f"{row['fn']}|{row['ln']}",
                    "label": f"{people[0].first_name} {people[0].last_name}".strip(),
                    "count": len(people),
                    "same_branch": same_branch,
                    "people": [_person_summary(p) for p in people],
                }
            )

    if match in ("member_id", "both"):
        mid_qs = base.annotate(mid=Lower(Trim("member_id"))).exclude(mid="")
        mid_keys = (
            mid_qs.values("mid")
            .annotate(count=Count("id"))
            .filter(count__gt=1)
            .order_by("-count", "mid")
        )
        for row in mid_keys:
            people = list(mid_qs.filter(mid=row["mid"]).order_by("id"))
            same_branch = _group_same_branch(people)
            if same_branch_only and not same_branch:
                continue
            groups.append(
                {
                    "match_type": "member_id",
                    "key": row["mid"],
                    "label": people[0].member_id.strip(),
                    "count": len(people),
                    "same_branch": same_branch,
                    "people": [_person_summary(p) for p in people],
                }
            )

    return groups

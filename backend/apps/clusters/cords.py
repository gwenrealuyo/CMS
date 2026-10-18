"""Helpers for 5x5 Cord membership, eligibility, and cluster sync."""

from __future__ import annotations

from typing import Iterable, Optional

from django.db.models import Q, QuerySet

from apps.people.models import Person
from apps.people.name_formatting import format_person_display_name

from .models import (
    CORD_ELIGIBLE_STATUSES,
    CORD_TARGET_SIZE,
    Cluster,
    ClusterCord,
    ClusterCordMembership,
)


def cord_eligible_q(prefix: str = "") -> Q:
    """Q() for people eligible for 5x5 Cord membership."""
    role_field = f"{prefix}role"
    status_field = f"{prefix}status"
    return (
        ~Q(**{role_field: "ADMIN"})
        & ~Q(**{role_field: "VISITOR"})
        & Q(**{f"{status_field}__in": CORD_ELIGIBLE_STATUSES})
    )


def is_person_cord_eligible(person: Person, cluster: Cluster) -> bool:
    if person.role in ("ADMIN", "VISITOR"):
        return False
    if person.status not in CORD_ELIGIBLE_STATUSES:
        return False
    return cluster.members.filter(id=person.id).exists()


def eligible_members_queryset(cluster: Cluster) -> QuerySet[Person]:
    return cluster.members.filter(cord_eligible_q()).distinct()


def active_cord_person_ids(cluster: Cluster, exclude_cord_id: Optional[int] = None) -> set[int]:
    qs = ClusterCordMembership.objects.filter(
        cord__cluster=cluster,
        cord__is_active=True,
    )
    if exclude_cord_id is not None:
        qs = qs.exclude(cord_id=exclude_cord_id)
    return set(qs.values_list("person_id", flat=True))


def size_warning_for_count(member_count: int) -> Optional[str]:
    if member_count == CORD_TARGET_SIZE:
        return None
    if member_count < CORD_TARGET_SIZE:
        return (
            f"Cord has {member_count} member(s); target size is {CORD_TARGET_SIZE}."
        )
    return (
        f"Cord has {member_count} members; target size is {CORD_TARGET_SIZE}."
    )


def person_summary(person: Optional[Person]) -> Optional[dict]:
    if person is None:
        return None
    return {
        "id": person.id,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "middle_name": person.middle_name or "",
        "suffix": person.suffix or "",
        "nickname": person.nickname or "",
        "display_name": format_person_display_name(person),
        "status": person.status,
        "role": person.role,
    }


def validate_cord_member_ids(
    cluster: Cluster,
    member_ids: Iterable[int],
    *,
    exclude_cord_id: Optional[int] = None,
) -> list[int]:
    """
    Validate and return normalized unique member IDs.

    Raises ValueError with a message suitable for serializer ValidationError.
    """
    ids = list(dict.fromkeys(int(i) for i in member_ids))
    if not ids:
        return []

    people = {p.id: p for p in Person.objects.filter(id__in=ids)}
    missing = [i for i in ids if i not in people]
    if missing:
        raise ValueError(f"Unknown person id(s): {missing}.")

    cluster_member_ids = set(cluster.members.values_list("id", flat=True))
    already_assigned = active_cord_person_ids(cluster, exclude_cord_id=exclude_cord_id)

    errors: list[str] = []
    for pid in ids:
        person = people[pid]
        if pid not in cluster_member_ids:
            errors.append(f"{format_person_display_name(person)} is not a cluster member.")
            continue
        if person.role in ("ADMIN", "VISITOR"):
            errors.append(
                f"{format_person_display_name(person)} is not eligible (role={person.role})."
            )
            continue
        if person.status not in CORD_ELIGIBLE_STATUSES:
            errors.append(
                f"{format_person_display_name(person)} is not eligible "
                f"(status={person.status})."
            )
            continue
        if pid in already_assigned:
            errors.append(
                f"{format_person_display_name(person)} is already in another active cord "
                f"in this cluster."
            )
    if errors:
        raise ValueError(" ".join(errors))
    return ids


def set_cord_members(cord: ClusterCord, member_ids: list[int]) -> None:
    existing = {
        m.person_id: m
        for m in ClusterCordMembership.objects.filter(cord=cord)
    }
    desired = set(member_ids)
    to_remove = [pid for pid in existing if pid not in desired]
    if to_remove:
        ClusterCordMembership.objects.filter(cord=cord, person_id__in=to_remove).delete()
    for pid in member_ids:
        if pid not in existing:
            ClusterCordMembership.objects.create(cord=cord, person_id=pid)


def deactivate_cord(cord: ClusterCord) -> ClusterCord:
    """Soft-deactivate a cord and clear memberships so people become unassigned."""
    ClusterCordMembership.objects.filter(cord=cord).delete()
    cord.sub_coordinator = None
    cord.is_active = False
    cord.save(update_fields=["sub_coordinator", "is_active", "updated_at"])
    return cord


def prune_cord_memberships_for_removed_cluster_members(cluster: Cluster) -> int:
    """
    Drop cord memberships for people no longer on the cluster roster.
    Clears sub_coordinator when they leave the roster.
    """
    roster_ids = set(cluster.members.values_list("id", flat=True))
    stale = ClusterCordMembership.objects.filter(cord__cluster=cluster).exclude(
        person_id__in=roster_ids
    )
    removed = stale.count()
    if removed:
        stale.delete()

    for cord in cluster.cords.filter(is_active=True, sub_coordinator_id__isnull=False):
        if cord.sub_coordinator_id not in roster_ids:
            cord.sub_coordinator = None
            cord.save(update_fields=["sub_coordinator", "updated_at"])
        elif not ClusterCordMembership.objects.filter(
            cord=cord, person_id=cord.sub_coordinator_id
        ).exists():
            cord.sub_coordinator = None
            cord.save(update_fields=["sub_coordinator", "updated_at"])
    return removed


def default_cord_name(cluster: Cluster) -> str:
    active_count = cluster.cords.filter(is_active=True).count()
    return f"Cord {active_count + 1}"


def cords_summary_for_cluster(cluster: Cluster) -> dict:
    cord_count = cluster.cords.filter(is_active=True).count()
    eligible_ids = set(eligible_members_queryset(cluster).values_list("id", flat=True))
    assigned_ids = active_cord_person_ids(cluster)
    return {
        "cord_count": cord_count,
        "eligible_count": len(eligible_ids),
        "unassigned_eligible_count": len(eligible_ids - assigned_ids),
    }


def active_cord_membership_for_person(
    person_id: int, *, cluster_id: Optional[int] = None
) -> Optional[ClusterCordMembership]:
    """Return the person's active cord membership, optionally scoped to a cluster."""
    qs = (
        ClusterCordMembership.objects.filter(
            person_id=person_id,
            cord__is_active=True,
        )
        .select_related("cord", "cord__sub_coordinator")
        .order_by("cord_id")
    )
    if cluster_id is not None:
        qs = qs.filter(cord__cluster_id=cluster_id)
    return qs.first()


def cord_payload_from_membership(
    membership: Optional[ClusterCordMembership],
) -> Optional[dict]:
    if membership is None:
        return None
    cord = membership.cord
    sub = cord.sub_coordinator
    return {
        "id": cord.id,
        "name": cord.name,
        "cluster_id": cord.cluster_id,
        "sub_coordinator_id": cord.sub_coordinator_id,
        "sub_coordinator_name": (
            format_person_display_name(sub) if sub is not None else None
        ),
    }

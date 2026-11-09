"""Primary cluster membership helpers and approved cluster transfer apply."""

from __future__ import annotations

from typing import Iterable, Optional, Sequence, Union

from django.db import transaction
from django.core.exceptions import ValidationError

from apps.people.models import Journey, Person
from core.datetime_utils import church_today

from .cords import prune_cord_memberships_for_removed_cluster_members
from .models import Cluster


def membership_cluster_ids(person: Person) -> list[int]:
    return list(person.clusters.order_by("id").values_list("id", flat=True))


def cluster_display_name(cluster: Cluster) -> str:
    return cluster.code or cluster.name or str(cluster.id)


def sync_primary_cluster(
    person: Person,
    *,
    preferred_cluster_id: Optional[int] = None,
    raise_if_ambiguous: bool = False,
) -> Optional[int]:
    """
    Enforce primary-cluster invariants for ``person``.

    - 0 memberships → clear primary
    - 1 membership → that cluster is primary
    - 2+ memberships → keep preferred/current if still a member; otherwise
      raise when ``raise_if_ambiguous`` else pick lowest cluster id
    """
    ids = membership_cluster_ids(person)
    if not ids:
        if person.primary_cluster_id is not None:
            person.primary_cluster_id = None
            person.save(update_fields=["primary_cluster"])
        return None

    if len(ids) == 1:
        sole = ids[0]
        if person.primary_cluster_id != sole:
            person.primary_cluster_id = sole
            person.save(update_fields=["primary_cluster"])
        return sole

    candidate = preferred_cluster_id
    if candidate is None:
        candidate = person.primary_cluster_id
    if candidate is not None and candidate in ids:
        if person.primary_cluster_id != candidate:
            person.primary_cluster_id = candidate
            person.save(update_fields=["primary_cluster"])
        return candidate

    if raise_if_ambiguous:
        raise ValidationError(
            {
                "primary_cluster_id": (
                    "Select a primary cluster among the person's memberships."
                )
            }
        )

    provisional = min(ids)
    if person.primary_cluster_id != provisional:
        person.primary_cluster_id = provisional
        person.save(update_fields=["primary_cluster"])
    return provisional


def set_primary_cluster(person: Person, cluster: Cluster) -> None:
    if not person.clusters.filter(id=cluster.id).exists():
        raise ValidationError(
            {
                "primary_cluster_id": (
                    "Primary cluster must be one of the person's cluster memberships."
                )
            }
        )
    if person.primary_cluster_id != cluster.id:
        person.primary_cluster_id = cluster.id
        person.save(update_fields=["primary_cluster"])


def sync_primary_for_people(
    people: Union[Iterable[Person], Sequence[int], Iterable[int]],
    *,
    preferred_by_person: Optional[dict[int, int]] = None,
) -> None:
    preferred_by_person = preferred_by_person or {}
    if not people:
        return
    first = next(iter(people), None)
    if first is None:
        return
    if isinstance(first, Person):
        qs = list(people)
    else:
        qs = list(
            Person.objects.filter(id__in=list(people)).prefetch_related("clusters")
        )
    for person in qs:
        sync_primary_cluster(
            person,
            preferred_cluster_id=preferred_by_person.get(person.id),
            raise_if_ambiguous=False,
        )


def backfill_primary_clusters() -> dict:
    """Set primary for all people from current memberships. Returns counts."""
    updated_sole = 0
    updated_multi = 0
    cleared = 0
    people = Person.objects.prefetch_related("clusters").iterator(chunk_size=500)
    for person in people:
        ids = membership_cluster_ids(person)
        before = person.primary_cluster_id
        if not ids:
            if before is not None:
                person.primary_cluster_id = None
                person.save(update_fields=["primary_cluster"])
                cleared += 1
            continue
        if len(ids) == 1:
            sync_primary_cluster(person)
            if before != ids[0]:
                updated_sole += 1
        else:
            sync_primary_cluster(person, preferred_cluster_id=min(ids))
            if before != min(ids):
                updated_multi += 1
    return {
        "cleared": cleared,
        "updated_sole": updated_sole,
        "updated_multi": updated_multi,
    }


@transaction.atomic
def apply_cluster_transfer(
    person: Person,
    from_cluster: Cluster,
    to_cluster: Cluster,
    *,
    actor: Optional[Person] = None,
) -> None:
    """
    Leave ``from_cluster``, join ``to_cluster``, set primary to destination,
    prune cords on the left cluster, and write a CLUSTER journey.
    """
    if from_cluster.id == to_cluster.id:
        raise ValidationError(
            {"to_cluster": "Destination cluster must differ from the source cluster."}
        )
    if not person.clusters.filter(id=from_cluster.id).exists():
        raise ValidationError(
            {"from_cluster": "Person is not a member of the source cluster."}
        )

    to_cluster.members.add(person)
    from_cluster.members.remove(person)
    prune_cord_memberships_for_removed_cluster_members(from_cluster)

    update_fields = ["primary_cluster"]
    person.primary_cluster_id = to_cluster.id
    intended = getattr(person, "intended_cord", None)
    if intended is not None and (
        intended.cluster_id == from_cluster.id
        or not person.clusters.filter(id=intended.cluster_id).exists()
    ):
        person.intended_cord = None
        update_fields.append("intended_cord")
    person.save(update_fields=update_fields)
    sync_primary_cluster(person, preferred_cluster_id=to_cluster.id)

    from_label = cluster_display_name(from_cluster)
    to_label = cluster_display_name(to_cluster)
    Journey.objects.create(
        user=person,
        title=f"Added to cluster: {to_label}",
        date=church_today(),
        type="CLUSTER",
        description=f"Transferred from {from_label}.",
        verified_by=actor,
    )

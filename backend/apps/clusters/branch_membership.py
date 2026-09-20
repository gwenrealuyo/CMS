"""
Keep Cluster.members aligned with Person.branch vs Cluster.branch for branch-scoped clusters.

Legacy persons without branch_id are assigned the cluster's branch when added to a
branch-scoped cluster (cluster create/update).
"""

from typing import Iterable, Union

from django.db.models import Q

from apps.people.models import Person
from .models import Cluster


def family_members_eligible_for_cluster(
    cluster: Cluster, family_member_ids: Union[Iterable[int], set, list]
) -> set[int]:
    """
    Family members who may be auto-added to this cluster on save.

    Members already assigned to a different cluster are excluded; that membership
    takes priority and is not overridden by family assignment.
    """
    ids = set(family_member_ids)
    if not ids:
        return set()

    blocked = set(
        Person.objects.filter(id__in=ids, clusters__isnull=False)
        .exclude(clusters__id=cluster.id)
        .values_list("id", flat=True)
        .distinct()
    )
    return ids - blocked


def merge_cluster_member_ids(
    cluster: Cluster,
    user_member_ids: set[int],
    family_member_ids: set[int],
) -> set[int]:
    """Combine explicit members with eligible family members."""
    eligible_family = family_members_eligible_for_cluster(cluster, family_member_ids)
    return user_member_ids | eligible_family


def sync_member_branches_to_cluster(
    cluster: Cluster, member_ids: Union[Iterable[int], set, list]
) -> list[int]:
    """
    Set cluster.branch on the given members when they have no branch or a
    different branch. Used when members are assigned to a branch-scoped cluster.
    """
    if not cluster.branch_id or not member_ids:
        return []

    ids = list(member_ids)
    to_update = Person.objects.filter(id__in=ids).filter(
        Q(branch_id__isnull=True) | ~Q(branch_id=cluster.branch_id)
    )
    updated_ids = list(to_update.values_list("id", flat=True))
    if updated_ids:
        Person.objects.filter(id__in=updated_ids).update(branch_id=cluster.branch_id)
    return updated_ids


def assign_cluster_branch_to_branchless_members(cluster: Cluster) -> list[int]:
    """Set cluster.branch on all cluster members who have no branch assigned."""
    if not cluster.branch_id:
        return []

    member_ids = list(cluster.members.values_list("id", flat=True))
    return sync_member_branches_to_cluster(cluster, member_ids)


def prune_person_from_mismatched_branch_clusters(person: Person) -> None:
    """Drop memberships where cluster has a branch and it differs from this person's branch."""
    if person.branch_id is None:
        return
    mismatched = person.clusters.filter(branch_id__isnull=False).exclude(
        branch_id=person.branch_id
    )
    for cluster in mismatched:
        cluster.members.remove(person)


def prune_members_not_matching_cluster_branch(cluster: Cluster) -> None:
    """Remove members whose assigned branch conflicts with this cluster's branch."""
    if not cluster.branch_id:
        return

    outsiders = cluster.members.filter(branch_id__isnull=False).exclude(
        branch_id=cluster.branch_id
    )
    to_remove = list(outsiders)
    if to_remove:
        cluster.members.remove(*to_remove)


def clear_coordinator_if_invalid(cluster: Cluster) -> None:
    """Unset coordinator when coordinator belongs to a different branch than the cluster."""
    if not cluster.branch_id or not cluster.coordinator_id:
        return

    coord = cluster.coordinator
    if (
        coord
        and coord.branch_id is not None
        and coord.branch_id != cluster.branch_id
    ):
        cluster.coordinator = None
        cluster.save(update_fields=["coordinator"])


def ensure_coordinator_in_members(cluster: Cluster) -> None:
    """Add the cluster coordinator to members when coordinator is set (idempotent)."""
    if not cluster.coordinator_id:
        return
    cluster.members.add(cluster.coordinator)


def remove_person_from_other_active_clusters(
    cluster: Cluster, person_ids: Union[Iterable[int], set, list]
) -> dict[int, list[Cluster]]:
    """
    Remove the given people from every other *active* cluster.

    Returns a map of person_id -> list of clusters they were removed from
    (for journey descriptions). Ignores IDs not on ``cluster``'s roster.
    """
    ids = {int(pid) for pid in person_ids}
    if not ids or cluster.pk is None:
        return {}

    roster_ids = set(cluster.members.filter(id__in=ids).values_list("id", flat=True))
    if not roster_ids:
        return {}

    removed_from: dict[int, list[Cluster]] = {pid: [] for pid in roster_ids}
    other_clusters = (
        Cluster.objects.filter(is_active=True, members__id__in=roster_ids)
        .exclude(id=cluster.id)
        .distinct()
    )
    for other in other_clusters:
        overlap_ids = list(
            other.members.filter(id__in=roster_ids).values_list("id", flat=True)
        )
        if not overlap_ids:
            continue
        other.members.remove(*overlap_ids)
        for pid in overlap_ids:
            removed_from[pid].append(other)

    return {pid: clusters for pid, clusters in removed_from.items() if clusters}

"""
Keep Cluster.members aligned with Person.branch vs Cluster.branch for branch-scoped clusters.

Legacy persons without branch_id are not auto-removed from branch clusters when pruning by cluster save.
"""

from apps.people.models import Person
from .models import Cluster


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

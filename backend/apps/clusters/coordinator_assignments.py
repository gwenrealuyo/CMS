"""
Keep ModuleCoordinator scoped rows aligned with Cluster.coordinator / assistants /
reporters.
"""

from typing import Iterable, Optional, Set

from django.db import transaction

from apps.people.models import ModuleCoordinator

from .models import Cluster, ClusterCord

_CLUSTER = ModuleCoordinator.ModuleType.CLUSTER
_COORDINATOR = ModuleCoordinator.CoordinatorLevel.COORDINATOR
_ASSISTANT = ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR
_SENIOR = ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
_REPORTER = ModuleCoordinator.CoordinatorLevel.REPORTER

# Manual cluster-form reporters vs cord sub-coordinator auto-grants.
_RESOURCE_CLUSTER = "Cluster"
_RESOURCE_CLUSTER_CORD = "ClusterCord"

_LEADERSHIP_LEVELS = (_COORDINATOR, _ASSISTANT, _SENIOR)


def sync_cluster_coordinator_module_assignment(
    cluster: Cluster,
    previous_coordinator_id: Optional[int],
) -> None:
    """
    For this cluster's coordinator FK, ensure a ModuleCoordinator row exists with
    resource_id=cluster.id and level=COORDINATOR; remove that scoped row from the
    previous coordinator when the FK changes or is cleared.

    Does not modify SENIOR_COORDINATOR rows or legacy resource_id=None assignments.
    """
    if cluster.pk is None:
        return

    current_id = cluster.coordinator_id

    with transaction.atomic():
        if (
            previous_coordinator_id is not None
            and previous_coordinator_id != current_id
        ):
            ModuleCoordinator.objects.filter(
                person_id=previous_coordinator_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                level=_COORDINATOR,
            ).delete()

        if current_id is not None:
            # One scoped row per person on this cluster; clear assistant/reporter first.
            ModuleCoordinator.objects.filter(
                person_id=current_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                level__in=(_REPORTER, _ASSISTANT),
            ).delete()
            ModuleCoordinator.objects.update_or_create(
                person_id=current_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                defaults={
                    "level": _COORDINATOR,
                    "resource_type": "Cluster",
                },
            )


def sync_cluster_assistant_assignments(
    cluster: Cluster,
    assistant_person_ids: Iterable[int],
) -> None:
    """
    Replace CLUSTER ASSISTANT_COORDINATOR module rows for this cluster.

    Does not modify COORDINATOR / SENIOR_COORDINATOR rows. Skips the cluster
    coordinator. unique_together is (person, module, resource_id).
    """
    if cluster.pk is None:
        return

    desired = {int(pid) for pid in assistant_person_ids}
    if cluster.coordinator_id is not None:
        desired.discard(int(cluster.coordinator_id))

    with transaction.atomic():
        ModuleCoordinator.objects.filter(
            module=_CLUSTER,
            level=_ASSISTANT,
            resource_id=cluster.id,
        ).exclude(person_id__in=desired).delete()

        for person_id in desired:
            existing = ModuleCoordinator.objects.filter(
                person_id=person_id,
                module=_CLUSTER,
                resource_id=cluster.id,
            ).first()
            if existing and existing.level != _ASSISTANT:
                # Do not demote coordinator / senior-scoped rows; clear reporters
                # by replacing only when existing is reporter.
                if existing.level == _REPORTER:
                    existing.level = _ASSISTANT
                    existing.resource_type = "Cluster"
                    existing.save(update_fields=["level", "resource_type"])
                continue
            ModuleCoordinator.objects.update_or_create(
                person_id=person_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                defaults={
                    "level": _ASSISTANT,
                    "resource_type": "Cluster",
                },
            )


def sync_cluster_reporter_assignments(
    cluster: Cluster,
    reporter_person_ids: Iterable[int],
) -> None:
    """
    Replace manual CLUSTER REPORTER rows (resource_type=Cluster) for this cluster.

    Does not modify COORDINATOR / SENIOR_COORDINATOR / ASSISTANT rows, or
    cord-granted REPORTER rows (resource_type=ClusterCord). Skips the cluster
    coordinator. unique_together is (person, module, resource_id).
    """
    if cluster.pk is None:
        return

    desired = {int(pid) for pid in reporter_person_ids}
    if cluster.coordinator_id is not None:
        desired.discard(int(cluster.coordinator_id))

    with transaction.atomic():
        ModuleCoordinator.objects.filter(
            module=_CLUSTER,
            level=_REPORTER,
            resource_id=cluster.id,
            resource_type=_RESOURCE_CLUSTER,
        ).exclude(person_id__in=desired).delete()

        for person_id in desired:
            existing = ModuleCoordinator.objects.filter(
                person_id=person_id,
                module=_CLUSTER,
                resource_id=cluster.id,
            ).first()
            if existing and existing.level != _REPORTER:
                # Do not demote coordinator / assistant / senior-scoped rows.
                continue
            if existing and existing.resource_type == _RESOURCE_CLUSTER_CORD:
                # Upgrade cord-grant to manual when explicitly listed as reporter.
                existing.resource_type = _RESOURCE_CLUSTER
                existing.save(update_fields=["resource_type"])
                continue
            ModuleCoordinator.objects.update_or_create(
                person_id=person_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                defaults={
                    "level": _REPORTER,
                    "resource_type": _RESOURCE_CLUSTER,
                },
            )

        # Re-assert cord sub-coord grants (form save must not strip them).
        sync_cord_sub_coordinator_reporters(cluster)


def active_cord_sub_coordinator_ids(cluster: Cluster) -> Set[int]:
    """Person IDs who are sub-coordinator on any active cord in this cluster."""
    if cluster.pk is None:
        return set()
    return {
        int(pid)
        for pid in ClusterCord.objects.filter(
            cluster=cluster,
            is_active=True,
            sub_coordinator_id__isnull=False,
        ).values_list("sub_coordinator_id", flat=True)
    }


def _has_cluster_leadership(cluster: Cluster, person_id: int) -> bool:
    if cluster.coordinator_id is not None and int(cluster.coordinator_id) == int(
        person_id
    ):
        return True
    return ModuleCoordinator.objects.filter(
        person_id=person_id,
        module=_CLUSTER,
        resource_id=cluster.id,
        level__in=_LEADERSHIP_LEVELS,
    ).exists()


def grant_cord_sub_coordinator_reporter(cluster: Cluster, person_id: int) -> None:
    """
    Ensure a cord-granted REPORTER row for this person on the cluster.

    Skips cluster coordinator / assistant / senior. Leaves manual REPORTER
    (resource_type=Cluster) unchanged.
    """
    if cluster.pk is None or person_id is None:
        return
    person_id = int(person_id)
    if _has_cluster_leadership(cluster, person_id):
        return

    existing = ModuleCoordinator.objects.filter(
        person_id=person_id,
        module=_CLUSTER,
        resource_id=cluster.id,
    ).first()
    if existing is not None:
        if existing.level != _REPORTER:
            return
        if existing.resource_type == _RESOURCE_CLUSTER:
            # Manual reporter — do not retag as cord-granted.
            return
        if existing.resource_type != _RESOURCE_CLUSTER_CORD:
            existing.resource_type = _RESOURCE_CLUSTER_CORD
            existing.save(update_fields=["resource_type"])
        return

    ModuleCoordinator.objects.create(
        person_id=person_id,
        module=_CLUSTER,
        resource_id=cluster.id,
        level=_REPORTER,
        resource_type=_RESOURCE_CLUSTER_CORD,
    )


def sync_cord_sub_coordinator_reporters(cluster: Cluster) -> None:
    """
    Align cord-granted REPORTER rows with active cord sub-coordinators.

    Grants ClusterCord reporters for current sub-coords; removes ClusterCord
    reporter rows for people who are no longer any active cord's sub-coord.
    Manual Cluster reporters are never deleted here.
    """
    if cluster.pk is None:
        return

    desired = active_cord_sub_coordinator_ids(cluster)
    with transaction.atomic():
        for person_id in desired:
            grant_cord_sub_coordinator_reporter(cluster, person_id)

        ModuleCoordinator.objects.filter(
            module=_CLUSTER,
            level=_REPORTER,
            resource_id=cluster.id,
            resource_type=_RESOURCE_CLUSTER_CORD,
        ).exclude(person_id__in=desired).delete()


def prune_cluster_reporter_assignments_to_members(
    cluster: Cluster,
    member_ids: Iterable[int],
) -> None:
    """Drop REPORTER rows for people who are no longer cluster members."""
    if cluster.pk is None:
        return
    member_id_set = {int(pid) for pid in member_ids}
    ModuleCoordinator.objects.filter(
        module=_CLUSTER,
        level=_REPORTER,
        resource_id=cluster.id,
    ).exclude(person_id__in=member_id_set).delete()


def prune_cluster_assistant_assignments_to_members(
    cluster: Cluster,
    member_ids: Iterable[int],
) -> None:
    """Drop ASSISTANT_COORDINATOR rows for people who are no longer cluster members."""
    if cluster.pk is None:
        return
    member_id_set = {int(pid) for pid in member_ids}
    ModuleCoordinator.objects.filter(
        module=_CLUSTER,
        level=_ASSISTANT,
        resource_id=cluster.id,
    ).exclude(person_id__in=member_id_set).delete()

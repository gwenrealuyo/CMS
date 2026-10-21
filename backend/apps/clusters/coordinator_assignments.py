"""
Keep ModuleCoordinator scoped rows aligned with Cluster.coordinator / assistants /
reporters.
"""

from typing import Iterable, Optional

from django.db import transaction

from apps.people.models import ModuleCoordinator

from .models import Cluster

_CLUSTER = ModuleCoordinator.ModuleType.CLUSTER
_COORDINATOR = ModuleCoordinator.CoordinatorLevel.COORDINATOR
_ASSISTANT = ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR
_REPORTER = ModuleCoordinator.CoordinatorLevel.REPORTER


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
    Replace CLUSTER REPORTER module rows for this cluster with the given person IDs.

    Does not modify COORDINATOR / SENIOR_COORDINATOR / ASSISTANT rows. Skips the
    cluster coordinator. unique_together is (person, module, resource_id).
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
            ModuleCoordinator.objects.update_or_create(
                person_id=person_id,
                module=_CLUSTER,
                resource_id=cluster.id,
                defaults={
                    "level": _REPORTER,
                    "resource_type": "Cluster",
                },
            )


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

"""
Keep ModuleCoordinator scoped rows aligned with EvangelismGroup coordinator,
reporters, and Bible Sharers.
"""

from typing import Iterable, Optional

from django.db import transaction

from apps.people.models import ModuleCoordinator

from .models import EvangelismGroup

EVANGELISM_MODULE = ModuleCoordinator.ModuleType.EVANGELISM
RESOURCE_TYPE = "EvangelismGroup"
COORDINATOR = ModuleCoordinator.CoordinatorLevel.COORDINATOR
REPORTER = ModuleCoordinator.CoordinatorLevel.REPORTER
BIBLE_SHARER = ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER


def sync_evangelism_coordinator_module_assignment(
    group: EvangelismGroup,
    previous_coordinator_id: Optional[int],
) -> None:
    """
    Ensure a COORDINATOR row for the group FK; remove the previous coordinator's
    scoped COORDINATOR row when the FK changes.

    Coordinator replaces REPORTER and BIBLE_SHARER on the same group
    (unique_together is person + module + resource_id).
    """
    if group.pk is None:
        return

    current_id = group.coordinator_id

    with transaction.atomic():
        if (
            previous_coordinator_id is not None
            and previous_coordinator_id != current_id
        ):
            ModuleCoordinator.objects.filter(
                person_id=previous_coordinator_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
                level=COORDINATOR,
            ).delete()

        if current_id is not None:
            ModuleCoordinator.objects.filter(
                person_id=current_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
                level__in=(REPORTER, BIBLE_SHARER),
            ).delete()
            ModuleCoordinator.objects.update_or_create(
                person_id=current_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
                defaults={
                    "level": COORDINATOR,
                    "resource_type": RESOURCE_TYPE,
                },
            )


def sync_evangelism_bible_sharer_assignments(
    group: EvangelismGroup,
    bible_sharer_person_ids: Iterable[int],
) -> None:
    """
    Replace BIBLE_SHARER rows for this group. Skips the group coordinator.
    Upgrades REPORTER rows; does not demote COORDINATOR.
    """
    if group.pk is None:
        return

    desired = {int(pid) for pid in bible_sharer_person_ids}
    if group.coordinator_id is not None:
        desired.discard(int(group.coordinator_id))

    with transaction.atomic():
        ModuleCoordinator.objects.filter(
            module=EVANGELISM_MODULE,
            level=BIBLE_SHARER,
            resource_id=group.id,
        ).exclude(person_id__in=desired).delete()

        for person_id in desired:
            existing = ModuleCoordinator.objects.filter(
                person_id=person_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
            ).first()
            if existing and existing.level == COORDINATOR:
                continue
            ModuleCoordinator.objects.update_or_create(
                person_id=person_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
                defaults={
                    "level": BIBLE_SHARER,
                    "resource_type": RESOURCE_TYPE,
                },
            )


def sync_evangelism_reporter_assignments(
    group: EvangelismGroup,
    reporter_person_ids: Iterable[int],
) -> None:
    """
    Replace REPORTER rows for this group. Skips coordinator. Does not demote
    COORDINATOR or BIBLE_SHARER (Bible Sharers already have report access).
    """
    if group.pk is None:
        return

    desired = {int(pid) for pid in reporter_person_ids}
    if group.coordinator_id is not None:
        desired.discard(int(group.coordinator_id))

    with transaction.atomic():
        ModuleCoordinator.objects.filter(
            module=EVANGELISM_MODULE,
            level=REPORTER,
            resource_id=group.id,
        ).exclude(person_id__in=desired).delete()

        for person_id in desired:
            existing = ModuleCoordinator.objects.filter(
                person_id=person_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
            ).first()
            if existing and existing.level != REPORTER:
                continue
            ModuleCoordinator.objects.update_or_create(
                person_id=person_id,
                module=EVANGELISM_MODULE,
                resource_id=group.id,
                defaults={
                    "level": REPORTER,
                    "resource_type": RESOURCE_TYPE,
                },
            )


def prune_evangelism_role_assignments_to_members(
    group: EvangelismGroup,
    member_ids: Iterable[int],
) -> None:
    """Drop reporter and Bible Sharer rows for people who are no longer members."""
    if group.pk is None:
        return
    member_id_set = {int(pid) for pid in member_ids}
    ModuleCoordinator.objects.filter(
        module=EVANGELISM_MODULE,
        level__in=(REPORTER, BIBLE_SHARER),
        resource_id=group.id,
    ).exclude(person_id__in=member_id_set).delete()

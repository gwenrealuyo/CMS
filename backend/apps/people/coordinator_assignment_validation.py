"""Validation helpers for ModuleCoordinator assignments."""

from __future__ import annotations

from rest_framework import serializers

from apps.people.models import ModuleCoordinator, Person

RESOURCE_SCOPED_MODULES = frozenset(
    {
        ModuleCoordinator.ModuleType.CLUSTER,
        ModuleCoordinator.ModuleType.EVANGELISM,
        ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
    }
)


def resource_branch_id(module: str, resource_id: int) -> int | None:
    if module == ModuleCoordinator.ModuleType.CLUSTER:
        from apps.clusters.models import Cluster

        return (
            Cluster.objects.filter(pk=resource_id)
            .values_list("branch_id", flat=True)
            .first()
        )
    if module == ModuleCoordinator.ModuleType.EVANGELISM:
        from apps.evangelism.models import EvangelismGroup

        return (
            EvangelismGroup.objects.filter(pk=resource_id)
            .values_list("cluster__branch_id", flat=True)
            .first()
        )
    if module == ModuleCoordinator.ModuleType.SUNDAY_SCHOOL:
        from apps.sunday_school.models import SundaySchoolClassMember

        return (
            SundaySchoolClassMember.objects.filter(
                sunday_school_class_id=resource_id,
                is_active=True,
                person__branch_id__isnull=False,
            )
            .values_list("person__branch_id", flat=True)
            .first()
        )
    return None


def validate_module_coordinator_assignment(
    *,
    person: Person,
    module: str,
    level: str,
    resource_id,
    resource_type: str = "",
) -> dict:
    """
    Validate and normalize assignment fields. Raises ValidationError on failure.
    Returns dict with normalized resource_id and resource_type.
    """
    errors = {}

    if level == ModuleCoordinator.CoordinatorLevel.REPORTER:
        if module != ModuleCoordinator.ModuleType.CLUSTER:
            errors["level"] = "Reporter assignments are only available for the Cluster module."
        elif resource_id is None:
            errors["resource_id"] = (
                "Reporters must be assigned to at least one specific cluster."
            )
        elif not person.branch_id:
            errors["person"] = (
                "Assignee must have a branch before receiving a resource-specific assignment."
            )
        else:
            resource_branch = resource_branch_id(module, int(resource_id))
            if resource_branch is None:
                errors["resource_id"] = "Selected cluster was not found."
            elif resource_branch != person.branch_id:
                errors["resource_id"] = (
                    "Cluster must belong to the assignee's church branch."
                )

    if level == ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR:
        if resource_id is not None:
            errors["resource_id"] = (
                "Senior Coordinators have module-wide access; do not set a resource."
            )
        resource_id = None
        resource_type = ""
    elif (
        level == ModuleCoordinator.CoordinatorLevel.COORDINATOR
        and module in RESOURCE_SCOPED_MODULES
    ):
        if resource_id is None:
            errors["resource_id"] = (
                "Coordinators must be assigned to at least one specific resource."
            )
        elif not person.branch_id:
            errors["person"] = (
                "Assignee must have a branch before receiving a resource-specific assignment."
            )
        else:
            resource_branch = resource_branch_id(module, int(resource_id))
            if resource_branch is None:
                errors["resource_id"] = "Selected resource was not found."
            elif resource_branch != person.branch_id:
                errors["resource_id"] = (
                    "Resource must belong to the assignee's church branch."
                )

    if errors:
        raise serializers.ValidationError(errors)

    return {
        "resource_id": resource_id if resource_id else None,
        "resource_type": resource_type or "",
    }


def user_is_reporter_only(person: Person) -> bool:
    """True when every module assignment is CLUSTER Reporter (people-write excluded)."""
    qs = person.module_coordinator_assignments.all()
    if not qs.exists():
        return False
    return not qs.exclude(level=ModuleCoordinator.CoordinatorLevel.REPORTER).exists()


def user_has_people_write_coordinator_assignment(person: Person) -> bool:
    """Module assignments that grant coordinator-style people create (not Reporter-only)."""
    if not person.module_coordinator_assignments.exists():
        return False
    return not user_is_reporter_only(person)

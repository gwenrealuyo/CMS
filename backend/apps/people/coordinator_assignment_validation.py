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

        row = (
            EvangelismGroup.objects.filter(pk=resource_id)
            .values_list("branch_id", "cluster__branch_id")
            .first()
        )
        if not row:
            return None
        return row[0] or row[1]
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
        if module not in (
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.ModuleType.EVANGELISM,
        ):
            errors["level"] = (
                "Reporter assignments are only available for the Cluster "
                "and Evangelism modules."
            )
        elif resource_id is None:
            errors["resource_id"] = (
                "Reporters must be assigned to at least one specific resource."
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

    if level == ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER:
        if module != ModuleCoordinator.ModuleType.EVANGELISM:
            errors["level"] = (
                "Bible Sharer assignments are only available for the Evangelism module."
            )
        elif resource_id is None:
            # Module-wide roster grant (read-only Evangelism access).
            resource_id = None
            resource_type = ""
        elif not person.branch_id:
            errors["person"] = (
                "Assignee must have a branch before receiving a resource-specific assignment."
            )
        else:
            resource_branch = resource_branch_id(module, int(resource_id))
            if resource_branch is None:
                errors["resource_id"] = "Selected evangelism group was not found."
            elif resource_branch != person.branch_id:
                errors["resource_id"] = (
                    "Evangelism group must belong to the assignee's church branch."
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
    """True when every module assignment is Reporter (people-write excluded)."""
    qs = person.module_coordinator_assignments.all()
    if not qs.exists():
        return False
    return not qs.exclude(level=ModuleCoordinator.CoordinatorLevel.REPORTER).exists()


def user_has_people_write_coordinator_assignment(person: Person) -> bool:
    """True when the person has any non-Reporter module assignment (used for self-edit staff fields)."""
    if not person.module_coordinator_assignments.exists():
        return False
    return not user_is_reporter_only(person)


EVANGELISM_VISITOR_CREATE_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
)


def user_can_add_person(user) -> bool:
    """Admin, Pastor, Cluster Senior Coordinator, or Cluster Coordinator (assignment or FK)."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return True
    from apps.clusters.permissions import is_non_senior_cluster_coordinator

    return is_non_senior_cluster_coordinator(user)


def user_can_add_visitor(user) -> bool:
    """Cluster+ plus Evangelism Senior/Coordinator/Bible Sharer (not teachers or reporters)."""
    if user_can_add_person(user):
        return True
    if not getattr(user, "is_authenticated", False):
        return False
    return user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.EVANGELISM,
        level__in=EVANGELISM_VISITOR_CREATE_LEVELS,
    ).exists()

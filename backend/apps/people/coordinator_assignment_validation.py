"""Validation helpers for ModuleCoordinator assignments."""

from __future__ import annotations

from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

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


def _choice_label(choices, value) -> str:
    return str(dict(choices).get(value, value or ""))


def resource_display_name(module: str, resource_id: int) -> str | None:
    """Short label for a scoped assignment resource (cluster code, group, class)."""
    if module == ModuleCoordinator.ModuleType.CLUSTER:
        from apps.clusters.models import Cluster

        row = (
            Cluster.objects.filter(pk=resource_id).values_list("code", "name").first()
        )
        if not row:
            return None
        code = (row[0] or "").strip()
        name = (row[1] or "").strip()
        return code or name or None
    if module == ModuleCoordinator.ModuleType.EVANGELISM:
        from apps.evangelism.models import EvangelismGroup

        name = (
            EvangelismGroup.objects.filter(pk=resource_id)
            .values_list("name", flat=True)
            .first()
        )
        return (name or "").strip() or None
    if module == ModuleCoordinator.ModuleType.SUNDAY_SCHOOL:
        from apps.sunday_school.models import SundaySchoolClass

        name = (
            SundaySchoolClass.objects.filter(pk=resource_id)
            .values_list("name", flat=True)
            .first()
        )
        return (name or "").strip() or None
    return None


def batch_cluster_scope_labels(resource_ids: set[int]) -> dict[int, str]:
    """Map cluster id → list-cell label (code, else name, else Cluster N)."""
    if not resource_ids:
        return {}
    from apps.clusters.models import Cluster

    labels: dict[int, str] = {}
    for cluster in Cluster.objects.filter(pk__in=resource_ids).only(
        "id", "code", "name"
    ):
        code = (cluster.code or "").strip()
        name = (cluster.name or "").strip()
        if code:
            labels[cluster.id] = code
        elif name:
            labels[cluster.id] = name
        else:
            labels[cluster.id] = f"Cluster {cluster.id}"
    return labels


def batch_evangelism_group_scope_labels(resource_ids: set[int]) -> dict[int, str]:
    """Map evangelism group id → list-cell label."""
    if not resource_ids:
        return {}
    from apps.evangelism.models import EvangelismGroup

    labels: dict[int, str] = {}
    for group in EvangelismGroup.objects.filter(pk__in=resource_ids).only(
        "id", "name"
    ):
        labels[group.id] = (group.name or "").strip() or f"Group {group.id}"
    return labels


def module_coordinator_list_label_context(assignments) -> dict:
    """
    Prefetch maps for ModuleCoordinatorSerializer.resource_scope_label.

    Call once per list/bulk response so list serialization is O(1) queries
    for clusters/groups instead of one query per assignment.
    """
    cluster_ids: set[int] = set()
    evangelism_ids: set[int] = set()
    for obj in assignments:
        if obj.resource_id is None:
            continue
        if obj.module == ModuleCoordinator.ModuleType.CLUSTER:
            cluster_ids.add(int(obj.resource_id))
        elif obj.module == ModuleCoordinator.ModuleType.EVANGELISM:
            evangelism_ids.add(int(obj.resource_id))
    return {
        "cluster_scope_labels": batch_cluster_scope_labels(cluster_ids),
        "evangelism_scope_labels": batch_evangelism_group_scope_labels(
            evangelism_ids
        ),
    }


def assignment_scope_label(module: str, resource_id) -> str:
    """Human scope, e.g. 'cluster EAST-1' or 'the Cluster module'."""
    module_label = _choice_label(ModuleCoordinator.ModuleType.choices, module)
    if not resource_id:
        return f"the {module_label} module"
    name = resource_display_name(module, int(resource_id))
    if module == ModuleCoordinator.ModuleType.CLUSTER and name:
        return f"cluster {name}"
    if module == ModuleCoordinator.ModuleType.EVANGELISM and name:
        return f"evangelism group {name}"
    if module == ModuleCoordinator.ModuleType.SUNDAY_SCHOOL and name:
        return f"Sunday School class {name}"
    if name:
        return name
    return f"this {module_label} resource"


def duplicate_module_coordinator_message(
    existing: ModuleCoordinator,
    requested_level: str | None = None,
) -> str:
    """
    Explain a (person, module, resource_id) clash.

    Level is not part of the unique key, so a second role on the same resource
    must say what is already saved and that the level has to be edited in place.
    """
    person = existing.person
    name = person.get_full_name() or person.username
    existing_level = existing.get_level_display()
    scope = assignment_scope_label(existing.module, existing.resource_id)
    message = f"{name} is already assigned as {existing_level} for {scope}."
    if requested_level and requested_level != existing.level:
        requested_label = _choice_label(
            ModuleCoordinator.CoordinatorLevel.choices, requested_level
        )
        module_label = existing.get_module_display()
        message += (
            f" Each person can have only one {module_label} assignment for that"
            f" resource, so they cannot also be assigned as {requested_label}."
            " Edit the existing assignment to change the level."
        )
    return message


class ModuleCoordinatorUniqueTogetherValidator(UniqueTogetherValidator):
    """Same uniqueness rule as the model, with a message that names the clash."""

    def __call__(self, attrs, serializer):
        try:
            super().__call__(attrs, serializer)
        except serializers.ValidationError as exc:
            if exc.get_codes() != ["unique"]:
                raise
            queryset = self.exclude_current_instance(
                attrs,
                self.filter_queryset(attrs, self.queryset, serializer),
                serializer.instance,
            )
            existing = queryset.select_related("person").first()
            if existing is None:
                raise
            requested_level = attrs.get("level")
            if requested_level is None and serializer.instance is not None:
                requested_level = serializer.instance.level
            raise serializers.ValidationError(
                duplicate_module_coordinator_message(
                    existing, requested_level=requested_level
                ),
                code="unique",
            ) from exc


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

    if level == ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR:
        if module != ModuleCoordinator.ModuleType.CLUSTER:
            errors["level"] = (
                "Assistant Coordinator assignments are only available for "
                "the Cluster module."
            )
        elif resource_id is None:
            errors["resource_id"] = (
                "Assistant Coordinators must be assigned to a specific cluster."
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
    """Admin, Pastor, Cluster Senior / Coordinator / Assistant (assignment or FK)."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    from apps.clusters.permissions import (
        has_cluster_oversight_access,
        is_non_senior_cluster_assistant,
        is_non_senior_cluster_coordinator,
    )

    if has_cluster_oversight_access(user):
        return True

    return is_non_senior_cluster_coordinator(user) or is_non_senior_cluster_assistant(
        user
    )


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

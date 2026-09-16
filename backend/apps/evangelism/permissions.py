"""Evangelism-specific permission helpers and classes."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from apps.authentication.permissions import is_module_enabled
from apps.evangelism.models import EvangelismGroup
from apps.people.models import ModuleCoordinator

EVANGELISM = ModuleCoordinator.ModuleType.EVANGELISM
COORDINATOR = ModuleCoordinator.CoordinatorLevel.COORDINATOR
SENIOR = ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
REPORTER = ModuleCoordinator.CoordinatorLevel.REPORTER
BIBLE_SHARER = ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER
APPROVED = EvangelismGroup.ApprovalStatus.APPROVED
PENDING = EvangelismGroup.ApprovalStatus.PENDING
REJECTED = EvangelismGroup.ApprovalStatus.REJECTED
DRAFT_STATUSES = (PENDING, REJECTED)


def _assignment_resource_ids(user, level: str) -> list[int]:
    if not getattr(user, "is_authenticated", False):
        return []
    return list(
        user.module_coordinator_assignments.filter(
            module=EVANGELISM,
            level=level,
            resource_id__isnull=False,
        ).values_list("resource_id", flat=True)
    )


def managed_group_ids_for_coordinator(user) -> list[int]:
    if not getattr(user, "is_authenticated", False):
        return []
    fk_ids = list(
        EvangelismGroup.objects.filter(coordinator=user).values_list("id", flat=True)
    )
    return list(set(fk_ids + _assignment_resource_ids(user, COORDINATOR)))


def managed_group_ids_for_reporter(user) -> list[int]:
    return _assignment_resource_ids(user, REPORTER)


def managed_group_ids_for_bible_sharer(user) -> list[int]:
    return _assignment_resource_ids(user, BIBLE_SHARER)


def managed_group_ids_for_reports(user) -> list[int]:
    return list(
        set(
            managed_group_ids_for_coordinator(user)
            + managed_group_ids_for_reporter(user)
            + managed_group_ids_for_bible_sharer(user)
        )
    )


def is_group_approved(group) -> bool:
    if group is None:
        return False
    status = getattr(group, "approval_status", APPROVED)
    return status == APPROVED


def _approved_ids(ids) -> list[int]:
    if not ids:
        return []
    return list(
        EvangelismGroup.objects.filter(id__in=ids, approval_status=APPROVED).values_list(
            "id", flat=True
        )
    )


def is_evangelism_senior_or_privileged(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return user.is_senior_coordinator(EVANGELISM)


def is_non_senior_evangelism_coordinator(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if is_evangelism_senior_or_privileged(user):
        return False
    if user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level=COORDINATOR,
    ).exists():
        return True
    return EvangelismGroup.objects.filter(coordinator=user).exists()


def reportable_tally_group_ids_for_coordinator(user) -> list[int] | None:
    """Approved reportable group PKs for non-senior coordinators, else None (unrestricted)."""
    if not is_non_senior_evangelism_coordinator(user):
        return None
    return _approved_ids(managed_group_ids_for_reports(user))


def reportable_cluster_ids_for_coordinator(user) -> list[int] | None:
    """Cluster PKs of reportable groups for non-senior coordinators, else None."""
    group_ids = reportable_tally_group_ids_for_coordinator(user)
    if group_ids is None:
        return None
    if not group_ids:
        return []
    return list(
        EvangelismGroup.objects.filter(id__in=group_ids, cluster_id__isnull=False)
        .values_list("cluster_id", flat=True)
        .distinct()
    )


def user_can_manage_each1reach1_cluster(user, cluster_id) -> bool:
    if is_evangelism_senior_or_privileged(user):
        return True
    if cluster_id is None or not is_non_senior_evangelism_coordinator(user):
        return False
    allowed = reportable_cluster_ids_for_coordinator(user) or []
    return cluster_id in allowed


def user_created_draft_group_ids(user) -> list[int]:
    if not getattr(user, "is_authenticated", False):
        return []
    return list(
        EvangelismGroup.objects.filter(
            created_by=user,
            approval_status__in=DRAFT_STATUSES,
        ).values_list("id", flat=True)
    )


def accessible_evangelism_group_ids(user) -> list[int] | None:
    """
    Group PKs the user may list/retrieve, or None for unrestricted
    (admin, pastor, senior evangelism coordinator).
    """
    if not getattr(user, "is_authenticated", False):
        return []
    if is_evangelism_senior_or_privileged(user):
        return None

    if is_non_senior_evangelism_coordinator(user):
        ids = set(user_created_draft_group_ids(user))
        branch_id = getattr(user, "branch_id", None)
        if branch_id:
            ids.update(
                EvangelismGroup.objects.filter(
                    approval_status=APPROVED,
                    branch_id=branch_id,
                ).values_list("id", flat=True)
            )
        else:
            ids.update(_approved_ids(managed_group_ids_for_reports(user)))
            member_ids = EvangelismGroup.objects.filter(
                members=user, approval_status=APPROVED
            ).values_list("id", flat=True)
            ids.update(member_ids)
        return list(ids)

    ids = set(managed_group_ids_for_reports(user))
    member_ids = EvangelismGroup.objects.filter(members=user).values_list(
        "id", flat=True
    )
    ids.update(member_ids)
    return _approved_ids(ids)


def user_manages_evangelism_group(user, group) -> bool:
    if group is None:
        return False
    if getattr(group, "coordinator_id", None) == user.id:
        return True
    group_id = getattr(group, "id", group)
    return user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level=COORDINATOR,
        resource_id=group_id,
    ).exists()


def user_created_unapproved_group(user, group) -> bool:
    if group is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(group, "created_by_id", None) != user.id:
        return False
    return getattr(group, "approval_status", APPROVED) in DRAFT_STATUSES


def user_can_submit_evangelism_report(user, group) -> bool:
    if group is None:
        return False
    if not is_group_approved(group):
        return False
    if is_evangelism_senior_or_privileged(user):
        return True
    if user_manages_evangelism_group(user, group):
        return True
    group_id = getattr(group, "id", group)
    return user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level__in=(REPORTER, BIBLE_SHARER),
        resource_id=group_id,
    ).exists()


def allows_evangelism_group_mutation_attempt(user) -> bool:
    """Who may attempt evangelism group create/update/enroll."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if not is_module_enabled(EVANGELISM):
        return False
    if user.is_senior_coordinator(EVANGELISM):
        return True
    if user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level=COORDINATOR,
    ).exists():
        return True
    return EvangelismGroup.objects.filter(coordinator=user).exists()


def allows_evangelism_report_mutation_attempt(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if not is_module_enabled(EVANGELISM):
        return False
    if user.is_senior_coordinator(EVANGELISM):
        return True
    if user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level__in=(COORDINATOR, SENIOR),
    ).exists():
        return True
    if user.module_coordinator_assignments.filter(
        module=EVANGELISM,
        level__in=(REPORTER, BIBLE_SHARER),
        resource_id__isnull=False,
    ).exists():
        return True
    return EvangelismGroup.objects.filter(coordinator=user).exists()


def filter_weekly_reports_for_user(user, queryset):
    if is_evangelism_senior_or_privileged(user):
        return queryset.filter(evangelism_group__approval_status=APPROVED)
    if is_non_senior_evangelism_coordinator(user):
        ids = set(_approved_ids(managed_group_ids_for_reports(user)))
        if not ids:
            return queryset.none()
        return queryset.filter(evangelism_group_id__in=ids)
    ids = set(managed_group_ids_for_reports(user))
    member_ids = EvangelismGroup.objects.filter(members=user).values_list(
        "id", flat=True
    )
    ids.update(member_ids)
    ids = set(_approved_ids(ids))
    if not ids:
        return queryset.none()
    return queryset.filter(evangelism_group_id__in=ids)


def ensure_user_can_submit_evangelism_report_or_privileged(user, group) -> None:
    if user_can_submit_evangelism_report(user, group):
        return
    raise PermissionDenied(
        "You do not have permission to submit reports for this evangelism group."
    )


def ensure_user_manages_evangelism_group_or_privileged(user, group) -> None:
    if is_evangelism_senior_or_privileged(user):
        return
    if user_manages_evangelism_group(user, group):
        return
    if user_created_unapproved_group(user, group):
        return
    raise PermissionDenied("You do not have access to manage this evangelism group.")


def ensure_user_can_mutate_evangelism_group_records(user, group) -> None:
    """Add or update visitors and conversions on a group."""
    if group is None:
        return
    ensure_user_manages_evangelism_group_or_privileged(user, group)
    ensure_group_is_approved_for_operations(group)


def ensure_group_is_approved_for_operations(group) -> None:
    if is_group_approved(group):
        return
    raise PermissionDenied(
        "This evangelism group is pending approval and cannot be used yet."
    )


class HasEvangelismGroupWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        return allows_evangelism_group_mutation_attempt(request.user)


class HasEvangelismReportWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        return allows_evangelism_report_mutation_attempt(request.user)


class CanApproveEvangelismGroup(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_evangelism_senior_or_privileged(request.user)


class CanManageEach1Reach1Goals(permissions.BasePermission):
    def has_permission(self, request, view):
        if is_evangelism_senior_or_privileged(request.user):
            return True
        return is_non_senior_evangelism_coordinator(request.user)

    def has_object_permission(self, request, view, obj):
        return user_can_manage_each1reach1_cluster(
            request.user, getattr(obj, "cluster_id", None)
        )

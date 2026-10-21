"""Cluster-specific permission helpers and classes."""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from apps.authentication.permissions import is_module_enabled
from apps.clusters.models import Cluster
from apps.people.models import ModuleCoordinator

_CLUSTER = ModuleCoordinator.ModuleType.CLUSTER
_COORDINATOR = ModuleCoordinator.CoordinatorLevel.COORDINATOR
_ASSISTANT = ModuleCoordinator.CoordinatorLevel.ASSISTANT_COORDINATOR
_SENIOR = ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
_REPORTER = ModuleCoordinator.CoordinatorLevel.REPORTER
_TEACHER = ModuleCoordinator.CoordinatorLevel.TEACHER
_BIBLE_SHARER = ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER


def managed_cluster_ids_for_coordinator(user) -> list[int]:
    """
    Cluster PKs the user manages as CLUSTER module coordinator: FK `Cluster.coordinator`
    plus ModuleCoordinator rows (CLUSTER, COORDINATOR, non-null resource_id).
    """
    if not getattr(user, "is_authenticated", False):
        return []
    fk_ids = list(
        Cluster.objects.filter(coordinator=user).values_list("id", flat=True)
    )
    mc_ids = list(
        user.module_coordinator_assignments.filter(
            module=_CLUSTER,
            level=_COORDINATOR,
            resource_id__isnull=False,
        ).values_list("resource_id", flat=True)
    )
    return list(set(fk_ids + mc_ids))


def managed_cluster_ids_for_assistant(user) -> list[int]:
    """Cluster PKs assigned via CLUSTER ASSISTANT_COORDINATOR rows (resource-specific)."""
    if not getattr(user, "is_authenticated", False):
        return []
    return list(
        user.module_coordinator_assignments.filter(
            module=_CLUSTER,
            level=_ASSISTANT,
            resource_id__isnull=False,
        ).values_list("resource_id", flat=True)
    )


def managed_cluster_ids_for_operator(user) -> list[int]:
    """Clusters the user may operate day-to-day (named coordinator or assistant)."""
    return list(
        set(
            managed_cluster_ids_for_coordinator(user)
            + managed_cluster_ids_for_assistant(user)
        )
    )


def managed_cluster_ids_for_reporter(user) -> list[int]:
    """Cluster PKs assigned via CLUSTER REPORTER module rows (resource-specific only)."""
    if not getattr(user, "is_authenticated", False):
        return []
    return list(
        user.module_coordinator_assignments.filter(
            module=_CLUSTER,
            level=_REPORTER,
            resource_id__isnull=False,
        ).values_list("resource_id", flat=True)
    )


def managed_cluster_ids_for_reports(user) -> list[int]:
    """Clusters the user may list/submit weekly reports for."""
    return list(
        set(
            managed_cluster_ids_for_operator(user)
            + managed_cluster_ids_for_reporter(user)
        )
    )


def has_cluster_coordinator_read_scope(user) -> bool:
    """Non-senior coordinator/assistant or FK — branch-wide cluster card read."""
    return is_non_senior_cluster_coordinator(user) or is_non_senior_cluster_assistant(
        user
    )


def is_cluster_reporter_only(user) -> bool:
    """Has REPORTER assignment and no senior/coordinator/assistant/FK cluster leadership."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return False
    if user.is_senior_coordinator(_CLUSTER):
        return False
    if is_non_senior_cluster_coordinator(user):
        return False
    if is_non_senior_cluster_assistant(user):
        return False
    return user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_REPORTER,
    ).exists()


def can_pick_cluster_branch(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return user.is_senior_coordinator(_CLUSTER)


def is_non_senior_cluster_coordinator(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_senior_coordinator(_CLUSTER):
        return False
    if user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_COORDINATOR,
    ).exists():
        return True
    return Cluster.objects.filter(coordinator=user).exists()


def is_non_senior_cluster_assistant(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_senior_coordinator(_CLUSTER):
        return False
    if is_non_senior_cluster_coordinator(user):
        return False
    return user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_ASSISTANT,
    ).exists()


def can_access_cluster_reports(user) -> bool:
    """Who may list/read cluster weekly reports (reporter, coordinator, assistant, senior+, pastor, admin)."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(_CLUSTER):
        return True
    if is_non_senior_cluster_coordinator(user):
        return True
    if is_non_senior_cluster_assistant(user):
        return True
    if user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_REPORTER,
    ).exists():
        return True
    return False


def _cluster_read_allowed(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(_CLUSTER):
        return True
    if is_non_senior_cluster_coordinator(user):
        return True
    if is_non_senior_cluster_assistant(user):
        return True
    if is_cluster_reporter_only(user):
        return True
    if getattr(user, "role", None) == "MEMBER":
        return True
    return False


def apply_cluster_branch_scope(queryset, user, branch_param=None):
    """Apply branch_id filtering for cluster or report querysets."""
    if can_pick_cluster_branch(user):
        if branch_param:
            try:
                return queryset.filter(branch_id=int(branch_param))
            except (TypeError, ValueError):
                return queryset
        return queryset
    if user.branch_id:
        return queryset.filter(branch_id=user.branch_id)
    return queryset.none()


def apply_report_branch_scope(queryset, user, branch_param=None):
    """Branch filter for weekly reports (cluster__branch_id)."""
    if can_pick_cluster_branch(user):
        if branch_param:
            try:
                bid = int(branch_param)
                return queryset.filter(cluster__branch_id=bid)
            except (TypeError, ValueError):
                return queryset
        return queryset
    if user.branch_id:
        return queryset.filter(cluster__branch_id=user.branch_id)
    return queryset.none()


def filter_clusters_for_read(user, queryset):
    """
    Reporter-only: assigned cluster(s) only.
    Non-senior coordinators/assistants: all clusters in branch (read-only for non-managed).
    Members: all clusters in branch. Senior+/admin/pastor: full queryset before branch param.
    """
    if not _cluster_read_allowed(user):
        return queryset.none()
    if is_cluster_reporter_only(user):
        reporter_ids = managed_cluster_ids_for_reporter(user)
        if not reporter_ids:
            return queryset.none()
        return queryset.filter(id__in=reporter_ids)
    return queryset


def filter_weekly_reports_for_user(user, queryset):
    """Narrow weekly reports before branch scoping."""
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return queryset
    if user.is_senior_coordinator(_CLUSTER):
        return queryset
    if (
        is_non_senior_cluster_coordinator(user)
        or is_non_senior_cluster_assistant(user)
        or is_cluster_reporter_only(user)
        or user.module_coordinator_assignments.filter(
            module=_CLUSTER,
            level=_REPORTER,
        ).exists()
    ):
        managed_ids = managed_cluster_ids_for_reports(user)
        if not managed_ids:
            return queryset.none()
        return queryset.filter(cluster_id__in=managed_ids)
    return queryset.none()


def clusters_for_overdue(user):
    """Clusters considered for overdue report checks."""
    qs = filter_clusters_for_read(user, Cluster.objects.all())
    branch_param = None
    qs = apply_cluster_branch_scope(qs, user, branch_param)
    if (
        is_non_senior_cluster_coordinator(user)
        or is_non_senior_cluster_assistant(user)
        or is_cluster_reporter_only(user)
    ):
        managed_ids = managed_cluster_ids_for_reports(user)
        if not managed_ids:
            return qs.none()
        return qs.filter(id__in=managed_ids)
    return qs


def user_manages_cluster(user, cluster) -> bool:
    if cluster is None:
        return False
    if getattr(cluster, "coordinator_id", None) == user.id:
        return True
    return user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_COORDINATOR,
        resource_id=cluster.id,
    ).exists()


def user_assists_cluster(user, cluster) -> bool:
    if cluster is None:
        return False
    cluster_id = getattr(cluster, "id", cluster)
    return user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_ASSISTANT,
        resource_id=cluster_id,
    ).exists()


def user_can_operate_cluster(user, cluster) -> bool:
    """Day-to-day cluster ops: named coordinator or assistant (no privileged bypass)."""
    return user_manages_cluster(user, cluster) or user_assists_cluster(user, cluster)


def user_can_edit_cluster_leadership(user, cluster) -> bool:
    """Who may change coordinator / assistants / reporters / deactivate."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(_CLUSTER):
        return True
    return user_manages_cluster(user, cluster)


def user_can_submit_cluster_report(user, cluster) -> bool:
    if cluster is None:
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(_CLUSTER):
        return True
    if user_can_operate_cluster(user, cluster):
        return True
    cluster_id = getattr(cluster, "id", cluster)
    return user.module_coordinator_assignments.filter(
        module=_CLUSTER,
        level=_REPORTER,
        resource_id=cluster_id,
    ).exists()


def allows_cluster_mutation_attempt(user) -> bool:
    """Who may attempt cluster entity mutations (PATCH/destroy cluster)."""
    if not user.is_authenticated:
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if getattr(user, "role", None) == "PASTOR":
        return True
    if not is_module_enabled(_CLUSTER):
        return False
    if user.is_senior_coordinator(_CLUSTER):
        return True
    if user.is_module_coordinator(_CLUSTER):
        qs = user.module_coordinator_assignments.filter(module=_CLUSTER)
        if qs.filter(
            level__in=(
                _COORDINATOR,
                _ASSISTANT,
                _SENIOR,
                _TEACHER,
                _BIBLE_SHARER,
            )
        ).exists():
            return True
    if Cluster.objects.filter(coordinator=user).exists():
        return True
    return False


def allows_cluster_report_mutation_attempt(user) -> bool:
    """Who may attempt weekly report create/update/delete."""
    if not user.is_authenticated:
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if getattr(user, "role", None) == "PASTOR":
        return True
    if not is_module_enabled(_CLUSTER):
        return False
    if user.is_senior_coordinator(_CLUSTER):
        return True
    if user.is_module_coordinator(_CLUSTER):
        qs = user.module_coordinator_assignments.filter(module=_CLUSTER)
        if qs.filter(
            level__in=(
                _COORDINATOR,
                _ASSISTANT,
                _SENIOR,
                _TEACHER,
                _BIBLE_SHARER,
                _REPORTER,
            )
        ).exists():
            return True
    if Cluster.objects.filter(coordinator=user).exists():
        return True
    return False


def ensure_user_manages_cluster_or_privileged(user, cluster) -> None:
    if getattr(user, "role", None) == "ADMIN":
        return
    if getattr(user, "role", None) == "PASTOR":
        return
    if user.is_senior_coordinator(_CLUSTER):
        return
    if cluster is not None and user_manages_cluster(user, cluster):
        return
    raise PermissionDenied(
        detail="You do not have permission to manage this cluster resource.",
    )


def ensure_user_can_operate_cluster_or_privileged(user, cluster) -> None:
    if getattr(user, "role", None) == "ADMIN":
        return
    if getattr(user, "role", None) == "PASTOR":
        return
    if user.is_senior_coordinator(_CLUSTER):
        return
    if cluster is not None and user_can_operate_cluster(user, cluster):
        return
    raise PermissionDenied(
        detail="You do not have permission to operate this cluster resource.",
    )


def ensure_user_can_submit_cluster_report_or_privileged(user, cluster) -> None:
    if getattr(user, "role", None) == "ADMIN":
        return
    if getattr(user, "role", None) == "PASTOR":
        return
    if user.is_senior_coordinator(_CLUSTER):
        return
    if cluster is not None and user_can_submit_cluster_report(user, cluster):
        return
    raise PermissionDenied(
        detail="You do not have permission to submit reports for this cluster.",
    )


class ClusterMutationAttemptPermission(permissions.BasePermission):
    """Class-level gate for cluster mutations (scoped object checks are separate)."""

    def has_permission(self, request, view):
        return allows_cluster_mutation_attempt(request.user)


class ClusterReportMutationAttemptPermission(permissions.BasePermission):
    """Class-level gate for weekly report mutations."""

    def has_permission(self, request, view):
        return allows_cluster_report_mutation_attempt(request.user)


class ClusterReportReadPermission(permissions.BasePermission):
    """Class-level gate for weekly report read/list and analytics actions."""

    def has_permission(self, request, view):
        return can_access_cluster_reports(request.user)


class ClusterCoordinatorScopedPermission(permissions.BasePermission):
    """Restrict Cluster mutations to operators (coordinator or assistant) of that cluster."""

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False
        if getattr(user, "role", None) == "ADMIN":
            return True
        if getattr(user, "role", None) == "PASTOR":
            return True
        if user.is_senior_coordinator(_CLUSTER):
            return True
        return user_can_operate_cluster(user, obj)


class ClusterWeeklyReportScopedPermission(permissions.BasePermission):
    """Restrict weekly report mutations using the report's cluster."""

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False
        if getattr(user, "role", None) == "ADMIN":
            return True
        if getattr(user, "role", None) == "PASTOR":
            return True
        if user.is_senior_coordinator(_CLUSTER):
            return True
        cluster = getattr(obj, "cluster", None)
        if cluster is None:
            return False
        return user_can_submit_cluster_report(user, cluster)


def can_view_status_tally_people(user) -> bool:
    """Who may open the people behind a status tally cell.

    Plain members and reporter-only users see counts only. Cluster coordinators
    assigned on the cluster record are allowed even without a module row.
    """
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if getattr(user, "role", None) != "MEMBER":
        return False
    from apps.people.coordinator_assignment_validation import (
        user_has_people_write_coordinator_assignment,
    )

    if user_has_people_write_coordinator_assignment(user):
        return True
    return Cluster.objects.filter(coordinator=user).exists()


def can_access_member_care(user) -> bool:
    """Pastoral care: admin, pastor, cluster senior, coordinator, assistant. Not reporters."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(_CLUSTER):
        return True
    return is_non_senior_cluster_coordinator(user) or is_non_senior_cluster_assistant(
        user
    )


def filter_care_cases_for_user(user, queryset):
    """Scope MemberCareCase queryset. Unclustered people: pastor/admin/senior only."""
    from django.db.models import Q

    if not can_access_member_care(user):
        return queryset.none()

    if getattr(user, "role", None) == "ADMIN":
        return queryset

    if user.can_see_all_branches() and (
        getattr(user, "role", None) == "PASTOR"
        or user.is_senior_coordinator(_CLUSTER)
    ):
        return queryset

    if getattr(user, "role", None) == "PASTOR" or user.is_senior_coordinator(_CLUSTER):
        if not user.branch_id:
            return queryset.none()
        return queryset.filter(
            Q(person__clusters__branch_id=user.branch_id)
            | Q(person__clusters__isnull=True, person__branch_id=user.branch_id)
        ).distinct()

    operated_ids = managed_cluster_ids_for_operator(user)
    if not operated_ids:
        return queryset.none()
    return queryset.filter(person__clusters__id__in=operated_ids).distinct()


class CanAccessMemberCare(permissions.BasePermission):
    """ADMIN, PASTOR, cluster senior, coordinator, assistant. Not reporters or members."""

    def has_permission(self, request, view):
        return can_access_member_care(request.user)

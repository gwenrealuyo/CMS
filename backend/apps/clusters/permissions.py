"""Cluster-specific permission helpers and classes."""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from apps.authentication.permissions import is_module_enabled
from apps.clusters.models import Cluster
from apps.people.models import ModuleCoordinator


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
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            resource_id__isnull=False,
        ).values_list("resource_id", flat=True)
    )
    return list(set(fk_ids + mc_ids))


def can_pick_cluster_branch(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER)


def is_non_senior_cluster_coordinator(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return False
    if user.module_coordinator_assignments.filter(
        module=ModuleCoordinator.ModuleType.CLUSTER,
        level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ).exists():
        return True
    return Cluster.objects.filter(coordinator=user).exists()


def _cluster_read_allowed(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return True
    if is_non_senior_cluster_coordinator(user):
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
    Non-senior coordinators: all clusters in their branch (read-only for non-managed).
    Members: all clusters in branch. Senior+/admin/pastor: full queryset before branch param.
    """
    if not _cluster_read_allowed(user):
        return queryset.none()
    return queryset


def filter_weekly_reports_for_user(user, queryset):
    """Narrow weekly reports before branch scoping."""
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return queryset
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return queryset
    if is_non_senior_cluster_coordinator(user):
        managed_ids = managed_cluster_ids_for_coordinator(user)
        if not managed_ids:
            return queryset.none()
        return queryset.filter(cluster_id__in=managed_ids)
    if getattr(user, "role", None) == "MEMBER":
        member_clusters = Cluster.objects.filter(members=user)
        return queryset.filter(cluster__in=member_clusters)
    return queryset.none()


def clusters_for_overdue(user):
    """Clusters considered for overdue report checks."""
    qs = filter_clusters_for_read(user, Cluster.objects.all())
    branch_param = None
    qs = apply_cluster_branch_scope(qs, user, branch_param)
    if is_non_senior_cluster_coordinator(user):
        managed_ids = managed_cluster_ids_for_coordinator(user)
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
        module=ModuleCoordinator.ModuleType.CLUSTER,
        level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        resource_id=cluster.id,
    ).exists()


def allows_cluster_mutation_attempt(user) -> bool:
    """Who may attempt cluster/report mutations (object checks apply separately)."""
    if not user.is_authenticated:
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if getattr(user, "role", None) == "PASTOR":
        return True
    if not is_module_enabled(ModuleCoordinator.ModuleType.CLUSTER):
        return False
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return True
    if user.is_module_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        qs = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
        )
        if qs.filter(
            level__in=(
                ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
                ModuleCoordinator.CoordinatorLevel.TEACHER,
                ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
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
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return
    if cluster is not None and user_manages_cluster(user, cluster):
        return
    raise PermissionDenied(
        detail="You do not have permission to manage this cluster resource.",
    )


class ClusterMutationAttemptPermission(permissions.BasePermission):
    """Class-level gate for cluster mutations (scoped object checks are separate)."""

    def has_permission(self, request, view):
        return allows_cluster_mutation_attempt(request.user)


class ClusterCoordinatorScopedPermission(permissions.BasePermission):
    """Restrict Cluster mutations to coordinators who manage that cluster."""

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
        if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
            return True
        return user_manages_cluster(user, obj)


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
        if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
            return True
        cluster = getattr(obj, "cluster", None)
        if cluster is None:
            return False
        return user_manages_cluster(user, cluster)

from rest_framework import permissions

from apps.authentication.permissions import is_module_enabled
from apps.people.models import ModuleCoordinator

EVENTS = ModuleCoordinator.ModuleType.EVENTS
ROOM_MANAGE_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
)


def can_manage_event_rooms(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if not is_module_enabled(EVENTS):
        return False
    if getattr(user, "role", None) == "PASTOR":
        return True
    return user.module_coordinator_assignments.filter(
        module=EVENTS,
        level__in=ROOM_MANAGE_LEVELS,
    ).exists()


def apply_event_room_branch_scope(queryset, user, branch_param=None):
    """Admin / HQ pastor see all (optional ?branch=); others only their branch."""
    if user.can_see_all_branches():
        if branch_param not in (None, ""):
            try:
                return queryset.filter(branch_id=int(branch_param))
            except (TypeError, ValueError):
                return queryset
        return queryset
    if user.branch_id:
        return queryset.filter(branch_id=user.branch_id)
    return queryset.none()


class CanManageEventRooms(permissions.BasePermission):
    """ADMIN, PASTOR, and Events COORDINATOR / SENIOR_COORDINATOR."""

    def has_permission(self, request, view):
        return can_manage_event_rooms(request.user)

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False
        user = request.user
        if user.can_see_all_branches():
            return True
        return getattr(obj, "branch_id", None) == user.branch_id

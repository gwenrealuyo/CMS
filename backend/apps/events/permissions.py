from rest_framework import permissions

from apps.authentication.permissions import is_module_enabled
from apps.people.models import ModuleCoordinator

EVENTS = ModuleCoordinator.ModuleType.EVENTS
ROOM_MANAGE_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
)
REQUEST_BOOKING_LEVELS = (
    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
)
NON_EVENTS_MODULES = (
    ModuleCoordinator.ModuleType.CLUSTER,
    ModuleCoordinator.ModuleType.FINANCE,
    ModuleCoordinator.ModuleType.EVANGELISM,
    ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
    ModuleCoordinator.ModuleType.LESSONS,
    ModuleCoordinator.ModuleType.MINISTRIES,
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


def can_publish_events(user) -> bool:
    """Admin, Pastor, and Events Coordinator / Senior Coordinator."""
    return can_manage_event_rooms(user)


def can_approve_event_booking(user) -> bool:
    return can_publish_events(user)


def has_events_write(user) -> bool:
    """Create/update live events. Same people who can publish."""
    return can_publish_events(user)


def can_request_event_booking(user) -> bool:
    """Other-module Coordinator / Senior Coordinator, when they are not Events leadership."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if can_publish_events(user):
        return False
    if not is_module_enabled(EVENTS):
        return False
    return user.module_coordinator_assignments.filter(
        module__in=NON_EVENTS_MODULES,
        level__in=REQUEST_BOOKING_LEVELS,
    ).exists()


def can_create_event(user) -> bool:
    return has_events_write(user) or can_request_event_booking(user)


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


class CanCreateOrUpdateEvent(permissions.BasePermission):
    """Events publishers, or other-module coordinators requesting a booking."""

    def has_permission(self, request, view):
        action = getattr(view, "action", None)
        user = request.user
        if action == "create":
            return can_create_event(user)
        if action in ("update", "partial_update"):
            return can_create_event(user)
        if action == "destroy":
            return has_events_write(user) or can_request_event_booking(user)
        return has_events_write(user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        action = getattr(view, "action", None)
        if action == "destroy":
            if has_events_write(user):
                return True
            return (
                can_request_event_booking(user)
                and obj.created_by_id == user.pk
                and obj.booking_status == obj.BookingStatus.PENDING
            )
        if has_events_write(user):
            return True
        if can_request_event_booking(user):
            return obj.created_by_id == user.pk
        return False


class CanApproveEventBooking(permissions.BasePermission):
    def has_permission(self, request, view):
        return can_approve_event_booking(request.user)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

"""Permissions helpers for ministries / system roster management."""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.authentication.permissions import HasModuleAccess
from apps.people.models import ModuleCoordinator

from .access import user_can_manage_ministry_members
from .bible_sharers import (
    is_bible_sharers_ministry,
    user_can_manage_bible_sharers_ministry,
    user_is_bible_sharers_roster_manager,
)
from .models import Ministry
from .ncc import is_ncc_ministry, user_can_manage_ncc_ministry, user_is_lessons_roster_manager


class CanWriteMinistryOrNccRoster(BasePermission):
    """
    Write access for ministry members:
    - Standard Ministries module write, or
    - Lessons roster managers for NCC ministries, or
    - Evangelism roster managers for the HQ Bible Sharers ministry, or
    - Primary / support coordinators of that ministry
      (ministry validated in has_object_permission / perform_create).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role in ("ADMIN", "PASTOR"):
            return True
        if HasModuleAccess(
            ModuleCoordinator.ModuleType.MINISTRIES, "write"
        ).has_permission(request, view):
            return True
        if user_is_lessons_roster_manager(
            user
        ) or user_is_bible_sharers_roster_manager(user):
            return True
        # Object-level check narrows to their ministry; allow gate to reach create/update.
        return (
            Ministry.objects.filter(primary_coordinator=user).exists()
            or Ministry.objects.filter(support_coordinators=user).exists()
        )

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        ministry = obj.ministry if hasattr(obj, "ministry") else obj
        if not isinstance(ministry, Ministry):
            return False
        return user_can_manage_ministry_members(user, ministry)

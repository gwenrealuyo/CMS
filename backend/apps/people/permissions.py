from rest_framework import permissions

from apps.people.coordinator_assignment_validation import (
    user_can_add_person,
    user_can_add_visitor,
)


class CanCreatePerson(permissions.BasePermission):
    """
    Create: Cluster coordinators and above may add Members (and Visitors).
    Evangelism coordinators / Bible Sharers may add Visitors only.
    """

    def has_permission(self, request, view):
        role = str((request.data or {}).get("role") or "MEMBER").upper()
        if role == "VISITOR":
            return user_can_add_visitor(request.user)
        return user_can_add_person(request.user)

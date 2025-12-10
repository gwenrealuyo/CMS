from rest_framework import permissions
from apps.people.models import ModuleCoordinator


class IsAuthenticatedAndNotVisitor(permissions.IsAuthenticated):
    """
    Allows access only to authenticated users who are not VISITOR role.
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role != "VISITOR"


class IsAdmin(permissions.BasePermission):
    """
    Allows access only to ADMIN role.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "ADMIN"
        )


class IsAdminOrPastor(permissions.BasePermission):
    """
    Allows access only to ADMIN or PASTOR roles.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ["ADMIN", "PASTOR"]
        )


class IsCoordinatorOrAbove(permissions.BasePermission):
    """
    Allows access to COORDINATOR, PASTOR, or ADMIN roles.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ["COORDINATOR", "PASTOR", "ADMIN"]
        )


class IsMemberOrAbove(permissions.BasePermission):
    """
    Allows access to MEMBER, COORDINATOR, PASTOR, or ADMIN roles.
    Excludes VISITOR.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"]
        )


class IsModuleCoordinator(permissions.BasePermission):
    """
    Allows access only to users who are coordinators for a specific module.
    Can optionally check for a specific level and/or resource_id.
    """

    def __init__(self, module_type=None, level=None, resource_id=None):
        self.module_type = module_type
        self.level = level
        self.resource_id = resource_id

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Get module type from view if not provided
        module_type = self.module_type
        if module_type is None and hasattr(view, "get_module_type"):
            module_type = view.get_module_type()

        if module_type is None:
            return False

        queryset = request.user.module_coordinator_assignments.filter(
            module=module_type
        )

        if self.level:
            queryset = queryset.filter(level=self.level)

        if self.resource_id is not None:
            queryset = queryset.filter(resource_id=self.resource_id)

        return queryset.exists()


class CanEditOwnResource(permissions.BasePermission):
    """
    Allows editing/deleting only resources that the user created (created_by field).
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if object has created_by field
        if hasattr(obj, "created_by"):
            return obj.created_by == request.user

        # Check if object has coordinator field (for clusters)
        if hasattr(obj, "coordinator"):
            return obj.coordinator == request.user

        return False


class CanEditAssignedResource(permissions.BasePermission):
    """
    Allows editing resources where the user is assigned/participating.
    Checks various relationships like members, teachers, etc.
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if user is a member/participant
        if hasattr(obj, "members") and hasattr(obj.members, "filter"):
            if obj.members.filter(id=request.user.id).exists():
                return True

        # Check if user is coordinator
        if hasattr(obj, "coordinator") and obj.coordinator == request.user:
            return True

        # Check if user is teacher (for Sunday School classes)
        if hasattr(obj, "members") and hasattr(obj, "_meta"):
            # Check if this is a SundaySchoolClass
            if obj._meta.label == "sunday_school.SundaySchoolClass":
                from apps.sunday_school.models import SundaySchoolClassMember

                if SundaySchoolClassMember.objects.filter(
                    sunday_school_class=obj,
                    person=request.user,
                    role=SundaySchoolClassMember.Role.TEACHER,
                ).exists():
                    return True

        return False


class IsSeniorCoordinator(permissions.BasePermission):
    """
    Allows access only to users who are senior coordinators.
    Optionally checks for a specific module.
    """

    def __init__(self, module_type=None):
        self.module_type = module_type

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        queryset = request.user.module_coordinator_assignments.filter(
            level=ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
        )

        if self.module_type:
            queryset = queryset.filter(module=self.module_type)

        return queryset.exists()


class HasModuleAccess(permissions.BasePermission):
    """
    Combined permission checker that validates module access based on role,
    module coordinator assignments, and action type.
    """

    def __init__(self, module_type, action="read"):
        """
        Args:
            module_type: The module to check access for
            action: 'read', 'write', 'create', 'delete'
        """
        self.module_type = module_type
        self.action = action

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        user = request.user

        # ADMIN and PASTOR have full access - check this first before any other logic
        # Ensure role attribute exists and is checked correctly
        if hasattr(user, "role") and user.role in ["ADMIN", "PASTOR"]:
            return True

        # Map DRF view actions to our permission actions
        drf_action = getattr(view, "action", None)
        # If action is not yet determined, check request method as fallback
        if drf_action is None:
            if request.method in ["GET", "HEAD", "OPTIONS"]:
                drf_action = "list"
            elif request.method == "POST":
                drf_action = "create"
            elif request.method in ["PUT", "PATCH"]:
                drf_action = "update"
            elif request.method == "DELETE":
                drf_action = "destroy"

        # Determine effective action: map DRF actions to permission actions
        if drf_action in ["list", "retrieve"]:
            effective_action = "read"
        elif drf_action == "create":
            effective_action = "create" if self.action == "create" else "write"
        elif drf_action in ["update", "partial_update"]:
            effective_action = "write"
        elif drf_action == "destroy":
            effective_action = "delete" if self.action == "delete" else "write"
        else:
            effective_action = self.action

        # Normalize module_type to string for comparison (handle both enum and string)
        module_type_str = (
            self.module_type
            if isinstance(self.module_type, str)
            else (
                self.module_type.value
                if hasattr(self.module_type, "value")
                else str(self.module_type)
            )
        )

        # Check module coordinator assignments
        if user.is_module_coordinator(module_type_str):
            # For read access, any coordinator level is fine
            if effective_action == "read":
                return True

            # For write/create, need COORDINATOR or SENIOR_COORDINATOR level
            if effective_action in ["write", "create"]:
                assignment = user.module_coordinator_assignments.filter(
                    module=module_type_str
                ).first()
                if assignment and assignment.level in [
                    ModuleCoordinator.CoordinatorLevel.COORDINATOR,
                    ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR,
                ]:
                    return True
                # Also allow TEACHER and BIBLE_SHARER for write/create in their modules
                if assignment and assignment.level in [
                    ModuleCoordinator.CoordinatorLevel.TEACHER,
                    ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
                ]:
                    return True

            # For delete, need SENIOR_COORDINATOR or ADMIN/PASTOR
            if effective_action == "delete":
                return user.is_senior_coordinator(module_type_str) or user.role in [
                    "ADMIN",
                    "PASTOR",
                ]

        # MEMBER has read-only access to all modules
        if user.role == "MEMBER" and effective_action == "read":
            return True

        # COORDINATOR role (base role) has read access
        if user.role == "COORDINATOR" and effective_action == "read":
            return True

        return False

    def has_object_permission(self, request, view, obj):
        # First check base permission
        if not self.has_permission(request, view):
            return False

        # For write/delete actions, check ownership or assignment
        if self.action in ["write", "delete"]:
            # Check ownership
            if hasattr(obj, "created_by") and obj.created_by == request.user:
                return True

            # Check coordinator assignment
            if hasattr(obj, "coordinator") and obj.coordinator == request.user:
                return True

        return True

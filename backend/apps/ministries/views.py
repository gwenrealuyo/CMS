from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
    IsAdmin,
)
from apps.people.models import ModuleCoordinator

from .models import Ministry, MinistryMember
from .serializers import MinistryMemberSerializer, MinistrySerializer
from .utils import apply_ministry_branch_visibility


class MinistryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        Ministry.objects.select_related("primary_coordinator", "branch")
        .prefetch_related("support_coordinators", "memberships__member")
        .all()
    )
    serializer_class = MinistrySerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("activity_cadence", "category", "is_active", "scope", "branch")
    search_fields = (
        "name",
        "code",
        "description",
        "primary_coordinator__first_name",
        "primary_coordinator__last_name",
    )
    ordering_fields = ("name", "activity_cadence", "created_at")
    ordering = ("name",)

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Admin and HQ pastors: all ministries
        if user.role == "ADMIN" or user.can_see_all_branches():
            return queryset

        # Ministry Coordinator: assigned / primary / support, then branch+national
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        if coordinator_assignments.exists():
            ministry_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            primary_coordinator_ministries = queryset.filter(primary_coordinator=user)
            support_coordinator_ministries = queryset.filter(support_coordinators=user)
            if ministry_ids:
                assigned_ministries = queryset.filter(id__in=ministry_ids)
                scoped = (
                    primary_coordinator_ministries
                    | support_coordinator_ministries
                    | assigned_ministries
                ).distinct()
            else:
                scoped = (
                    primary_coordinator_ministries | support_coordinator_ministries
                ).distinct()
            return apply_ministry_branch_visibility(scoped, user)

        # Member / branch pastor: own branch + national
        if user.role in ("MEMBER", "PASTOR"):
            return apply_ministry_branch_visibility(queryset, user)

        return queryset.none()

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        # Write operations: ADMIN, PASTOR, or Ministry Coordinator
        return [
            IsAuthenticatedAndNotVisitor(),
            HasModuleAccess(ModuleCoordinator.ModuleType.MINISTRIES, "write"),
        ]


class MinistryMemberViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        MinistryMember.objects.select_related("ministry", "ministry__branch", "member")
        .prefetch_related("ministry__support_coordinators")
        .all()
    )
    serializer_class = MinistryMemberSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("ministry", "role", "is_active")
    search_fields = ("ministry__name", "member__first_name", "member__last_name")
    ordering_fields = ("join_date", "role")
    ordering = ("ministry__name", "member__first_name")

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.role == "ADMIN" or user.can_see_all_branches():
            return queryset

        ministry_qs = Ministry.objects.all()
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        if coordinator_assignments.exists():
            ministry_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            primary = ministry_qs.filter(primary_coordinator=user)
            support = ministry_qs.filter(support_coordinators=user)
            if ministry_ids:
                assigned = ministry_qs.filter(id__in=ministry_ids)
                scoped = (primary | support | assigned).distinct()
            else:
                scoped = (primary | support).distinct()
            scoped = apply_ministry_branch_visibility(scoped, user)
        elif user.role in ("MEMBER", "PASTOR"):
            scoped = apply_ministry_branch_visibility(ministry_qs, user)
        else:
            return queryset.none()

        return queryset.filter(ministry_id__in=scoped.values_list("pk", flat=True))

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        # Determine action from view.action or request method
        action = getattr(self, "action", None)
        if action is None and hasattr(self, "request"):
            # Fallback to request method if action not yet determined
            method = self.request.method
            if method in ["GET", "HEAD", "OPTIONS"]:
                action = "list"
            elif method == "POST":
                action = "create"
            elif method in ["PUT", "PATCH"]:
                action = "update"
            elif method == "DELETE":
                action = "destroy"

        if action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        # Write operations: ADMIN, PASTOR, or Ministry Coordinator
        return [
            IsAuthenticatedAndNotVisitor(),
            HasModuleAccess(ModuleCoordinator.ModuleType.MINISTRIES, "write"),
        ]

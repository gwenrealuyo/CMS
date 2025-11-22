from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from apps.authentication.permissions import (
    IsMemberOrAbove, 
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
)
from apps.people.models import ModuleCoordinator

from .models import Ministry, MinistryMember
from .serializers import MinistryMemberSerializer, MinistrySerializer


class MinistryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        Ministry.objects.select_related("primary_coordinator")
        .prefetch_related("support_coordinators", "memberships__member")
        .all()
    )
    serializer_class = MinistrySerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("activity_cadence", "category", "is_active")
    search_fields = (
        "name",
        "description",
        "primary_coordinator__first_name",
        "primary_coordinator__last_name",
    )
    ordering_fields = ("name", "activity_cadence", "created_at")
    ordering = ("name",)
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # ADMIN/PASTOR: All ministries
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Ministry Coordinator: Only ministries they're assigned to
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.MINISTRIES
        )
        if coordinator_assignments.exists():
            ministry_ids = [
                assignment.resource_id 
                for assignment in coordinator_assignments 
                if assignment.resource_id
            ]
            # Also check if user is primary_coordinator or in support_coordinators
            primary_coordinator_ministries = queryset.filter(primary_coordinator=user)
            support_coordinator_ministries = queryset.filter(support_coordinators=user)
            if ministry_ids:
                assigned_ministries = queryset.filter(id__in=ministry_ids)
                return (primary_coordinator_ministries | support_coordinator_ministries | assigned_ministries).distinct()
            return (primary_coordinator_ministries | support_coordinator_ministries).distinct()
        
        # MEMBER: Read-only, all ministries visible
        if user.role == "MEMBER":
            return queryset
        
        # Default: empty queryset for safety
        return queryset.none()
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        else:
            # Write operations: ADMIN, PASTOR, or Ministry Coordinator
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('MINISTRIES', 'write')]


class MinistryMemberViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        MinistryMember.objects.select_related("ministry", "member")
        .prefetch_related("ministry__support_coordinators")
        .all()
    )
    serializer_class = MinistryMemberSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("ministry", "role", "is_active")
    search_fields = ("ministry__name", "member__first_name", "member__last_name")
    ordering_fields = ("join_date", "role")
    ordering = ("ministry__name", "member__first_name")
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        else:
            # Write operations: ADMIN, PASTOR, or Ministry Coordinator
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('MINISTRIES', 'write')]

    def perform_create(self, serializer):
        serializer.save()

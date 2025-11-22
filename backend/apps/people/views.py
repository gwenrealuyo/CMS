from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Person, Family, Journey, ModuleCoordinator
from .serializers import (
    PersonSerializer,
    FamilySerializer,
    JourneySerializer,
    ModuleCoordinatorSerializer,
)
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsCoordinatorOrAbove,
    IsAuthenticatedAndNotVisitor,
    IsSeniorCoordinator,
    HasModuleAccess,
    IsAdmin,
)


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all().prefetch_related("clusters", "families")
    serializer_class = PersonSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["username", "email", "first_name", "last_name"]
    filterset_fields = ["role"]
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Exclude ADMIN users from all queries (they're invisible)
        # Exception: ADMIN users can see other ADMIN users for management purposes
        if user.role != "ADMIN":
            queryset = queryset.exclude(role="ADMIN")
        
        # ADMIN/PASTOR: All people (excluding other ADMINS if not ADMIN themselves)
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Senior Coordinator: All people (any module senior coordinator has full people access)
        if user.is_senior_coordinator():
            return queryset
        
        # MEMBER: Only themselves and family members
        if user.role == "MEMBER":
            # Get all family members (excluding ADMINs)
            family_members = Person.objects.filter(families__members=user).exclude(role="ADMIN").distinct()
            # Include themselves
            return queryset.filter(id=user.id) | family_members
        
        # Default: empty queryset for safety
        return queryset.none()

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action in ["create", "update", "partial_update"]:
            # Write: ADMIN, PASTOR, or Senior Coordinator
            return [IsAuthenticatedAndNotVisitor(), IsCoordinatorOrAbove()]
        elif self.action == "destroy":
            # Delete: Only ADMIN, PASTOR
            return [IsAuthenticatedAndNotVisitor(), IsCoordinatorOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]


class FamilyViewSet(viewsets.ModelViewSet):
    queryset = Family.objects.all()
    serializer_class = FamilySerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # ADMIN/PASTOR: All families
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Senior Coordinator: All families
        if user.is_senior_coordinator():
            return queryset
        
        # MEMBER: Only families they're members of
        if user.role == "MEMBER":
            return queryset.filter(members=user).distinct()
        
        # Default: empty queryset for safety
        return queryset.none()

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action in ["create", "update", "partial_update"]:
            # Write: ADMIN, PASTOR, or Senior Coordinator
            return [IsAuthenticatedAndNotVisitor(), IsCoordinatorOrAbove()]
        elif self.action == "destroy":
            # Delete: Only ADMIN, PASTOR
            return [IsAuthenticatedAndNotVisitor(), IsCoordinatorOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]


class JourneyViewSet(viewsets.ModelViewSet):
    queryset = Journey.objects.all()
    serializer_class = JourneySerializer
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["user", "type"]


class ModuleCoordinatorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing module coordinator assignments.
    Only accessible by ADMIN users.
    """
    queryset = ModuleCoordinator.objects.select_related("person").all()
    serializer_class = ModuleCoordinatorSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["person", "module", "level", "resource_type"]
    search_fields = [
        "person__username",
        "person__first_name",
        "person__last_name",
        "person__email",
    ]
    ordering = ["-created_at"]


from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Branch, Person, Family, Journey, ModuleCoordinator
from .serializers import (
    BranchSerializer,
    PersonSerializer,
    FamilySerializer,
    JourneySerializer,
    ModuleCoordinatorSerializer,
    ModuleCoordinatorBulkCreateSerializer,
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

        # ADMIN users: Can see all people (including other ADMINs)
        if user.role == "ADMIN":
            return queryset

        # Non-ADMIN users: Exclude ADMIN users (they're invisible to non-admins)
        queryset = queryset.exclude(role="ADMIN")

        # Apply branch filtering helper function
        def apply_branch_filter(qs):
            """Apply branch filtering based on user's branch access"""
            if user.can_see_all_branches():
                return qs
            if user.branch:
                return qs.filter(branch=user.branch)
            # If user has no branch, return empty queryset for safety
            return qs.none()

        # PASTOR: Filter by branch unless from headquarters
        if user.role == "PASTOR":
            return apply_branch_filter(queryset)

        # Senior Coordinator: Filter by branch unless from headquarters
        if user.is_senior_coordinator():
            return apply_branch_filter(queryset)

        # Collect people from all module assignments
        people_querysets = []

        # 1. Cluster Coordinator: People in assigned cluster(s)
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        if coordinator_assignments.exists():
            from apps.clusters.models import Cluster

            # Get clusters from ModuleCoordinator assignments
            cluster_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            # Also get clusters where user is the coordinator
            coordinator_clusters = Cluster.objects.filter(coordinator=user)
            if cluster_ids:
                assigned_clusters = Cluster.objects.filter(id__in=cluster_ids)
                all_clusters = (coordinator_clusters | assigned_clusters).distinct()
            else:
                all_clusters = coordinator_clusters

            # Get all members of these clusters (excluding ADMINs)
            cluster_member_ids = all_clusters.values_list(
                "members__id", flat=True
            ).distinct()
            # Also get people from families in these clusters
            family_member_ids = all_clusters.values_list(
                "families__members__id", flat=True
            ).distinct()
            # Combine and add to querysets
            all_member_ids = list(
                set(list(cluster_member_ids) + list(family_member_ids))
            )
            if all_member_ids:
                people_querysets.append(queryset.filter(id__in=all_member_ids))

        # 2. Sunday School Teacher: Students in classes where they are teacher/assistant
        sunday_school_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        if sunday_school_assignments.exists():
            from apps.sunday_school.models import SundaySchoolClassMember

            # Get class IDs from assignments
            class_ids = [
                assignment.resource_id
                for assignment in sunday_school_assignments
                if assignment.resource_id
            ]
            if class_ids:
                # Get students from these classes
                student_ids = (
                    SundaySchoolClassMember.objects.filter(
                        sunday_school_class_id__in=class_ids, role__in=["STUDENT"]
                    )
                    .values_list("person_id", flat=True)
                    .distinct()
                )
                if student_ids:
                    people_querysets.append(queryset.filter(id__in=student_ids))
            else:
                # Module-wide: Get all students from classes where user is teacher/assistant
                teacher_class_ids = (
                    SundaySchoolClassMember.objects.filter(
                        person=user, role__in=["TEACHER", "ASSISTANT_TEACHER"]
                    )
                    .values_list("sunday_school_class_id", flat=True)
                    .distinct()
                )
                if teacher_class_ids:
                    student_ids = (
                        SundaySchoolClassMember.objects.filter(
                            sunday_school_class_id__in=teacher_class_ids, role="STUDENT"
                        )
                        .values_list("person_id", flat=True)
                        .distinct()
                    )
                    if student_ids:
                        people_querysets.append(queryset.filter(id__in=student_ids))

        # 3. Lessons Teacher: Students in their lesson sessions
        lessons_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER,
        )
        if lessons_assignments.exists():
            from apps.lessons.models import LessonSessionReport

            # Get students where user is the teacher
            student_ids = (
                LessonSessionReport.objects.filter(teacher=user)
                .values_list("student_id", flat=True)
                .distinct()
            )
            if student_ids:
                people_querysets.append(queryset.filter(id__in=student_ids))

        # 4. Bible Sharer: Members of assigned evangelism groups
        bible_sharer_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
        )
        if bible_sharer_assignments.exists():
            from apps.evangelism.models import EvangelismGroupMember

            # Get group IDs from assignments
            group_ids = [
                assignment.resource_id
                for assignment in bible_sharer_assignments
                if assignment.resource_id
            ]
            if group_ids:
                # Get members from these groups
                member_ids = (
                    EvangelismGroupMember.objects.filter(
                        evangelism_group_id__in=group_ids, is_active=True
                    )
                    .values_list("person_id", flat=True)
                    .distinct()
                )
                if member_ids:
                    people_querysets.append(queryset.filter(id__in=member_ids))

        # Combine all querysets using union
        if people_querysets:
            combined_queryset = people_querysets[0]
            for qs in people_querysets[1:]:
                combined_queryset = combined_queryset | qs
            # Apply branch filtering to combined queryset
            if user.can_see_all_branches():
                return combined_queryset.distinct()
            if user.branch:
                return combined_queryset.filter(branch=user.branch).distinct()
            return combined_queryset.none()

        # MEMBER: Only themselves and family members
        if user.role == "MEMBER":
            # Get all family members (excluding ADMINs)
            family_member_ids = (
                Person.objects.filter(families__members=user)
                .exclude(role="ADMIN")
                .values_list("id", flat=True)
                .distinct()
            )
            # Include themselves and family members
            all_ids = list(family_member_ids) + [user.id]
            member_queryset = queryset.filter(id__in=all_ids)
            # Apply branch filtering
            if user.branch:
                return member_queryset.filter(branch=user.branch)
            return member_queryset

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
            if self.action == "create" and self.request.user.role == "MEMBER":
                requested_role = (self.request.data or {}).get("role")
                if requested_role == "VISITOR":
                    return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
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

        # Helper function to filter families by branch
        def filter_families_by_branch(qs):
            """Filter families based on members' branches"""
            if user.can_see_all_branches():
                return qs
            if user.branch:
                # Filter families where most members belong to user's branch
                # Get families where at least one member is from user's branch
                return qs.filter(members__branch=user.branch).distinct()
            return qs.none()

        # ADMIN: All families
        if user.role == "ADMIN":
            return queryset

        # PASTOR: Filter by branch unless from headquarters
        if user.role == "PASTOR":
            return filter_families_by_branch(queryset)

        # Senior Coordinator: Filter by branch unless from headquarters
        if user.is_senior_coordinator():
            return filter_families_by_branch(queryset)

        # Cluster Coordinator: Families in their assigned cluster(s) + families of cluster members
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        if coordinator_assignments.exists():
            from apps.clusters.models import Cluster

            # Get clusters from ModuleCoordinator assignments
            cluster_ids = [
                assignment.resource_id
                for assignment in coordinator_assignments
                if assignment.resource_id
            ]
            # Also get clusters where user is the coordinator
            coordinator_clusters = Cluster.objects.filter(coordinator=user)
            if cluster_ids:
                assigned_clusters = Cluster.objects.filter(id__in=cluster_ids)
                all_clusters = (coordinator_clusters | assigned_clusters).distinct()
            else:
                all_clusters = coordinator_clusters

            # Get families directly connected to these clusters
            directly_connected_families = queryset.filter(
                cluster__in=all_clusters
            ).distinct()

            # Get all people in these clusters
            cluster_member_ids = all_clusters.values_list(
                "members__id", flat=True
            ).distinct()
            # Get families where these people are members
            families_of_members = queryset.filter(
                members__id__in=cluster_member_ids
            ).distinct()

            # Return union of both
            combined_families = (
                directly_connected_families | families_of_members
            ).distinct()
            # Apply branch filtering
            if user.branch:
                return combined_families.filter(members__branch=user.branch).distinct()
            return combined_families

        # MEMBER: Only families they're members of
        if user.role == "MEMBER":
            member_families = queryset.filter(members=user).distinct()
            # Apply branch filtering
            if user.branch:
                return member_families.filter(members__branch=user.branch).distinct()
            return member_families

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

    def get_queryset(self):
        """
        Filter journeys based on user permissions:
        1. ADMIN and PASTOR roles have full access
        2. Senior Coordinators in allowed modules have full access
        3. Cluster Coordinators can see journeys for members of their assigned cluster(s) + their own
        4. Users can always see their own journeys
        5. Otherwise, return empty queryset
        """
        user = self.request.user
        queryset = super().get_queryset()

        # Helper function to filter journeys by branch
        def filter_journeys_by_branch(qs):
            """Filter journeys based on user's branch"""
            if user.can_see_all_branches():
                return qs
            if user.branch:
                return qs.filter(user__branch=user.branch)
            return qs.none()

        # 1. ADMIN - full access
        if user.role == "ADMIN":
            return queryset

        # PASTOR - filter by branch unless from headquarters
        if user.role == "PASTOR":
            return filter_journeys_by_branch(queryset)

        # 2. Senior Coordinators in allowed modules - filter by branch unless from headquarters
        allowed_modules = [
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            ModuleCoordinator.ModuleType.LESSONS,
        ]
        for module in allowed_modules:
            if user.is_senior_coordinator(module):
                return filter_journeys_by_branch(queryset)

        # 3. Cluster Coordinator - can see journeys for members of their cluster(s) + their own
        if user.is_module_coordinator(
            ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        ):
            # Get clusters where user is coordinator
            from apps.clusters.models import Cluster

            user_clusters = Cluster.objects.filter(coordinator=user)
            # Get all members of these clusters
            cluster_member_ids = user_clusters.values_list(
                "members__id", flat=True
            ).distinct()
            # Return journeys for these members + own journeys
            cluster_journeys = queryset.filter(
                user__id__in=list(cluster_member_ids) + [user.id]
            ).distinct()
            # Apply branch filtering
            if user.branch:
                return cluster_journeys.filter(user__branch=user.branch)
            return cluster_journeys

        # 4. Otherwise - only own journeys
        return queryset.filter(user=user)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Manually trigger status update for a person"""
        from apps.people.utils import update_person_status
        
        person = self.get_object()
        updated = update_person_status(person, force=True)
        return Response({
            'status': person.status,
            'updated': updated
        })


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

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """
        Create multiple module coordinator assignments in one request.
        All assignments are validated before any are created (atomic operation).
        """
        serializer = ModuleCoordinatorBulkCreateSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.save()
            response_serializer = ModuleCoordinatorSerializer(
                result["created"], many=True
            )
            return Response(
                {
                    "message": f"Successfully created {len(result['created'])} assignment(s).",
                    "created": response_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BranchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing church branches.
    All authenticated non-visitors can view branches.
    Only ADMIN can create/update/delete.
    """

    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_headquarters", "is_active"]
    search_fields = ["name", "code"]
    ordering = ["name"]

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor()]
        elif self.action in ["create", "update", "partial_update", "destroy"]:
            # Write: Only ADMIN
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor()]

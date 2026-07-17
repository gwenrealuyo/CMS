from django.db.models import Q, Count
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Branch,
    Person,
    Family,
    Journey,
    ModuleCoordinator,
    ModuleSetting,
    PeopleAutomationSetting,
)
from .filters import PersonFilter, FamilyFilter
from .serializers import (
    BranchSerializer,
    PersonSerializer,
    PersonListSerializer,
    FamilySerializer,
    FamilyListSerializer,
    JourneySerializer,
    ModuleCoordinatorSerializer,
    ModuleSettingSerializer,
    PeopleAutomationSettingSerializer,
    ModuleCoordinatorBulkCreateSerializer,
)
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAdminOrPastor,
    HasAnyModuleCoordinatorAssignment,
    IsAuthenticatedAndNotVisitor,
    IsSeniorCoordinator,
    HasModuleAccess,
    IsAdmin,
    IsSelf,
)


class PersonPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all().select_related(
        "branch", "first_activity_attended", "lesson_enrollment"
    ).prefetch_related("clusters", "families")
    serializer_class = PersonSerializer
    pagination_class = PersonPagination
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [
        filters.SearchFilter,
        DjangoFilterBackend,
        filters.OrderingFilter,
    ]
    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "nickname",
        "maiden_name",
        "member_id",
        "phone",
        "facebook_name",
    ]
    filterset_class = PersonFilter
    ordering_fields = [
        "last_name",
        "first_name",
        "middle_name",
        "suffix",
        "maiden_name",
        "username",
        "email",
        "phone",
        "gender",
        "role",
        "status",
        "date_of_birth",
        "date_first_attended",
        "water_baptism_date",
        "spirit_baptism_date",
        "member_id",
        "facebook_name",
        "branch__code",
        "id",
    ]
    ordering = ["last_name", "first_name", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return PersonListSerializer
        return PersonSerializer

    def _scoped_people_queryset(self, *, for_profile=False):
        """
        Scope people for list/search vs profile/mutation access.

        Cluster coordinators may list/search same-branch people (to find and
        assign members), but profile retrieve/update stays limited to people in
        their managed cluster(s) (plus other module scopes).
        """
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

        # 1. Cluster Coordinator
        from apps.clusters.models import Cluster
        from apps.clusters.permissions import is_non_senior_cluster_coordinator

        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        )
        is_cluster_coord = (
            coordinator_assignments.exists()
            or Cluster.objects.filter(coordinator=user).exists()
        )
        if is_cluster_coord and is_non_senior_cluster_coordinator(user):
            if for_profile:
                # Profile: only members (and family members) of managed clusters
                cluster_ids = [
                    assignment.resource_id
                    for assignment in coordinator_assignments
                    if assignment.resource_id
                ]
                coordinator_clusters = Cluster.objects.filter(coordinator=user)
                if cluster_ids:
                    assigned_clusters = Cluster.objects.filter(id__in=cluster_ids)
                    all_clusters = (coordinator_clusters | assigned_clusters).distinct()
                else:
                    all_clusters = coordinator_clusters

                cluster_member_ids = all_clusters.values_list(
                    "members__id", flat=True
                ).distinct()
                family_member_ids = all_clusters.values_list(
                    "families__members__id", flat=True
                ).distinct()
                all_member_ids = list(
                    set(list(cluster_member_ids) + list(family_member_ids))
                )
                if all_member_ids:
                    people_querysets.append(queryset.filter(id__in=all_member_ids))
            else:
                # List/search: all same-branch people (branch filter applied below)
                people_querysets.append(queryset)

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
            from apps.evangelism.models import EvangelismGroup

            group_ids = [
                assignment.resource_id
                for assignment in bible_sharer_assignments
                if assignment.resource_id
            ]
            if group_ids:
                member_ids = (
                    EvangelismGroup.objects.filter(id__in=group_ids)
                    .values_list("members__id", flat=True)
                    .distinct()
                )
                if member_ids:
                    people_querysets.append(queryset.filter(id__in=member_ids))

        # Combine all querysets using union
        if people_querysets:
            combined_queryset = people_querysets[0]
            for qs in people_querysets[1:]:
                combined_queryset = combined_queryset | qs
            return apply_branch_filter(combined_queryset).distinct()

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

    def get_queryset(self):
        # List/search may be wider than profile for cluster coordinators.
        for_profile = getattr(self, "action", None) in (
            "retrieve",
            "update",
            "partial_update",
            "destroy",
        )
        qs = self._scoped_people_queryset(for_profile=for_profile)
        if getattr(self, "action", None) == "retrieve":
            user_pk = self.request.user.pk
            return (
                super()
                .get_queryset()
                .filter(Q(pk__in=qs.values_list("pk", flat=True)) | Q(pk=user_pk))
                .prefetch_related(
                    "journeys",
                    "module_coordinator_assignments",
                )
            )
        # M2M filters (cluster) can duplicate rows; distinct keeps pagination stable.
        if getattr(self, "action", None) == "list" and self.request.query_params.get(
            "cluster"
        ):
            return qs.distinct()
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Avoid N+1: one profile-scope ID set for list responses.
        if getattr(self, "action", None) == "list" and self.request.user.is_authenticated:
            user = self.request.user
            # List and profile scope match for these roles — skip the extra queryset.
            if user.role in ("ADMIN", "PASTOR") or user.is_senior_coordinator():
                context["profile_all_visible"] = True
            else:
                profile_ids = set(
                    self._scoped_people_queryset(for_profile=True).values_list(
                        "pk", flat=True
                    )
                )
                profile_ids.add(user.pk)
                context["profile_visible_ids"] = profile_ids
        return context

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action == "possible_duplicates":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        if self.action in ["list", "retrieve"]:
            # Read: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action == "create":
            # Create: ADMIN, PASTOR, module coordinator; or MEMBER creating a visitor
            if self.request.user.role == "MEMBER":
                requested_role = (self.request.data or {}).get("role")
                if requested_role == "VISITOR":
                    return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
            return [
                IsAuthenticatedAndNotVisitor(),
                (IsAdminOrPastor | HasAnyModuleCoordinatorAssignment)(),
            ]
        elif self.action in ["update", "partial_update"]:
            # Update: privileged writers, or the person updating themselves
            return [
                IsAuthenticatedAndNotVisitor(),
                (IsAdminOrPastor | HasAnyModuleCoordinatorAssignment | IsSelf)(),
            ]
        elif self.action == "destroy":
            # Delete: Only ADMIN
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    @action(detail=False, methods=["get"], url_path="possible-duplicates")
    def possible_duplicates(self, request):
        """
        ADMIN-only audit: groups of people that may be duplicates
        (same first+last name and/or same non-empty LAMP ID).
        """
        from apps.people.duplicate_people import find_possible_people_duplicate_groups

        match = request.query_params.get("match", "both")
        same_branch_only = request.query_params.get(
            "same_branch_only", ""
        ).lower() in ("1", "true", "yes")
        branch_raw = request.query_params.get("branch_id")
        branch_id = None
        if branch_raw not in (None, ""):
            try:
                branch_id = int(branch_raw)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "branch_id must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        groups = find_possible_people_duplicate_groups(
            match=match,
            branch_id=branch_id,
            same_branch_only=same_branch_only,
        )
        return Response({"groups": groups, "count": len(groups)})


class FamilyPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class FamilyViewSet(viewsets.ModelViewSet):
    queryset = Family.objects.all().select_related("leader", "branch").prefetch_related(
        "members"
    )
    serializer_class = FamilySerializer
    pagination_class = FamilyPagination
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = FamilyFilter
    search_fields = ["name"]
    ordering_fields = [
        "name",
        "created_at",
        "member_count",
        "visitor_count",
        "id",
    ]
    ordering = ["name", "id"]

    def get_serializer_class(self):
        if self.action == "list":
            return FamilyListSerializer
        return FamilySerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        include_inactive = self.request.query_params.get("include_inactive", "").lower()
        if include_inactive not in ("1", "true", "yes"):
            queryset = queryset.filter(is_active=True)

        # Helper function to filter families by branch
        def filter_families_by_branch(qs):
            """Filter families by Family.branch or members' branches."""
            if user.can_see_all_branches():
                return qs
            if user.branch:
                return qs.filter(
                    Q(branch=user.branch) | Q(members__branch=user.branch)
                ).distinct()
            return qs.none()

        # ADMIN: All families
        if user.role == "ADMIN":
            scoped = queryset
        # PASTOR: Filter by branch unless from headquarters
        elif user.role == "PASTOR":
            scoped = filter_families_by_branch(queryset)
        # Senior Coordinator: Filter by branch unless from headquarters
        elif user.is_senior_coordinator():
            scoped = filter_families_by_branch(queryset)
        else:
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

                # Return union of both (cluster coordinators see cluster-linked families
                # even when member branches differ — parity with PersonViewSet)
                combined_families = (
                    directly_connected_families | families_of_members
                ).distinct()
                scoped = filter_families_by_branch(combined_families)
            # MEMBER: Only families they're members of
            elif user.role == "MEMBER":
                member_families = queryset.filter(members=user).distinct()
                if user.branch:
                    scoped = member_families.filter(
                        Q(branch=user.branch) | Q(members__branch=user.branch)
                    ).distinct()
                else:
                    scoped = member_families
            else:
                scoped = queryset.none()

        # Annotate for list ordering/filters and FamilyListSerializer.
        return scoped.annotate(
            member_count=Count("members", distinct=True),
            visitor_count=Count(
                "members",
                filter=Q(members__role="VISITOR"),
                distinct=True,
            ),
        )

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve", "unassigned_people"]:
            # Read: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action in ["create", "update", "partial_update"]:
            # Write: ADMIN, PASTOR, or anyone with a ModuleCoordinator assignment
            return [
                IsAuthenticatedAndNotVisitor(),
                (IsAdminOrPastor | HasAnyModuleCoordinatorAssignment)(),
            ]
        elif self.action == "destroy":
            # Delete: Only ADMIN
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    @action(detail=False, methods=["get"], url_path="unassigned-people")
    def unassigned_people(self, request):
        """Paginated people not in any active family (scoped like Person list)."""
        person_view = PersonViewSet()
        person_view.request = request
        person_view.args = getattr(self, "args", ())
        person_view.kwargs = getattr(self, "kwargs", {})
        person_view.action = "list"
        person_view.format_kwarg = getattr(self, "format_kwarg", None)

        people_qs = person_view._scoped_people_queryset(for_profile=False)
        assigned_ids = (
            Person.objects.filter(families__is_active=True)
            .values_list("id", flat=True)
            .distinct()
        )
        people_qs = (
            people_qs.exclude(id__in=assigned_ids)
            .exclude(username="admin")
            .exclude(Q(first_name="") | Q(last_name=""))
            .exclude(first_name__isnull=True)
            .exclude(last_name__isnull=True)
            .select_related("branch", "first_activity_attended")
            .prefetch_related("clusters", "families")
            .order_by("last_name", "first_name", "id")
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            people_qs = people_qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(nickname__icontains=search)
                | Q(email__icontains=search)
                | Q(member_id__icontains=search)
            )

        paginator = PersonPagination()
        page = paginator.paginate_queryset(people_qs, request, view=self)
        serializer = PersonListSerializer(
            page, many=True, context=person_view.get_serializer_context()
        )
        return paginator.get_paginated_response(serializer.data)


class JourneyViewSet(viewsets.ModelViewSet):
    queryset = Journey.objects.all()
    serializer_class = JourneySerializer
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["user", "type"]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

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
            from apps.clusters.models import Cluster
            from apps.clusters.permissions import managed_cluster_ids_for_coordinator

            cluster_ids = managed_cluster_ids_for_coordinator(user)
            if not cluster_ids:
                return queryset.filter(user=user)
            cluster_member_ids = (
                Cluster.objects.filter(id__in=cluster_ids)
                .values_list("members__id", flat=True)
                .distinct()
            )
            cluster_journeys = queryset.filter(
                user__id__in=list(cluster_member_ids) + [user.id]
            ).distinct()
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
        "person__nickname",
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


class ModuleSettingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for module enable/disable settings.
    Any authenticated non-visitor can read module on/off state (sidebar, gating).
    Only ADMIN can update module state.
    """

    queryset = ModuleSetting.objects.select_related("updated_by").all()
    serializer_class = ModuleSettingSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    http_method_names = ["get", "put", "patch", "head", "options"]
    ordering = ["module"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor()]

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class PeopleAutomationSettingView(APIView):
    """
    Singleton people automation flags (ADMIN only).
    GET/PATCH /api/people/people-automation-settings/
    """

    permission_classes = [IsAuthenticatedAndNotVisitor, IsAdmin]

    def get(self, request):
        setting = PeopleAutomationSetting.get_solo()
        return Response(PeopleAutomationSettingSerializer(setting).data)

    def patch(self, request):
        setting = PeopleAutomationSetting.get_solo()
        serializer = PeopleAutomationSettingSerializer(
            setting, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


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

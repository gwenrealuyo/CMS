from datetime import date, datetime, timedelta
from typing import Optional

from django.db.models import Min, Q
from django.db.models.functions import Greatest
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event
from apps.people.models import Branch, ModuleCoordinator, Person, Journey
from apps.clusters.models import Cluster, ClusterWeeklyReport
from apps.lessons.models import LessonSessionReport
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    IsModuleCoordinator,
    HasModuleAccess,
    CanEditAssignedResource,
)
from apps.people.coordinator_scope import coordinator_assigned_resource_ids_when_all_scoped

from .models import (
    EvangelismGroup,
    EvangelismSession,
    EvangelismWeeklyReport,
    Prospect,
    FollowUpTask,
    DropOff,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
)
from .serializers import (
    EvangelismGroupSerializer,
    EvangelismBulkEnrollSerializer,
    EvangelismSessionSerializer,
    EvangelismRecurringSessionSerializer,
    EvangelismWeeklyReportSerializer,
    EvangelismTallySerializer,
    EvangelismPeopleTallySerializer,
    EvangelismTallyDrilldownSerializer,
    ProspectSerializer,
    FollowUpTaskSerializer,
    DropOffSerializer,
    ConversionSerializer,
    MonthlyConversionTrackingSerializer,
    MonthlyStatisticsSerializer,
    Each1Reach1GoalSerializer,
    EvangelismSummarySerializer,
    EvangelismDashboardStatsSerializer,
)
from .services import (
    bulk_enroll_members,
    get_inviter_cluster,
    create_person_from_prospect,
    update_monthly_tracking,
    calculate_monthly_statistics,
    check_conversion_completion,
    endorse_visitor_to_cluster,
    get_cluster_visitors,
    detect_drop_offs,
    check_lesson_completion,
    update_person_baptism_dates,
    update_each1reach1_goal,
    get_default_each1reach1_target,
    calculate_conversion_rate,
    get_group_statistics,
    get_cluster_statistics,
    create_recurring_sessions,
    generate_each1reach1_report,
    get_evangelism_dashboard_stats,
)


class EvangelismGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    queryset = (
        EvangelismGroup.objects.select_related("coordinator", "cluster")
        .prefetch_related("members")
        .all()
    )
    serializer_class = EvangelismGroupSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("cluster", "is_active", "is_bible_sharers_group")
    search_fields = ("name", "description", "location")
    ordering_fields = ("name", "created_at")
    ordering = ("name",)
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        branch_id = self.request.query_params.get("branch")
        if branch_id:
            queryset = queryset.filter(cluster__branch=branch_id)
        
        # ADMIN/PASTOR: All groups
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Evangelism Coordinator (EVANGELISM, COORDINATOR)
        if user.is_module_coordinator(
            ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        ):
            if user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM):
                return queryset
            scoped_ids = coordinator_assigned_resource_ids_when_all_scoped(
                user,
                ModuleCoordinator.ModuleType.EVANGELISM,
                ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            )
            if scoped_ids is not None:
                return queryset.filter(id__in=scoped_ids)
            return queryset
        
        # Bible Sharer (EVANGELISM, BIBLE_SHARER): All groups (filtering happens in permissions)
        if user.is_module_coordinator(
            ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER
        ):
            return queryset
        
        # MEMBER: Only groups they're members of
        if user.role == "MEMBER":
            return queryset.filter(members=user).distinct()
        
        # Default: empty queryset for safety
        return queryset.none()
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in [
            "list",
            "retrieve",
            "sessions",
            "conversions",
            "visitors",
            "summary",
            "dashboard_stats",
        ]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action in ["create", "update", "partial_update", "enroll"]:
            # Write operations: ADMIN, PASTOR, Evangelism Coordinator, or Bible Sharer (with restrictions)
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('EVANGELISM', 'write')]
        elif self.action == "destroy":
            # Delete: ADMIN, PASTOR, Evangelism Coordinator only (Bible Sharer cannot delete)
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('EVANGELISM', 'delete')]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
    
    def get_object(self):
        obj = super().get_object()
        user = self.request.user

        scoped_ids = None
        if (
            user.is_module_coordinator(
                ModuleCoordinator.ModuleType.EVANGELISM,
                level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            )
            and not user.is_senior_coordinator(
                ModuleCoordinator.ModuleType.EVANGELISM
            )
        ):
            scoped_ids = coordinator_assigned_resource_ids_when_all_scoped(
                user,
                ModuleCoordinator.ModuleType.EVANGELISM,
                ModuleCoordinator.CoordinatorLevel.COORDINATOR,
            )

        if scoped_ids is not None and obj.id not in scoped_ids:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this evangelism group.",
            )

        # Bible Sharer can only edit/delete groups they're members of
        if (
            self.action in ["update", "partial_update", "destroy"]
            and user.is_module_coordinator(
                ModuleCoordinator.ModuleType.EVANGELISM,
                level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            )
        ):
            if not obj.members.filter(pk=user.pk).exists():
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "You can only edit groups you are a member of.",
                )

        return obj

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        """Bulk enroll members into a group."""
        evangelism_group = self.get_object()
        serializer = EvangelismBulkEnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        person_ids = serializer.validated_data["person_ids"]

        created_count = bulk_enroll_members(evangelism_group, person_ids)

        return Response(
            {"created": created_count, "message": f"Enrolled {created_count} people"},
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="dashboard-stats")
    def dashboard_stats(self, request):
        """Organization-wide evangelism dashboard counts (groups, visitors, reached)."""
        year_param = request.query_params.get("year")
        try:
            year = int(year_param) if year_param is not None and year_param != "" else timezone.now().year
        except (TypeError, ValueError):
            return Response(
                {"detail": "year must be a valid integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stats = get_evangelism_dashboard_stats(year)
        serializer = EvangelismDashboardStatsSerializer(instance=stats)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def sessions(self, request, pk=None):
        """List sessions for a group."""
        evangelism_group = self.get_object()
        sessions = evangelism_group.sessions.all().order_by(
            "-session_date", "-session_time"
        )

        date_from = request.query_params.get("date_from")
        if date_from:
            sessions = sessions.filter(session_date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            sessions = sessions.filter(session_date__lte=date_to)

        serializer = EvangelismSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def conversions(self, request, pk=None):
        """List conversions for a group."""
        evangelism_group = self.get_object()
        conversions = evangelism_group.conversions.all().order_by("-conversion_date")

        serializer = ConversionSerializer(conversions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def visitors(self, request, pk=None):
        """List visitors associated with this group's cluster."""
        evangelism_group = self.get_object()
        cluster = evangelism_group.cluster

        if not cluster:
            return Response([])

        visitors = get_cluster_visitors(cluster)
        serializer = ProspectSerializer(visitors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def summary(self, request):
        """Group statistics."""
        evangelism_group = self.get_object()
        stats = get_group_statistics(evangelism_group)
        return Response(stats)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticatedAndNotVisitor, IsMemberOrAbove])
    def bible_sharers_coverage(self, request):
        """Get Bible Sharers coverage across clusters.

        Returns which clusters have Bible Sharers and which don't.
        Stats are visible to all authenticated users.
        """
        from apps.clusters.models import Cluster
        from .serializers import ClusterSummarySerializer

        # Get all active Bible Sharers groups (use base queryset, not filtered)
        bible_sharers_groups = EvangelismGroup.objects.filter(
            is_bible_sharers_group=True, is_active=True
        ).select_related("cluster")

        # Get clusters that have Bible Sharers
        clusters_with_bible_sharers = set()
        bible_sharers_by_cluster = {}

        for group in bible_sharers_groups:
            if group.cluster:
                clusters_with_bible_sharers.add(group.cluster.id)
                if group.cluster.id not in bible_sharers_by_cluster:
                    bible_sharers_by_cluster[group.cluster.id] = {
                        "cluster": group.cluster,
                        "groups": [],
                    }
                bible_sharers_by_cluster[group.cluster.id]["groups"].append(group)

        # Get all clusters
        all_clusters = Cluster.objects.all().order_by("name")

        # Build coverage report
        coverage = []
        clusters_without = []

        for cluster in all_clusters:
            cluster_data = {
                "cluster": ClusterSummarySerializer(cluster).data,
                "has_bible_sharers": cluster.id in clusters_with_bible_sharers,
                "bible_sharers_groups": [],
                "bible_sharers_count": 0,
            }

            if cluster.id in bible_sharers_by_cluster:
                groups_data = []
                total_members = 0
                for group in bible_sharers_by_cluster[cluster.id]["groups"]:
                    members_count = group.members.exclude(role="ADMIN").count()
                    total_members += members_count
                    groups_data.append(
                        {
                            "id": group.id,
                            "name": group.name,
                            "coordinator": (
                                group.coordinator.get_full_name()
                                if group.coordinator
                                else None
                            ),
                            "members_count": members_count,
                        }
                    )

                cluster_data["bible_sharers_groups"] = groups_data
                cluster_data["bible_sharers_count"] = total_members
            else:
                clusters_without.append(cluster.name)

            coverage.append(cluster_data)

        return Response(
            {
                "coverage": coverage,
                "summary": {
                    "total_clusters": all_clusters.count(),
                    "clusters_with_bible_sharers": len(clusters_with_bible_sharers),
                    "clusters_without_bible_sharers": len(clusters_without),
                    "clusters_without_names": clusters_without,
                    "total_bible_sharers_groups": bible_sharers_groups.count(),
                },
            }
        )


class EvangelismSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = EvangelismSession.objects.select_related(
        "evangelism_group", "event"
    ).all()
    serializer_class = EvangelismSessionSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("evangelism_group", "session_date")
    search_fields = ("topic", "notes", "evangelism_group__name")
    ordering_fields = ("session_date", "session_time", "created_at")
    ordering = ("-session_date", "-session_time")

    def perform_create(self, serializer):
        """Auto-create Event when session is created (if requested)."""
        session = serializer.save()
        create_event = serializer.validated_data.get("create_event", False)
        if create_event:
            self._create_event_for_session(session)

    def perform_update(self, serializer):
        """Update linked Event when session is updated."""
        session = serializer.save()
        if session.event:
            self._update_event_for_session(session)

    def perform_destroy(self, instance):
        """Optionally delete linked Event when session is deleted."""
        event = instance.event
        instance.delete()

    def _create_event_for_session(self, session: EvangelismSession):
        """Create an Event for an Evangelism session."""
        group = session.evangelism_group
        meeting_time = (
            session.session_time or group.meeting_time or timezone.now().time()
        )

        session_datetime = datetime.combine(session.session_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)

        event_title = group.name
        if session.topic:
            event_title = f"{event_title} - {session.topic}"

        # Determine event type based on cluster affiliation
        event_type = "BS/CLUSTER_EVANGELISM" if group.cluster else "BIBLE_STUDY"

        event = Event.objects.create(
            title=event_title,
            description=f"Bible Study session for {group.name}",
            start_date=session_datetime,
            end_date=end_datetime,
            event_type_id=event_type,
            location=group.location or "",
            is_recurring=False,
        )

        session.event = event
        session.save(update_fields=["event"])

    def _update_event_for_session(self, session: EvangelismSession):
        """Update the linked Event when session is updated."""
        if not session.event:
            return

        group = session.evangelism_group
        meeting_time = (
            session.session_time or group.meeting_time or timezone.now().time()
        )

        session_datetime = datetime.combine(session.session_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)

        event_title = group.name
        if session.topic:
            event_title = f"{event_title} - {session.topic}"

        session.event.title = event_title
        session.event.start_date = session_datetime
        session.event.end_date = end_datetime
        session.event.location = group.location or ""
        session.event.save()

    @action(detail=True, methods=["get"])
    def attendance_report(self, request, pk=None):
        """Generate attendance report for a session."""
        session = self.get_object()
        if not session.event:
            return Response(
                {"error": "Session has no linked event"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get enrolled members
        enrolled_members = session.evangelism_group.members.exclude(role="ADMIN")

        # Get attendance records
        attendance_records = AttendanceRecord.objects.filter(
            event=session.event, occurrence_date=session.session_date
        ).select_related("person")

        present_count = attendance_records.filter(
            status=AttendanceRecord.AttendanceStatus.PRESENT
        ).count()
        absent_count = attendance_records.filter(
            status=AttendanceRecord.AttendanceStatus.ABSENT
        ).count()
        excused_count = attendance_records.filter(
            status=AttendanceRecord.AttendanceStatus.EXCUSED
        ).count()

        total_enrolled = enrolled_members.count()
        attendance_rate = (
            round((present_count / total_enrolled * 100), 2)
            if total_enrolled > 0
            else 0.0
        )

        data = {
            "session_id": session.id,
            "session_date": session.session_date,
            "topic": session.topic,
            "total_enrolled": total_enrolled,
            "present_count": present_count,
            "absent_count": absent_count,
            "excused_count": excused_count,
            "attendance_rate": attendance_rate,
        }

        return Response(data)

    @action(detail=False, methods=["post"])
    def create_recurring(self, request):
        """Create multiple sessions based on recurrence pattern."""
        serializer = EvangelismRecurringSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        group_id = serializer.validated_data["evangelism_group_id"]
        evangelism_group = EvangelismGroup.objects.get(id=group_id)

        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data.get("end_date")
        num_occurrences = serializer.validated_data.get("num_occurrences")
        recurrence_pattern = serializer.validated_data["recurrence_pattern"]
        day_of_week = serializer.validated_data.get("day_of_week")
        default_topic = serializer.validated_data.get("default_topic", "")

        sessions = create_recurring_sessions(
            evangelism_group=evangelism_group,
            start_date=start_date,
            end_date=end_date,
            num_occurrences=num_occurrences,
            recurrence_pattern=recurrence_pattern,
            day_of_week=day_of_week,
            default_topic=default_topic,
        )

        session_serializer = EvangelismSessionSerializer(sessions, many=True)
        return Response(
            {
                "created": len(sessions),
                "sessions": session_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class EvangelismWeeklyReportViewSet(viewsets.ModelViewSet):
    class DrilldownPagination(PageNumberPagination):
        page_size = 20
        page_size_query_param = "page_size"
        max_page_size = 100

    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = (
        EvangelismWeeklyReport.objects.select_related(
            "evangelism_group", "submitted_by"
        )
        .prefetch_related("members_attended", "visitors_attended")
        .all()
    )
    serializer_class = EvangelismWeeklyReportSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("evangelism_group", "year", "week_number", "gathering_type")
    search_fields = ("topic", "notes", "evangelism_group__name")
    ordering_fields = ("year", "week_number", "meeting_date")
    ordering = ("-year", "-week_number")

    def get_queryset(self):
        queryset = super().get_queryset()

        month = self.request.query_params.get("month")
        if month:
            try:
                month_int = int(month)
                if 1 <= month_int <= 12:
                    queryset = queryset.filter(meeting_date__month=month_int)
            except (TypeError, ValueError):
                pass

        cluster = self.request.query_params.get("cluster")
        if cluster:
            try:
                cluster_int = int(cluster)
                queryset = queryset.filter(evangelism_group__cluster_id=cluster_int)
            except (TypeError, ValueError):
                pass

        branch = self.request.query_params.get("branch")
        if branch:
            try:
                branch_int = int(branch)
                queryset = queryset.filter(
                    evangelism_group__cluster__branch_id=branch_int
                )
            except (TypeError, ValueError):
                pass

        return queryset

    @action(detail=False, methods=["get"], url_path="distinct_years")
    def distinct_years(self, request):
        """
        Distinct report years present for facet filters only.

        Applies branch, cluster, evangelism_group, and gathering_type when provided.
        Ignores year, month, and week_number so the Year dropdown can list all years
        that have matching reports (same pattern as cluster weekly distinct_years).
        """
        queryset = EvangelismWeeklyReport.objects.all()

        branch = request.query_params.get("branch")
        if branch:
            try:
                queryset = queryset.filter(
                    evangelism_group__cluster__branch_id=int(branch)
                )
            except (TypeError, ValueError):
                pass

        cluster = request.query_params.get("cluster")
        if cluster:
            try:
                queryset = queryset.filter(evangelism_group__cluster_id=int(cluster))
            except (TypeError, ValueError):
                pass

        eg = request.query_params.get("evangelism_group")
        if eg:
            try:
                queryset = queryset.filter(evangelism_group_id=int(eg))
            except (TypeError, ValueError):
                pass

        gathering = request.query_params.get("gathering_type")
        if gathering:
            queryset = queryset.filter(gathering_type=gathering)

        years_iter = queryset.values_list("year", flat=True).distinct()
        years = sorted(set(years_iter), reverse=True)
        return Response({"years": years})

    def _resolve_branch_id(self) -> Optional[int]:
        branch = self.request.query_params.get("branch")
        if branch in (None, ""):
            return None
        try:
            branch_id = int(branch)
        except (TypeError, ValueError):
            raise ValidationError({"branch": "Branch must be a valid integer."})

        if not Branch.objects.filter(id=branch_id).exists():
            raise ValidationError({"branch": "Branch not found."})
        return branch_id

    def _resolve_cluster_id(self) -> Optional[int]:
        cluster = self.request.query_params.get("cluster")
        if cluster in (None, ""):
            return None
        try:
            cluster_id = int(cluster)
        except (TypeError, ValueError):
            raise ValidationError({"cluster": "Cluster must be a valid integer."})

        if not Cluster.objects.filter(id=cluster_id).exists():
            raise ValidationError({"cluster": "Cluster not found."})
        return cluster_id

    def _resolve_evangelism_group_id(self) -> Optional[int]:
        raw = self.request.query_params.get("evangelism_group")
        if raw in (None, ""):
            return None
        try:
            eg_id = int(raw)
        except (TypeError, ValueError):
            raise ValidationError(
                {"evangelism_group": "Evangelism group must be a valid integer."}
            )

        if not EvangelismGroup.objects.filter(id=eg_id).exists():
            raise ValidationError({"evangelism_group": "Evangelism group not found."})
        return eg_id

    @staticmethod
    def _person_ids_for_evangelism_group(evangelism_group_id: int) -> frozenset:
        member_ids = (
            EvangelismGroup.objects.filter(pk=evangelism_group_id).values_list(
                "members__id", flat=True
            ).distinct()
        )
        prospect_person_ids = Prospect.objects.filter(
            evangelism_group_id=evangelism_group_id,
            person_id__isnull=False,
        ).values_list("person_id", flat=True)
        return frozenset(member_ids) | frozenset(prospect_person_ids)

    def _branch_cluster_group_scope(self):
        """Branch optional; at most one of cluster vs evangelism group scope."""
        branch_id = self._resolve_branch_id()
        cluster_id = self._resolve_cluster_id()
        eg_id = self._resolve_evangelism_group_id()

        if cluster_id is not None and eg_id is not None:
            raise ValidationError(
                {"detail": "Specify at most one of cluster or evangelism_group."}
            )

        group_person_ids = None
        if eg_id is not None:
            eg_obj = EvangelismGroup.objects.select_related("cluster").get(pk=eg_id)
            if branch_id is not None and getattr(eg_obj, "cluster_id", None):
                if eg_obj.cluster.branch_id != branch_id:
                    raise ValidationError(
                        {
                            "evangelism_group": (
                                "Evangelism group is not under the selected branch."
                            ),
                        },
                    )

            group_person_ids = self._person_ids_for_evangelism_group(eg_id)

        return branch_id, cluster_id, eg_id, group_person_ids

    @staticmethod
    def _person_display_name(person: Person) -> str:
        if hasattr(person, "get_full_name"):
            full_name = person.get_full_name()
            if full_name:
                return full_name
        fallback = f"{person.first_name or ''} {person.last_name or ''}".strip()
        return fallback or person.username

    def _serialize_people_rows(
        self,
        people_qs,
        metric: str,
        date_attr: Optional[str] = None,
        date_map: Optional[dict] = None,
    ):
        def get_reached_date(person):
            if hasattr(person, "reached_date") and getattr(person, "reached_date", None):
                return person.reached_date
            if person.water_baptism_date and person.spirit_baptism_date:
                return max(person.water_baptism_date, person.spirit_baptism_date)
            return None

        rows = []
        for person in people_qs:
            event_date = None
            if date_map is not None:
                event_date = date_map.get(person.id)
            elif date_attr:
                event_date = getattr(person, date_attr, None)
            rows.append(
                {
                    "entity_type": "person",
                    "id": person.id,
                    "display_name": self._person_display_name(person),
                    "first_name": person.first_name,
                    "middle_name": person.middle_name,
                    "last_name": person.last_name,
                    "suffix": person.suffix,
                    "nickname": person.nickname,
                    "username": person.username,
                    "member_id": person.member_id,
                    "role": person.role,
                    "status": person.status,
                    "pipeline_stage": None,
                    "person_id": person.id,
                    "event_date": event_date,
                    "date_first_invited": person.date_first_invited,
                    "date_first_attended": person.date_first_attended,
                    "lessons_finished_at": person.lessons_finished_at,
                    "water_baptism_date": person.water_baptism_date,
                    "spirit_baptism_date": person.spirit_baptism_date,
                    "reached_date": get_reached_date(person),
                    "metric": metric,
                }
            )
        return rows

    def _serialize_prospect_rows(
        self,
        prospects_qs,
        metric: str,
        date_map_by_person_id: Optional[dict] = None,
    ):
        def get_reached_date(person):
            if not person:
                return None
            if person.water_baptism_date and person.spirit_baptism_date:
                return max(person.water_baptism_date, person.spirit_baptism_date)
            return None

        return [
            {
                "entity_type": "prospect",
                "id": prospect.id,
                "display_name": (
                    self._person_display_name(prospect.person)
                    if prospect.person
                    else prospect.name
                ),
                "first_name": prospect.person.first_name if prospect.person else None,
                "middle_name": prospect.person.middle_name if prospect.person else None,
                "last_name": prospect.person.last_name if prospect.person else None,
                "suffix": prospect.person.suffix if prospect.person else None,
                "nickname": prospect.person.nickname if prospect.person else None,
                "username": prospect.person.username if prospect.person else None,
                "member_id": prospect.person.member_id if prospect.person else None,
                "role": prospect.person.role if prospect.person else None,
                "status": prospect.person.status if prospect.person else None,
                "pipeline_stage": prospect.pipeline_stage,
                "person_id": prospect.person.id if prospect.person else None,
                "event_date": (
                    date_map_by_person_id.get(prospect.person_id)
                    if date_map_by_person_id and prospect.person_id
                    else None
                ),
                "date_first_invited": (
                    prospect.person.date_first_invited if prospect.person else None
                ),
                "date_first_attended": (
                    prospect.person.date_first_attended if prospect.person else None
                ),
                "lessons_finished_at": (
                    prospect.person.lessons_finished_at if prospect.person else None
                ),
                "water_baptism_date": (
                    prospect.person.water_baptism_date if prospect.person else None
                ),
                "spirit_baptism_date": (
                    prospect.person.spirit_baptism_date if prospect.person else None
                ),
                "reached_date": get_reached_date(prospect.person),
                "metric": metric,
            }
            for prospect in prospects_qs
        ]

    def _paginated_drilldown_response(self, rows):
        paginator = self.DrilldownPagination()
        page = paginator.paginate_queryset(rows, self.request, view=self)
        serializer = EvangelismTallyDrilldownSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"])
    def tally(self, request):
        """Unified weekly tally for evangelism + cluster reports."""
        cluster_id = request.query_params.get("cluster")
        year = request.query_params.get("year")
        week_number = request.query_params.get("week_number")

        evangelism_qs = EvangelismWeeklyReport.objects.select_related(
            "evangelism_group", "evangelism_group__cluster"
        ).prefetch_related("members_attended", "visitors_attended")
        cluster_qs = ClusterWeeklyReport.objects.select_related("cluster").prefetch_related(
            "members_attended", "visitors_attended"
        )

        if year:
            evangelism_qs = evangelism_qs.filter(year=year)
            cluster_qs = cluster_qs.filter(year=year)
        if week_number:
            evangelism_qs = evangelism_qs.filter(week_number=week_number)
            cluster_qs = cluster_qs.filter(week_number=week_number)

        cluster = None
        if cluster_id:
            try:
                cluster = Cluster.objects.get(id=cluster_id)
            except Cluster.DoesNotExist:
                cluster = None

        if cluster:
            evangelism_qs = evangelism_qs.filter(evangelism_group__cluster=cluster)
            cluster_qs = cluster_qs.filter(cluster=cluster)

        tallies = {}

        def get_entry(cluster_obj, year_val, week_val):
            key = (cluster_obj.id if cluster_obj else None, int(year_val), int(week_val))
            if key not in tallies:
                tallies[key] = {
                    "cluster_id": cluster_obj.id if cluster_obj else None,
                    "cluster_name": cluster_obj.name if cluster_obj else "Unassigned",
                    "year": int(year_val),
                    "week_number": int(week_val),
                    "meeting_dates": [],
                    "gathering_types": set(),
                    "members_set": set(),
                    "visitors_set": set(),
                    "evangelism_reports_count": 0,
                    "cluster_reports_count": 0,
                    "new_prospects": 0,
                    "conversions_this_week": 0,
                }
            return tallies[key]

        for report in evangelism_qs:
            entry = get_entry(report.evangelism_group.cluster, report.year, report.week_number)
            entry["meeting_dates"].append(report.meeting_date)
            entry["gathering_types"].add(report.gathering_type)
            entry["members_set"].update(report.members_attended.values_list("id", flat=True))
            entry["visitors_set"].update(report.visitors_attended.values_list("id", flat=True))
            entry["evangelism_reports_count"] += 1
            entry["new_prospects"] += report.new_prospects or 0
            entry["conversions_this_week"] += report.conversions_this_week or 0

        for report in cluster_qs:
            entry = get_entry(report.cluster, report.year, report.week_number)
            entry["meeting_dates"].append(report.meeting_date)
            entry["gathering_types"].add(report.gathering_type)
            entry["members_set"].update(report.members_attended.values_list("id", flat=True))
            entry["visitors_set"].update(report.visitors_attended.values_list("id", flat=True))
            entry["cluster_reports_count"] += 1

        rows = []
        for entry in tallies.values():
            gathering_types = entry["gathering_types"]
            if not gathering_types:
                gathering_type = "UNKNOWN"
            elif len(gathering_types) == 1:
                gathering_type = next(iter(gathering_types))
            else:
                gathering_type = "MIXED"

            meeting_date = min(entry["meeting_dates"]) if entry["meeting_dates"] else None

            rows.append(
                {
                    "cluster_id": entry["cluster_id"],
                    "cluster_name": entry["cluster_name"],
                    "year": entry["year"],
                    "week_number": entry["week_number"],
                    "meeting_date": meeting_date,
                    "gathering_type": gathering_type,
                    "members_count": len(entry["members_set"]),
                    "visitors_count": len(entry["visitors_set"]),
                    "evangelism_reports_count": entry["evangelism_reports_count"],
                    "cluster_reports_count": entry["cluster_reports_count"],
                    "new_prospects": entry["new_prospects"],
                    "conversions_this_week": entry["conversions_this_week"],
                }
            )

        rows.sort(key=lambda r: (r["year"], r["week_number"]), reverse=True)
        serializer = EvangelismTallySerializer(rows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="people_tally")
    def people_tally(self, request):
        """Monthly tally based on person attendance/baptism dates."""
        year = request.query_params.get("year")
        year_int = int(year) if year else timezone.now().year

        branch_id, cluster_id, eg_id, group_person_ids = self._branch_cluster_group_scope()

        base_qs = Person.objects.exclude(role="ADMIN")
        if branch_id is not None:
            base_qs = base_qs.filter(branch_id=branch_id)
        if cluster_id is not None:
            base_qs = base_qs.filter(clusters__id=cluster_id)
        elif eg_id is not None:
            gp_ids = group_person_ids or frozenset()
            base_qs = base_qs.filter(id__in=gp_ids) if gp_ids else base_qs.none()

        rows = []
        for month in range(1, 13):
            invited_count = base_qs.filter(
                role="VISITOR",
                status="INVITED",
                date_joined__year=year_int,
                date_joined__month=month,
            ).count()
            attended_count = base_qs.filter(
                role="VISITOR",
                status="ATTENDED",
                date_first_attended__year=year_int,
                date_first_attended__month=month,
            ).count()

            student_lsr = LessonSessionReport.objects.filter(
                session_date__year=year_int,
                session_date__month=month,
            )
            if branch_id is not None:
                student_lsr = student_lsr.filter(student__branch_id=branch_id)
            if cluster_id is not None:
                student_lsr = student_lsr.filter(student__clusters__id=cluster_id)
            elif eg_id is not None:
                gp_ids = group_person_ids or frozenset()
                if gp_ids:
                    student_lsr = student_lsr.filter(student_id__in=gp_ids)
                else:
                    student_lsr = student_lsr.none()

            student_ids = student_lsr.values_list("student_id", flat=True).distinct()

            student_qs = Prospect.objects.filter(
                person_id__in=student_ids,
                commitment_form_signed=False,
            )
            if branch_id is not None:
                student_qs = student_qs.filter(person__branch_id=branch_id)
            if cluster_id is not None:
                student_qs = student_qs.filter(person__clusters__id=cluster_id)
            elif eg_id is not None:
                gp_ids = group_person_ids or frozenset()
                if gp_ids:
                    student_qs = student_qs.filter(person_id__in=gp_ids)
                else:
                    student_qs = student_qs.none()
            students_count = student_qs.values_list("person_id", flat=True).distinct().count()

            baptized_count = base_qs.filter(
                water_baptism_date__year=year_int,
                water_baptism_date__month=month,
            ).count()
            received_hg_count = base_qs.filter(
                spirit_baptism_date__year=year_int,
                spirit_baptism_date__month=month,
            ).count()
            reached_count = (
                base_qs.filter(
                    water_baptism_date__isnull=False,
                    spirit_baptism_date__isnull=False,
                )
                .annotate(
                    reached_date=Greatest(
                        "water_baptism_date",
                        "spirit_baptism_date",
                    )
                )
                .filter(
                    reached_date__year=year_int,
                    reached_date__month=month,
                )
                .count()
            )
            rows.append(
                {
                    "month": month,
                    "year": year_int,
                    "invited_count": invited_count,
                    "attended_count": attended_count,
                    "students_count": students_count,
                    "baptized_count": baptized_count,
                    "received_hg_count": received_hg_count,
                    "reached_count": reached_count,
                }
            )

        serializer = EvangelismPeopleTallySerializer(rows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="people_tally_years")
    def people_tally_years(self, request):
        branch_id, cluster_id, eg_id, group_person_ids = self._branch_cluster_group_scope()
        years = set()

        people_qs = Person.objects.exclude(role="ADMIN")
        if branch_id is not None:
            people_qs = people_qs.filter(branch_id=branch_id)
        if cluster_id is not None:
            people_qs = people_qs.filter(clusters__id=cluster_id)
        elif eg_id is not None:
            gp_ids = group_person_ids or frozenset()
            people_qs = people_qs.filter(id__in=gp_ids) if gp_ids else people_qs.none()

        years.update(
            people_qs.filter(
                role="VISITOR",
                status="INVITED",
                date_joined__isnull=False,
            )
            .dates("date_joined", "year")
        )
        years.update(
            people_qs.filter(
                role="VISITOR",
                status="ATTENDED",
                date_first_attended__isnull=False,
            )
            .dates("date_first_attended", "year")
        )
        years.update(
            people_qs.filter(water_baptism_date__isnull=False)
            .dates("water_baptism_date", "year")
        )
        years.update(
            people_qs.filter(spirit_baptism_date__isnull=False)
            .dates("spirit_baptism_date", "year")
        )

        eligible_q = Prospect.objects.filter(commitment_form_signed=False, person__isnull=False)
        if branch_id is not None:
            eligible_q = eligible_q.filter(person__branch_id=branch_id)
        if cluster_id is not None:
            eligible_q = eligible_q.filter(person__clusters__id=cluster_id)
        elif eg_id is not None:
            gp_ids = group_person_ids or frozenset()
            eligible_q = (
                eligible_q.filter(person_id__in=gp_ids) if gp_ids else eligible_q.none()
            )

        eligible_person_ids = eligible_q.values_list("person_id", flat=True)

        lesson_qs = LessonSessionReport.objects.filter(
            student_id__in=eligible_person_ids,
            session_date__isnull=False,
        )
        if branch_id is not None:
            lesson_qs = lesson_qs.filter(student__branch_id=branch_id)
        if cluster_id is not None:
            lesson_qs = lesson_qs.filter(student__clusters__id=cluster_id)
        elif eg_id is not None:
            gp_ids = group_person_ids or frozenset()
            lesson_qs = (
                lesson_qs.filter(student_id__in=gp_ids)
                if gp_ids
                else lesson_qs.none()
            )
        years.update(lesson_qs.dates("session_date", "year"))

        sorted_years = sorted([y.year for y in years], reverse=True)
        current_year = timezone.now().year
        return Response(
            {
                "years": sorted_years,
                "default_year": sorted_years[0] if sorted_years else current_year,
            }
        )

    @action(detail=False, methods=["get"], url_path="people_tally_detail")
    def people_tally_detail(self, request):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        metric = request.query_params.get("metric")
        branch_id, cluster_id, eg_id, group_person_ids = self._branch_cluster_group_scope()

        valid_metrics = {
            "invited",
            "attended",
            "students",
            "baptized",
            "received_hg",
            "reached",
        }
        if metric not in valid_metrics:
            return Response(
                {"detail": "metric must be one of invited, attended, students, baptized, received_hg, reached."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year_int = int(year) if year else timezone.now().year
            month_int = int(month)
        except (TypeError, ValueError):
            return Response(
                {"detail": "year and month must be valid integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month_int < 1 or month_int > 12:
            return Response(
                {"detail": "month must be between 1 and 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        base_people = Person.objects.exclude(role="ADMIN")
        if branch_id is not None:
            base_people = base_people.filter(branch_id=branch_id)
        if cluster_id is not None:
            base_people = base_people.filter(clusters__id=cluster_id)
        elif eg_id is not None:
            gp_ids = group_person_ids or frozenset()
            base_people = base_people.filter(id__in=gp_ids) if gp_ids else base_people.none()

        if metric == "invited":
            rows = self._serialize_people_rows(
                base_people.filter(
                    role="VISITOR",
                    status="INVITED",
                    date_joined__year=year_int,
                    date_joined__month=month_int,
                ).order_by("first_name", "last_name", "username"),
                metric,
                date_attr="date_joined",
            )
        elif metric == "attended":
            rows = self._serialize_people_rows(
                base_people.filter(
                    role="VISITOR",
                    status="ATTENDED",
                    date_first_attended__year=year_int,
                    date_first_attended__month=month_int,
                ).order_by("first_name", "last_name", "username"),
                metric,
                date_attr="date_first_attended",
            )
        elif metric == "students":
            lesson_base = LessonSessionReport.objects.filter(
                session_date__year=year_int,
                session_date__month=month_int,
            )
            if branch_id is not None:
                lesson_base = lesson_base.filter(student__branch_id=branch_id)
            if cluster_id is not None:
                lesson_base = lesson_base.filter(student__clusters__id=cluster_id)
            elif eg_id is not None:
                gp_ids = group_person_ids or frozenset()
                if gp_ids:
                    lesson_base = lesson_base.filter(student_id__in=gp_ids)
                else:
                    lesson_base = lesson_base.none()

            student_dates = {
                entry["student_id"]: entry["event_date"]
                for entry in lesson_base.values("student_id")
                .annotate(event_date=Min("session_date"))
            }
            student_ids = lesson_base.values_list("student_id", flat=True).distinct()
            student_qs = Prospect.objects.filter(
                person_id__in=student_ids,
                commitment_form_signed=False,
            )
            if branch_id is not None:
                student_qs = student_qs.filter(person__branch_id=branch_id)
            if cluster_id is not None:
                student_qs = student_qs.filter(person__clusters__id=cluster_id)
            elif eg_id is not None:
                gp_ids = group_person_ids or frozenset()
                if gp_ids:
                    student_qs = student_qs.filter(person_id__in=gp_ids)
                else:
                    student_qs = student_qs.none()

            student_prospects = student_qs.select_related("person").order_by("person_id", "id")
            unique_prospects = []
            seen_person_ids = set()
            for prospect in student_prospects:
                if not prospect.person_id or prospect.person_id in seen_person_ids:
                    continue
                seen_person_ids.add(prospect.person_id)
                unique_prospects.append(prospect)
            rows = self._serialize_prospect_rows(
                unique_prospects, metric, date_map_by_person_id=student_dates
            )
        elif metric == "baptized":
            rows = self._serialize_people_rows(
                base_people.filter(
                    water_baptism_date__year=year_int,
                    water_baptism_date__month=month_int,
                ).order_by("first_name", "last_name", "username"),
                metric,
                date_attr="water_baptism_date",
            )
        elif metric == "received_hg":
            rows = self._serialize_people_rows(
                base_people.filter(
                    spirit_baptism_date__year=year_int,
                    spirit_baptism_date__month=month_int,
                ).order_by("first_name", "last_name", "username"),
                metric,
                date_attr="spirit_baptism_date",
            )
        else:
            rows = self._serialize_people_rows(
                base_people.filter(
                    water_baptism_date__isnull=False,
                    spirit_baptism_date__isnull=False,
                )
                .annotate(
                    reached_date=Greatest(
                        "water_baptism_date",
                        "spirit_baptism_date",
                    )
                )
                .filter(
                    reached_date__year=year_int,
                    reached_date__month=month_int,
                )
                .order_by("first_name", "last_name", "username"),
                metric,
                date_attr="reached_date",
            )

        return self._paginated_drilldown_response(rows)

    @action(detail=False, methods=["get"], url_path="tally_people_detail")
    def tally_people_detail(self, request):
        year = request.query_params.get("year")
        week_number = request.query_params.get("week_number")
        metric = request.query_params.get("metric")
        cluster_id = request.query_params.get("cluster_id")

        if metric not in {"members", "visitors"}:
            return Response(
                {"detail": "metric must be one of members, visitors."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cluster_id is None:
            return Response(
                {"detail": "cluster_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year_int = int(year) if year else timezone.now().year
            week_int = int(week_number)
        except (TypeError, ValueError):
            return Response(
                {"detail": "year and week_number must be valid integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        evangelism_qs = EvangelismWeeklyReport.objects.select_related("evangelism_group").filter(
            year=year_int,
            week_number=week_int,
        )
        cluster_qs = ClusterWeeklyReport.objects.filter(
            year=year_int,
            week_number=week_int,
        )

        if str(cluster_id).lower() in {"null", "none", "unassigned"}:
            evangelism_qs = evangelism_qs.filter(evangelism_group__cluster__isnull=True)
            cluster_qs = cluster_qs.none()
        else:
            try:
                cluster = Cluster.objects.get(id=cluster_id)
            except Cluster.DoesNotExist:
                return Response(
                    {"detail": "Cluster not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            evangelism_qs = evangelism_qs.filter(evangelism_group__cluster=cluster)
            cluster_qs = cluster_qs.filter(cluster=cluster)

        person_ids = set()
        person_dates = {}

        def collect_ids_and_dates(ids, meeting_date):
            for person_id in ids:
                person_ids.add(person_id)
                existing_date = person_dates.get(person_id)
                if existing_date is None or meeting_date < existing_date:
                    person_dates[person_id] = meeting_date

        for report in evangelism_qs:
            if metric == "members":
                collect_ids_and_dates(
                    report.members_attended.values_list("id", flat=True),
                    report.meeting_date,
                )
            else:
                collect_ids_and_dates(
                    report.visitors_attended.values_list("id", flat=True),
                    report.meeting_date,
                )
        for report in cluster_qs:
            if metric == "members":
                collect_ids_and_dates(
                    report.members_attended.values_list("id", flat=True),
                    report.meeting_date,
                )
            else:
                collect_ids_and_dates(
                    report.visitors_attended.values_list("id", flat=True),
                    report.meeting_date,
                )

        people = Person.objects.exclude(role="ADMIN").filter(id__in=person_ids).order_by(
            "first_name", "last_name", "username"
        )
        rows = self._serialize_people_rows(people, metric, date_map=person_dates)
        return self._paginated_drilldown_response(rows)


class ProspectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = Prospect.objects.select_related(
        "invited_by",
        "inviter_cluster",
        "evangelism_group",
        "endorsed_cluster",
        "person",
    ).all()
    serializer_class = ProspectSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = (
        "invited_by",
        "inviter_cluster",
        "evangelism_group",
        "pipeline_stage",
        "endorsed_cluster",
        "is_dropped_off",
    )
    search_fields = ("name", "contact_info", "notes")
    ordering_fields = ("last_activity_date", "created_at", "name")
    ordering = ("-last_activity_date", "name")

    def perform_create(self, serializer):
        """Auto-set inviter_cluster based on inviter's cluster membership."""
        prospect = serializer.save(pipeline_stage=Prospect.PipelineStage.INVITED)
        if not prospect.inviter_cluster:
            cluster = get_inviter_cluster(prospect.invited_by)
            if cluster:
                prospect.inviter_cluster = cluster
                prospect.save(update_fields=["inviter_cluster"])

    @action(detail=True, methods=["post"])
    def endorse_to_cluster(self, request, pk=None):
        """Endorse visitor to a different cluster."""
        prospect = self.get_object()
        cluster_id = request.data.get("cluster_id")

        if not cluster_id:
            return Response(
                {"error": "cluster_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cluster = Cluster.objects.get(id=cluster_id)
        except Cluster.DoesNotExist:
            return Response(
                {"error": "Cluster not found"}, status=status.HTTP_404_NOT_FOUND
            )

        prospect = endorse_visitor_to_cluster(prospect, cluster)
        serializer = self.get_serializer(prospect)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def update_progress(self, request, pk=None):
        """Update visitor's pipeline stage and last activity."""
        prospect = self.get_object()
        pipeline_stage = request.data.get("pipeline_stage")
        last_activity_date = request.data.get("last_activity_date")

        if pipeline_stage == Prospect.PipelineStage.ATTENDED:
            return self.mark_attended(request, pk=pk)

        activity_date = last_activity_date or timezone.now().date()
        if pipeline_stage:
            prospect.pipeline_stage = pipeline_stage
        if last_activity_date:
            prospect.last_activity_date = last_activity_date
        else:
            prospect.last_activity_date = timezone.now().date()

        prospect.save()

        if prospect.person and prospect.person.role == "VISITOR":
            person = prospect.person
            fields_to_update = []
            if pipeline_stage in [
                Prospect.PipelineStage.INVITED,
                Prospect.PipelineStage.ATTENDED,
            ]:
                person.status = pipeline_stage
                fields_to_update.append("status")

            if pipeline_stage == Prospect.PipelineStage.ATTENDED:
                person.date_first_attended = activity_date
                fields_to_update.append("date_first_attended")

            if pipeline_stage == Prospect.PipelineStage.BAPTIZED:
                person.water_baptism_date = activity_date
                fields_to_update.append("water_baptism_date")

            if pipeline_stage == Prospect.PipelineStage.RECEIVED_HG:
                person.spirit_baptism_date = activity_date
                fields_to_update.append("spirit_baptism_date")

            if fields_to_update:
                person.save(update_fields=fields_to_update)

        # Update monthly tracking if stage changed
        if pipeline_stage and pipeline_stage in [
            Prospect.PipelineStage.INVITED,
            Prospect.PipelineStage.ATTENDED,
            Prospect.PipelineStage.BAPTIZED,
            Prospect.PipelineStage.RECEIVED_HG,
        ]:
            cluster = prospect.inviter_cluster or prospect.endorsed_cluster
            if cluster:
                update_monthly_tracking(
                    prospect, pipeline_stage, cluster, prospect.last_activity_date
                )

        serializer = self.get_serializer(prospect)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_attended(self, request, pk=None):
        """Mark prospect as attended (auto-creates/links Person, updates monthly tracking)."""
        prospect = self.get_object()
        last_activity_date = request.data.get("last_activity_date")
        activity_date = None
        if last_activity_date:
            try:
                activity_date = date.fromisoformat(last_activity_date)
            except ValueError:
                activity_date = None
        if activity_date is None:
            activity_date = timezone.now().date()

        # Create or link Person if not exists
        if not prospect.person:
            first_name = request.data.get(
                "first_name", prospect.name.split()[0] if prospect.name else ""
            )
            last_name = request.data.get(
                "last_name",
                prospect.name.split()[-1] if len(prospect.name.split()) > 1 else "",
            )

            if not first_name or not last_name:
                return Response(
                    {"error": "first_name and last_name are required to create Person"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            person = create_person_from_prospect(
                prospect,
                first_name,
                last_name,
                date_first_attended=activity_date,
            )
        else:
            person = prospect.person
            if person and person.role == "VISITOR":
                updates = []
                if person.status != "ATTENDED":
                    person.status = "ATTENDED"
                    updates.append("status")
                if not person.date_first_attended:
                    person.date_first_attended = activity_date
                    updates.append("date_first_attended")
                if prospect.facebook_name and not person.facebook_name:
                    person.facebook_name = prospect.facebook_name
                    updates.append("facebook_name")
                if updates:
                    person.save(update_fields=updates)

        # Update prospect stage and activity
        prospect.pipeline_stage = Prospect.PipelineStage.ATTENDED
        prospect.last_activity_date = activity_date
        prospect.save()

        if prospect.notes and person:
            note_date = person.date_first_attended or activity_date
            note_qs = Journey.objects.filter(
                user=person, type="NOTE", date=note_date
            )
            if note_qs.exists():
                note_qs.update(description=prospect.notes)
            else:
                Journey.objects.create(
                    user=person,
                    type="NOTE",
                    title="Visitor note",
                    description=prospect.notes,
                    date=note_date,
                    verified_by=None,
                )

        # Update monthly tracking
        cluster = prospect.inviter_cluster or prospect.endorsed_cluster
        if cluster:
            update_monthly_tracking(
                prospect,
                MonthlyConversionTracking.Stage.ATTENDED,
                cluster,
                prospect.last_activity_date,
            )

        serializer = self.get_serializer(prospect)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def create_person(self, request, pk=None):
        """Manual action to create Person record from prospect."""
        prospect = self.get_object()

        if prospect.person:
            return Response(
                {"error": "Prospect already has a linked Person"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")

        if not first_name or not last_name:
            return Response(
                {"error": "first_name and last_name are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        person = create_person_from_prospect(
            prospect, first_name, last_name, **request.data
        )
        serializer = ProspectSerializer(prospect)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def mark_dropped_off(self, request, pk=None):
        """Manually mark visitor as dropped off."""
        prospect = self.get_object()
        prospect.is_dropped_off = True
        prospect.drop_off_date = timezone.now().date()
        prospect.drop_off_stage = prospect.pipeline_stage
        prospect.drop_off_reason = request.data.get("reason", "")
        prospect.save()

        # Create DropOff record
        days_inactive = prospect.days_since_last_activity or 0
        DropOff.objects.create(
            prospect=prospect,
            drop_off_date=prospect.drop_off_date,
            drop_off_stage=prospect.drop_off_stage,
            days_inactive=days_inactive,
            reason=request.data.get("reason", ""),
            reason_details=request.data.get("reason_details", ""),
        )

        serializer = self.get_serializer(prospect)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def recover(self, request, pk=None):
        """Recover a dropped off visitor."""
        prospect = self.get_object()
        prospect.is_dropped_off = False
        prospect.last_activity_date = timezone.now().date()
        prospect.save()

        # Update DropOff record if exists
        if hasattr(prospect, "drop_off_record"):
            drop_off = prospect.drop_off_record
            drop_off.recovery_attempted = True
            drop_off.recovery_date = timezone.now().date()
            drop_off.recovered = True
            drop_off.recovered_date = timezone.now().date()
            drop_off.save()

        serializer = self.get_serializer(prospect)
        return Response(serializer.data)


class FollowUpTaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = FollowUpTask.objects.select_related(
        "prospect", "assigned_to", "created_by"
    ).all()
    serializer_class = FollowUpTaskSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("prospect", "assigned_to", "status", "priority")
    search_fields = ("prospect__name", "notes")
    ordering_fields = ("due_date", "priority", "created_at")
    ordering = ("due_date", "priority")

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark task as completed."""
        task = self.get_object()
        task.status = FollowUpTask.Status.COMPLETED
        task.completed_date = timezone.now().date()
        task.save()

        serializer = self.get_serializer(task)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        """List overdue tasks."""
        today = timezone.now().date()
        overdue_tasks = self.queryset.filter(
            due_date__lt=today,
            status__in=[FollowUpTask.Status.PENDING, FollowUpTask.Status.IN_PROGRESS],
        )
        serializer = self.get_serializer(overdue_tasks, many=True)
        return Response(serializer.data)


class DropOffViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = DropOff.objects.select_related("prospect").all()
    serializer_class = DropOffSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("drop_off_stage", "reason", "recovered")
    search_fields = ("prospect__name", "reason_details")
    ordering_fields = ("drop_off_date", "days_inactive")
    ordering = ("-drop_off_date",)

    @action(detail=True, methods=["post"])
    def recover(self, request, pk=None):
        """Attempt to recover a dropped off visitor."""
        drop_off = self.get_object()
        drop_off.recovery_attempted = True
        drop_off.recovery_date = timezone.now().date()
        drop_off.save()

        # Update prospect
        prospect = drop_off.prospect
        prospect.is_dropped_off = False
        prospect.last_activity_date = timezone.now().date()
        prospect.save()

        serializer = self.get_serializer(drop_off)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Drop-off analytics by stage, reason, time period."""
        drop_offs = self.queryset.all()

        # Filter by date range if provided
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        if start_date:
            drop_offs = drop_offs.filter(drop_off_date__gte=start_date)
        if end_date:
            drop_offs = drop_offs.filter(drop_off_date__lte=end_date)

        # Group by stage
        by_stage = {}
        for stage in Prospect.PipelineStage.choices:
            count = drop_offs.filter(drop_off_stage=stage[0]).count()
            by_stage[stage[1]] = count

        # Group by reason
        by_reason = {}
        for reason in DropOff.DropOffReason.choices:
            count = drop_offs.filter(reason=reason[0]).count()
            by_reason[reason[1]] = count

        # Recovery statistics
        total = drop_offs.count()
        recovered = drop_offs.filter(recovered=True).count()
        recovery_rate = round((recovered / total * 100), 2) if total > 0 else 0.0

        return Response(
            {
                "total_drop_offs": total,
                "recovered": recovered,
                "recovery_rate": recovery_rate,
                "by_stage": by_stage,
                "by_reason": by_reason,
            }
        )


class ConversionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = Conversion.objects.select_related(
        "person",
        "prospect",
        "converted_by",
        "evangelism_group",
        "cluster",
        "verified_by",
    ).all()
    serializer_class = ConversionSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("converted_by", "cluster", "evangelism_group")
    search_fields = ("person__first_name", "person__last_name", "notes")
    ordering_fields = ("conversion_date", "created_at")
    ordering = ("-conversion_date",)

    def perform_create(self, serializer):
        """Auto-update Person's baptism dates and prospect pipeline stage."""
        conversion = serializer.save()
        updates = []
        if not conversion.converted_by_id:
            conversion.converted_by = self.request.user
            updates.append("converted_by")
        if not conversion.conversion_date:
            conversion.conversion_date = (
                conversion.water_baptism_date
                or conversion.spirit_baptism_date
                or timezone.now().date()
            )
            updates.append("conversion_date")
        if updates:
            conversion.save(update_fields=updates)

        # Validate lesson completion if baptized
        if conversion.water_baptism_date or conversion.spirit_baptism_date:
            if conversion.prospect:
                if not check_lesson_completion(conversion.prospect):
                    raise ValidationError(
                        "Prospect must complete lessons before baptism (unless fast-tracked)"
                    )

        # Update Person's baptism dates
        update_person_baptism_dates(conversion, conversion.notes or None)

        # Update prospect pipeline stage
        if conversion.prospect:
            if conversion.water_baptism_date:
                conversion.prospect.pipeline_stage = Prospect.PipelineStage.BAPTIZED
                conversion.prospect.save()
                # Update monthly tracking
                cluster = (
                    conversion.cluster
                    or conversion.prospect.inviter_cluster
                    or conversion.prospect.endorsed_cluster
                )
                if cluster:
                    update_monthly_tracking(
                        conversion.prospect,
                        MonthlyConversionTracking.Stage.BAPTIZED,
                        cluster,
                        conversion.water_baptism_date,
                    )

            if conversion.spirit_baptism_date:
                conversion.prospect.pipeline_stage = Prospect.PipelineStage.RECEIVED_HG
                conversion.prospect.save()
                # Update monthly tracking
                cluster = (
                    conversion.cluster
                    or conversion.prospect.inviter_cluster
                    or conversion.prospect.endorsed_cluster
                )
                if cluster:
                    update_monthly_tracking(
                        conversion.prospect,
                        MonthlyConversionTracking.Stage.RECEIVED_HG,
                        cluster,
                        conversion.spirit_baptism_date,
                    )

            # Check if both completed
            if conversion.is_complete:
                conversion.prospect.pipeline_stage = Prospect.PipelineStage.CONVERTED
                conversion.prospect.save()

        # Update Each1Reach1Goal
        if conversion.is_complete:
            update_each1reach1_goal(conversion)

    def perform_update(self, serializer):
        """Update Person's baptism dates and prospect pipeline stage."""
        conversion = serializer.save()
        update_person_baptism_dates(conversion, conversion.notes or None)

        if conversion.is_complete:
            update_each1reach1_goal(conversion)


class MonthlyConversionTrackingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = MonthlyConversionTracking.objects.select_related(
        "cluster", "prospect", "person"
    ).all()
    serializer_class = MonthlyConversionTrackingSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("cluster", "year", "month", "stage")
    search_fields = ("prospect__name",)
    ordering_fields = ("year", "month", "stage")
    ordering = ("-year", "-month", "stage")

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        """Monthly statistics by stage."""
        cluster_id = request.query_params.get("cluster")
        year = request.query_params.get("year")
        month = request.query_params.get("month")

        cluster = None
        if cluster_id:
            try:
                cluster = Cluster.objects.get(id=cluster_id)
            except Cluster.DoesNotExist:
                pass

        year_int = int(year) if year else None
        month_int = int(month) if month else None

        stats = calculate_monthly_statistics(
            cluster=cluster, year=year_int, month=month_int
        )
        serializer = MonthlyStatisticsSerializer(stats, many=True)
        return Response(serializer.data)


class Each1Reach1GoalViewSet(viewsets.ModelViewSet):
    class GoalPagination(PageNumberPagination):
        page_size = 20
        page_size_query_param = "page_size"
        max_page_size = 100

    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = Each1Reach1Goal.objects.select_related("cluster").all()
    serializer_class = Each1Reach1GoalSerializer
    pagination_class = GoalPagination
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("cluster", "cluster__branch", "year", "status")
    search_fields = ("cluster__name", "cluster__evangelism_groups__name")
    ordering_fields = ("year", "achieved_conversions")
    ordering = ("-year", "cluster__name")

    def get_queryset(self):
        qs = super().get_queryset()
        # Joining evangelism group names can duplicate goal rows; DISTINCT keeps pagination correct.
        if self.request.query_params.get("search"):
            return qs.distinct()
        return qs

    def _resolve_goal_year(self):
        year = self.request.query_params.get("year")
        if not year:
            return timezone.now().year
        try:
            return int(year)
        except (TypeError, ValueError):
            raise ValidationError({"year": "Year must be a valid integer."})

    def _ensure_yearly_goals(self, year: int) -> None:
        existing_cluster_ids = set(
            Each1Reach1Goal.objects.filter(year=year).values_list("cluster_id", flat=True)
        )
        missing_clusters = Cluster.objects.exclude(id__in=existing_cluster_ids)

        for cluster in missing_clusters:
            Each1Reach1Goal.objects.get_or_create(
                cluster=cluster,
                year=year,
                defaults={
                    "target_conversions": get_default_each1reach1_target(cluster),
                    "achieved_conversions": 0,
                    "status": Each1Reach1Goal.Status.NOT_STARTED,
                },
            )

    def list(self, request, *args, **kwargs):
        self._ensure_yearly_goals(self._resolve_goal_year())
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="default_target")
    def default_target(self, request):
        cluster_id = request.query_params.get("cluster_id") or request.query_params.get("cluster")
        if not cluster_id:
            return Response(
                {"detail": "cluster_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cluster = Cluster.objects.get(id=cluster_id)
        except Cluster.DoesNotExist:
            return Response(
                {"detail": "Cluster not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        year = request.query_params.get("year")
        if year:
            try:
                year_int = int(year)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Year must be a valid integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            year_int = timezone.now().year

        return Response(
            {
                "cluster_id": cluster.id,
                "year": year_int,
                "target_conversions": get_default_each1reach1_target(cluster),
            }
        )

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        """Cluster progress report."""
        goal = self.get_object()
        cluster_stats = get_cluster_statistics(goal.cluster, goal.year)
        return Response(cluster_stats)

    @action(detail=True, methods=["get"])
    def member_progress(self, request, pk=None):
        """Individual member progress within cluster."""
        goal = self.get_object()
        cluster = goal.cluster

        # Get conversions by cluster members
        conversions = Conversion.objects.filter(
            cluster=cluster, conversion_date__year=goal.year, is_complete=True
        ).select_related("converted_by", "person")

        member_progress = {}
        for conversion in conversions:
            converter_id = conversion.converted_by.id
            if converter_id not in member_progress:
                member_progress[converter_id] = {
                    "member_id": converter_id,
                    "member_name": conversion.converted_by.get_full_name()
                    or conversion.converted_by.username,
                    "conversions": 0,
                }
            member_progress[converter_id]["conversions"] += 1

        return Response(list(member_progress.values()))

    @action(detail=False, methods=["get"])
    def leaderboard(self, request):
        """Top converting clusters."""
        year = request.query_params.get("year")
        year_int = int(year) if year else timezone.now().year

        goals = self.queryset.filter(year=year_int).order_by("-achieved_conversions")[
            :10
        ]
        serializer = self.get_serializer(goals, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Yearly summary statistics."""
        year = request.query_params.get("year")
        year_int = int(year) if year else timezone.now().year

        report = generate_each1reach1_report(year=year_int)
        return Response(report)

from datetime import date, datetime, timedelta
from typing import Optional

from django.db.models import Prefetch, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.attendance.models import AttendanceRecord
from apps.events.models import Event
from apps.people.models import Person
from apps.clusters.models import Cluster

from .models import (
    EvangelismGroup,
    EvangelismGroupMember,
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
    EvangelismGroupMemberSerializer,
    EvangelismBulkEnrollSerializer,
    EvangelismSessionSerializer,
    EvangelismRecurringSessionSerializer,
    EvangelismWeeklyReportSerializer,
    ProspectSerializer,
    FollowUpTaskSerializer,
    DropOffSerializer,
    ConversionSerializer,
    MonthlyConversionTrackingSerializer,
    MonthlyStatisticsSerializer,
    Each1Reach1GoalSerializer,
    EvangelismSummarySerializer,
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
    calculate_conversion_rate,
    get_group_statistics,
    get_cluster_statistics,
    create_recurring_sessions,
    generate_each1reach1_report,
)


class EvangelismGroupViewSet(viewsets.ModelViewSet):
    queryset = (
        EvangelismGroup.objects.select_related("coordinator", "cluster")
        .prefetch_related(
            Prefetch(
                "members",
                queryset=EvangelismGroupMember.objects.select_related("person").filter(
                    is_active=True
                ),
            )
        )
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

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        """Bulk enroll members into a group."""
        evangelism_group = self.get_object()
        serializer = EvangelismBulkEnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        person_ids = serializer.validated_data["person_ids"]
        role = serializer.validated_data["role"]

        created_count = bulk_enroll_members(evangelism_group, person_ids, role)

        return Response(
            {"created": created_count, "message": f"Enrolled {created_count} people"},
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

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

    @action(detail=False, methods=["get"])
    def bible_sharers_coverage(self, request):
        """Get Bible Sharers coverage across clusters.

        Returns which clusters have Bible Sharers and which don't.
        """
        from apps.clusters.models import Cluster
        from .serializers import ClusterSummarySerializer

        # Get all active Bible Sharers groups
        bible_sharers_groups = self.queryset.filter(
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
                    members_count = group.members.filter(is_active=True).count()
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


class EvangelismGroupMemberViewSet(viewsets.ModelViewSet):
    queryset = EvangelismGroupMember.objects.select_related(
        "evangelism_group", "person"
    ).all()
    serializer_class = EvangelismGroupMemberSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("evangelism_group", "role", "is_active")
    search_fields = (
        "person__first_name",
        "person__last_name",
        "person__username",
        "evangelism_group__name",
    )
    ordering_fields = ("joined_date", "role")
    ordering = ("evangelism_group__name", "role", "person__last_name")


class EvangelismSessionViewSet(viewsets.ModelViewSet):
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
        event_type = "CLUSTER_BS_EVANGELISM" if group.cluster else "BIBLE_STUDY"

        event = Event.objects.create(
            title=event_title,
            description=f"Bible Study session for {group.name}",
            start_date=session_datetime,
            end_date=end_datetime,
            type=event_type,
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
        enrolled_members = session.evangelism_group.members.filter(is_active=True)

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


class ProspectViewSet(viewsets.ModelViewSet):
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
        prospect = serializer.save()
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

        if pipeline_stage:
            prospect.pipeline_stage = pipeline_stage
        if last_activity_date:
            prospect.last_activity_date = last_activity_date
        else:
            prospect.last_activity_date = timezone.now().date()

        prospect.save()

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

            person = create_person_from_prospect(prospect, first_name, last_name)
        else:
            person = prospect.person

        # Update prospect stage and activity
        prospect.pipeline_stage = Prospect.PipelineStage.ATTENDED
        prospect.last_activity_date = timezone.now().date()
        prospect.save()

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

        # Validate lesson completion if baptized
        if conversion.water_baptism_date or conversion.spirit_baptism_date:
            if conversion.prospect:
                if not check_lesson_completion(conversion.prospect):
                    raise ValidationError(
                        "Prospect must complete lessons before baptism (unless fast-tracked)"
                    )

        # Update Person's baptism dates
        update_person_baptism_dates(conversion)

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
        update_person_baptism_dates(conversion)

        if conversion.is_complete:
            update_each1reach1_goal(conversion)


class MonthlyConversionTrackingViewSet(viewsets.ModelViewSet):
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
    queryset = Each1Reach1Goal.objects.select_related("cluster").all()
    serializer_class = Each1Reach1GoalSerializer
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("cluster", "year", "status")
    search_fields = ("cluster__name",)
    ordering_fields = ("year", "achieved_conversions")
    ordering = ("-year", "cluster__name")

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

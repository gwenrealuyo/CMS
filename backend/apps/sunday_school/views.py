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

from .models import (
    SundaySchoolCategory,
    SundaySchoolClass,
    SundaySchoolClassMember,
    SundaySchoolSession,
)
from .serializers import (
    SundaySchoolAttendanceReportSerializer,
    SundaySchoolBulkEnrollSerializer,
    SundaySchoolCategorySerializer,
    SundaySchoolClassMemberSerializer,
    SundaySchoolClassSerializer,
    SundaySchoolRecurringSessionSerializer,
    SundaySchoolSessionSerializer,
    SundaySchoolSummarySerializer,
    SundaySchoolUnenrolledByCategorySerializer,
)
from .services import (
    bulk_enroll_students,
    calculate_attendance_rate,
    create_recurring_sessions,
    generate_summary_stats,
    get_unenrolled_by_category,
)


class SundaySchoolCategoryViewSet(viewsets.ModelViewSet):
    queryset = SundaySchoolCategory.objects.all()
    serializer_class = SundaySchoolCategorySerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("is_active",)
    search_fields = ("name", "description")
    ordering_fields = ("order", "name", "created_at")
    ordering = ("order", "name")


class SundaySchoolClassViewSet(viewsets.ModelViewSet):
    queryset = (
        SundaySchoolClass.objects.select_related("category")
        .prefetch_related(
            Prefetch(
                "members",
                queryset=SundaySchoolClassMember.objects.select_related("person").filter(
                    is_active=True
                ),
            )
        )
        .all()
    )
    serializer_class = SundaySchoolClassSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("category", "is_active")
    search_fields = ("name", "description", "yearly_theme", "room_location")
    ordering_fields = ("name", "created_at")
    ordering = ("category__order", "name")

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        """Bulk enroll students/teachers into a class."""
        sunday_school_class = self.get_object()
        serializer = SundaySchoolBulkEnrollSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        person_ids = serializer.validated_data["person_ids"]
        role = serializer.validated_data["role"]

        created_count = bulk_enroll_students(sunday_school_class, person_ids, role)

        return Response(
            {"created": created_count, "message": f"Enrolled {created_count} people"},
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def sessions(self, request, pk=None):
        """List sessions for a class."""
        sunday_school_class = self.get_object()
        sessions = sunday_school_class.sessions.all().order_by("-session_date", "-session_time")

        # Apply filters
        date_from = request.query_params.get("date_from")
        if date_from:
            sessions = sessions.filter(session_date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            sessions = sessions.filter(session_date__lte=date_to)

        serializer = SundaySchoolSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def attendance(self, request, pk=None):
        """Get attendance records via linked Events."""
        sunday_school_class = self.get_object()
        sessions = sunday_school_class.sessions.filter(event__isnull=False).select_related("event")

        occurrence_date = request.query_params.get("occurrence_date")
        if occurrence_date:
            sessions = sessions.filter(session_date=occurrence_date)

        attendance_records = []
        for session in sessions:
            records = AttendanceRecord.objects.filter(
                event=session.event, occurrence_date=session.session_date
            ).select_related("person")
            for record in records:
                attendance_records.append(
                    {
                        "session_id": session.id,
                        "session_date": session.session_date,
                        "lesson_title": session.lesson_title,
                        "person_id": record.person.id,
                        "person_name": record.person.get_full_name() or record.person.username,
                        "status": record.status,
                        "notes": record.notes,
                    }
                )

        return Response(attendance_records)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Analytics endpoint returning summary statistics."""
        stats = generate_summary_stats()

        # Get most/least attended classes (optional)
        classes = SundaySchoolClass.objects.filter(is_active=True)
        class_attendance = []
        for class_obj in classes:
            rate = calculate_attendance_rate(class_obj)
            if rate is not None:
                class_attendance.append(
                    {
                        "class_id": class_obj.id,
                        "class_name": class_obj.name,
                        "attendance_rate": rate,
                    }
                )

        class_attendance.sort(key=lambda x: x["attendance_rate"], reverse=True)
        stats["most_attended_classes"] = class_attendance[:5] if class_attendance else []
        stats["least_attended_classes"] = (
            class_attendance[-5:] if len(class_attendance) > 5 else []
        )

        serializer = SundaySchoolSummarySerializer(stats)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def unenrolled_by_category(self, request):
        """Get unenrolled people by category based on age brackets."""
        status_filter = request.query_params.get("status")
        role_filter = request.query_params.get("role")

        result = get_unenrolled_by_category(status_filter=status_filter, role_filter=role_filter)
        serializer = SundaySchoolUnenrolledByCategorySerializer(result, many=True)
        return Response(serializer.data)


class SundaySchoolClassMemberViewSet(viewsets.ModelViewSet):
    queryset = SundaySchoolClassMember.objects.select_related(
        "sunday_school_class", "person"
    ).all()
    serializer_class = SundaySchoolClassMemberSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("sunday_school_class", "role", "is_active")
    search_fields = (
        "person__first_name",
        "person__last_name",
        "person__username",
        "sunday_school_class__name",
    )
    ordering_fields = ("enrolled_date", "role")
    ordering = ("sunday_school_class__name", "role", "person__last_name")


class SundaySchoolSessionViewSet(viewsets.ModelViewSet):
    queryset = SundaySchoolSession.objects.select_related(
        "sunday_school_class", "event"
    ).all()
    serializer_class = SundaySchoolSessionSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("sunday_school_class", "session_date")
    search_fields = ("lesson_title", "notes", "sunday_school_class__name")
    ordering_fields = ("session_date", "session_time", "created_at")
    ordering = ("-session_date", "-session_time")

    def perform_create(self, serializer):
        """Auto-create Event when session is created."""
        session = serializer.save()
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
        # Optionally delete event - for now, keep for historical records
        # if event:
        #     event.delete()

    def _create_event_for_session(self, session: SundaySchoolSession):
        """Create an Event for a Sunday School session."""
        class_obj = session.sunday_school_class
        meeting_time = session.session_time or class_obj.meeting_time or timezone.now().time()

        session_datetime = datetime.combine(session.session_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)  # Default 1 hour session

        event_title = class_obj.name
        if session.lesson_title:
            event_title = f"{event_title} - {session.lesson_title}"

        event = Event.objects.create(
            title=event_title,
            description=f"Sunday School session for {class_obj.name}",
            start_date=session_datetime,
            end_date=end_datetime,
            type="SUNDAY_SCHOOL",
            location=class_obj.room_location or "",
            is_recurring=False,
        )

        session.event = event
        session.save(update_fields=["event"])

    def _update_event_for_session(self, session: SundaySchoolSession):
        """Update the linked Event when session is updated."""
        if not session.event:
            return

        class_obj = session.sunday_school_class
        meeting_time = session.session_time or class_obj.meeting_time or timezone.now().time()

        session_datetime = datetime.combine(session.session_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)

        event_title = class_obj.name
        if session.lesson_title:
            event_title = f"{event_title} - {session.lesson_title}"

        session.event.title = event_title
        session.event.start_date = session_datetime
        session.event.end_date = end_datetime
        session.event.location = class_obj.room_location or ""
        session.event.save()

    @action(detail=True, methods=["get"])
    def attendance_report(self, request, pk=None):
        """Generate attendance report for a session."""
        session = self.get_object()
        if not session.event:
            return Response(
                {"error": "Session has no linked event"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get enrolled students
        enrolled_students = session.sunday_school_class.members.filter(
            is_active=True, role=SundaySchoolClassMember.Role.STUDENT
        )

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

        total_enrolled = enrolled_students.count()
        attendance_rate = (
            round((present_count / total_enrolled * 100), 2) if total_enrolled > 0 else 0.0
        )

        data = {
            "session_id": session.id,
            "session_date": session.session_date,
            "lesson_title": session.lesson_title,
            "total_enrolled": total_enrolled,
            "present_count": present_count,
            "absent_count": absent_count,
            "excused_count": excused_count,
            "attendance_rate": attendance_rate,
        }

        serializer = SundaySchoolAttendanceReportSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_recurring(self, request):
        """Create multiple sessions based on recurrence pattern."""
        serializer = SundaySchoolRecurringSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        class_id = serializer.validated_data["sunday_school_class_id"]
        sunday_school_class = SundaySchoolClass.objects.get(id=class_id)

        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data.get("end_date")
        num_occurrences = serializer.validated_data.get("num_occurrences")
        recurrence_pattern = serializer.validated_data["recurrence_pattern"]
        day_of_week = serializer.validated_data.get("day_of_week")
        default_lesson_title = serializer.validated_data.get("default_lesson_title", "")

        sessions = create_recurring_sessions(
            sunday_school_class=sunday_school_class,
            start_date=start_date,
            end_date=end_date,
            num_occurrences=num_occurrences,
            recurrence_pattern=recurrence_pattern,
            day_of_week=day_of_week,
            default_lesson_title=default_lesson_title,
        )

        session_serializer = SundaySchoolSessionSerializer(sessions, many=True)
        return Response(
            {
                "created": len(sessions),
                "sessions": session_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


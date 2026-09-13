from datetime import date, datetime, timedelta

import django_filters
from django.db import transaction
from django.db.models import Count, Q
from django.utils.dateparse import parse_date
from django.utils import dateparse, timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.attendance.models import AttendanceRecord
from apps.attendance.serializers import AttendanceRecordSerializer
from apps.attendance.services import collapse_one_off_event_attendance
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
    CanEditOwnResource,
    IsSeniorCoordinator,
    IsAdmin,
)
from apps.people.models import ModuleCoordinator
from core.datetime_utils import church_calendar_date
from .models import Event, EventRoom, EventType
from .permissions import (
    CanApproveEventBooking,
    CanCreateOrUpdateEvent,
    CanManageEventRooms,
    apply_event_room_branch_scope,
    can_approve_event_booking,
)
from .serializers import EventRoomSerializer, EventSerializer, EventTypeSerializer
from .services.booking import (
    booking_status_for_update,
    initial_booking_status,
    mark_approved,
    mark_rejected,
)
from .services.conflicts import (
    validate_room_booking,
    validate_sunday_service_uniqueness,
)
from .services.recurrence import clean_recurrence_pattern


class EventFilter(django_filters.FilterSet):
    type = django_filters.CharFilter(field_name="event_type_id", lookup_expr="exact")
    booking_status = django_filters.CharFilter(field_name="booking_status")

    class Meta:
        model = Event
        fields = ["start_date", "booking_status"]


class EventTypeViewSet(viewsets.ModelViewSet):
    queryset = EventType.objects.annotate(event_count=Count("events")).order_by(
        "sort_order", "code"
    )
    serializer_class = EventTypeSerializer
    lookup_field = "code"
    permission_classes = [IsAuthenticatedAndNotVisitor]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        if self.action in ["create", "update", "partial_update"]:
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess("EVENTS", "write")]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_system:
            return Response(
                {"detail": "System event types cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.events.exists():
            return Response(
                {"detail": "Cannot delete an event type that is used by existing events."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.first_activity_people.exists():
            return Response(
                {
                    "detail": (
                        "Cannot delete an event type that is used as a person's "
                        "first activity attended."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class EventRoomViewSet(viewsets.ModelViewSet):
    queryset = EventRoom.objects.all()
    serializer_class = EventRoomSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["name", "notes"]
    filterset_fields = ["is_active"]

    def get_queryset(self):
        queryset = EventRoom.objects.select_related("branch").annotate(
            event_count=Count("events")
        )
        user = self.request.user
        branch_param = self.request.query_params.get("branch")
        return apply_event_room_branch_scope(queryset, user, branch_param)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticatedAndNotVisitor(), CanManageEventRooms()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def perform_create(self, serializer):
        user = self.request.user
        if not user.can_see_all_branches():
            serializer.save(branch_id=user.branch_id)
        else:
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.events.exists():
            return Response(
                {"detail": "Cannot delete a room that is used by existing events."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class EventViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = EventSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["title", "description"]
    filterset_class = EventFilter

    def get_queryset(self):
        queryset = (
            Event.objects.all()
            .order_by("start_date")
            .select_related("event_type", "branch", "room", "created_by", "updated_by")
            .prefetch_related(
                "attendance_records__person__clusters",
                "attendance_records__person__families",
                "attendance_records__person__clusters__members",
                "attendance_records__person",
                "attendance_records__journey",
            )
        )

        user = self.request.user

        queryset = queryset.exclude(booking_status=Event.BookingStatus.REJECTED)
        if not can_approve_event_booking(user):
            queryset = queryset.filter(
                Q(booking_status=Event.BookingStatus.APPROVED)
                | Q(
                    booking_status=Event.BookingStatus.PENDING,
                    created_by=user,
                )
            )

        if user.role in ["ADMIN", "PASTOR"]:
            pass
        elif user.is_module_coordinator(
            ModuleCoordinator.ModuleType.EVENTS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        ):
            pass
        elif user.is_senior_coordinator():
            pass
        elif user.role == "MEMBER":
            pass
        else:
            queryset = queryset.none()

        start_param = self.request.query_params.get("start") if self.request else None
        end_param = self.request.query_params.get("end") if self.request else None

        start_dt = self._parse_dt(start_param)
        end_dt = self._parse_dt(end_param)

        if start_dt:
            queryset = queryset.filter(end_date__gte=start_dt)
        if end_dt:
            queryset = queryset.filter(start_date__lte=end_dt)
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            booking_status=initial_booking_status(self.request.user),
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        old_date = church_calendar_date(instance.start_date)
        was_recurring = instance.is_recurring
        extra = {"updated_by": self.request.user}
        next_status = booking_status_for_update(
            self.request.user, instance, serializer.validated_data
        )
        if next_status:
            extra["booking_status"] = next_status
            extra["reviewed_by"] = None
            extra["reviewed_at"] = None
            extra["review_note"] = ""
        event = serializer.save(**extra)
        if was_recurring or event.is_recurring:
            return
        new_date = church_calendar_date(event.start_date)
        if old_date and new_date and old_date != new_date:
            collapse_one_off_event_attendance(event, new_date)

    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve", "attendance", "types"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        elif self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticatedAndNotVisitor(), CanCreateOrUpdateEvent()]
        elif self.action in ["approve", "reject"]:
            return [IsAuthenticatedAndNotVisitor(), CanApproveEventBooking()]
        elif self.action in [
            "add_attendance",
            "exclude_occurrence",
            "end_recurrence",
            "split_edit",
        ]:
            # Write operations: ADMIN, PASTOR, Events Coordinator, or Senior Coordinator (with restrictions)
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess("EVENTS", "write")]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user

        # Senior Coordinator can only edit/delete events they created
        if (
            self.action
            in [
                "update",
                "partial_update",
                "destroy",
                "exclude_occurrence",
                "end_recurrence",
                "split_edit",
            ]
            and user.is_senior_coordinator()
            and not user.is_module_coordinator(ModuleCoordinator.ModuleType.EVENTS)
        ):
            # Check if user created this event
            if hasattr(obj, "created_by") and obj.created_by != user:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You can only edit events you created.")

        return obj

    def _parse_dt(self, value):
        if not value:
            return None
        parsed = dateparse.parse_datetime(value)
        if parsed and timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def _parse_occurrence_date(self, date_value):
        """Parse an occurrence date from ISO datetime or YYYY-MM-DD.

        Returns (date, error_response). error_response is set when parsing fails.
        """
        if not date_value:
            return None, Response(
                {"date": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_dt = dateparse.parse_datetime(date_value)
        if parsed_dt is not None:
            if timezone.is_naive(parsed_dt):
                parsed_dt = timezone.make_aware(
                    parsed_dt, timezone.get_current_timezone()
                )
            return church_calendar_date(parsed_dt), None

        try:
            parsed_date = datetime.fromisoformat(date_value)
            return church_calendar_date(parsed_date), None
        except ValueError:
            try:
                parsed_date = datetime.strptime(date_value, "%Y-%m-%d")
                return parsed_date.date(), None
            except ValueError:
                return None, Response(
                    {"date": ["Invalid date format. Use ISO 8601."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

    def _recurrence_bounds(self, event):
        pattern = clean_recurrence_pattern(event.recurrence_pattern, event.start_date)
        start_date = church_calendar_date(event.start_date)
        through_date = date.fromisoformat(pattern["through"])
        return pattern, start_date, through_date

    def _date_out_of_range_response(self):
        return Response(
            {
                "date": [
                    "Date must fall between the event start date and recurrence end date."
                ]
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _exclude_target_date(self, event, target_date, user):
        pattern, start_date, through_date = self._recurrence_bounds(event)
        if target_date < start_date or target_date > through_date:
            return self._date_out_of_range_response()
        excluded = set(pattern.get("excluded_dates", []))
        excluded.add(target_date.isoformat())
        pattern["excluded_dates"] = sorted(excluded)
        event.recurrence_pattern = pattern
        event.updated_by = user
        event.save(update_fields=["recurrence_pattern", "updated_by", "updated_at"])
        return None

    def _end_series_before(self, event, target_date, user):
        pattern, start_date, through_date = self._recurrence_bounds(event)
        if target_date <= start_date:
            return Response(
                {
                    "date": [
                        "Cannot apply this to the first occurrence of the series."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target_date > through_date:
            return self._date_out_of_range_response()
        pattern["through"] = (target_date - timedelta(days=1)).isoformat()
        event.recurrence_pattern = clean_recurrence_pattern(pattern, event.start_date)
        event.updated_by = user
        event.save(update_fields=["recurrence_pattern", "updated_by", "updated_at"])
        return None

    def _move_attendance(
        self,
        source_event,
        dest_event,
        *,
        occurrence_date=None,
        occurrence_date_gte=None,
        new_occurrence_date=None,
    ):
        records = source_event.attendance_records.all()
        if occurrence_date is not None:
            records = records.filter(occurrence_date=occurrence_date)
        if occurrence_date_gte is not None:
            records = records.filter(occurrence_date__gte=occurrence_date_gte)
        updates = []
        for record in records:
            record.event = dest_event
            if new_occurrence_date is not None:
                record.occurrence_date = new_occurrence_date
            updates.append(record)
        if updates:
            AttendanceRecord.objects.bulk_update(
                updates, ["event", "occurrence_date"]
            )

    @action(detail=False, methods=["get"], url_path="types")
    def types(self, request):
        queryset = EventType.objects.annotate(event_count=Count("events")).order_by(
            "sort_order", "code"
        )
        serializer = EventTypeSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="attendance")
    def attendance(self, request, pk=None):
        event = self.get_object()
        occurrence_date_param = request.query_params.get("occurrence_date")
        records = event.attendance_records.select_related("person", "journey")
        if occurrence_date_param:
            parsed_date = parse_date(occurrence_date_param)
            if not parsed_date:
                return Response(
                    {"occurrence_date": ["Invalid date format. Use YYYY-MM-DD."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            records = records.filter(occurrence_date=parsed_date)

        serializer = AttendanceRecordSerializer(
            records, many=True, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @attendance.mapping.post
    def add_attendance(self, request, pk=None):
        event = self.get_object()
        payload = request.data.copy()
        payload["event_id"] = str(event.pk)

        serializer = AttendanceRecordSerializer(
            data=payload, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        status_code = (
            status.HTTP_201_CREATED if serializer.was_created else status.HTTP_200_OK
        )

        # Refresh event serializer context to surface updated counts
        event.refresh_from_db()
        event_serializer = self.get_serializer(event)
        response_payload = {
            "attendance_record": AttendanceRecordSerializer(
                record, context={"request": request}
            ).data,
            "event": event_serializer.data,
        }
        return Response(response_payload, status=status_code)

    @action(
        detail=True,
        methods=["delete"],
        url_path="attendance/(?P<attendance_id>[^/.]+)",
    )
    def remove_attendance(self, request, pk=None, attendance_id=None):
        event = self.get_object()
        try:
            record = event.attendance_records.get(pk=attendance_id)
        except AttendanceRecord.DoesNotExist:
            return Response(
                {"detail": "Attendance record not found for this event."},
                status=status.HTTP_404_NOT_FOUND,
            )
        record.delete()
        event.refresh_from_db()
        event_serializer = self.get_serializer(event)
        return Response({"event": event_serializer.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="exclude-occurrence")
    def exclude_occurrence(self, request, pk=None):
        event = self.get_object()

        if not event.is_recurring:
            return Response(
                {"detail": "Event is not recurring."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_date, error = self._parse_occurrence_date(request.data.get("date"))
        if error:
            return error

        range_error = self._exclude_target_date(event, target_date, request.user)
        if range_error:
            return range_error

        serializer = self.get_serializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="end-recurrence")
    def end_recurrence(self, request, pk=None):
        """Stop a series on the given date (that occurrence and later weeks)."""
        event = self.get_object()

        if not event.is_recurring:
            return Response(
                {"detail": "Event is not recurring."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_date, error = self._parse_occurrence_date(request.data.get("date"))
        if error:
            return error

        range_error = self._end_series_before(event, target_date, request.user)
        if range_error:
            return range_error

        serializer = self.get_serializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="split-edit")
    def split_edit(self, request, pk=None):
        """Apply an edit to one occurrence or this-and-following weeks."""
        event = self.get_object()

        if not event.is_recurring:
            return Response(
                {"detail": "Event is not recurring."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        scope = request.data.get("scope")
        if scope not in ("occurrence", "following"):
            return Response(
                {"scope": ["Must be 'occurrence' or 'following'."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_date, error = self._parse_occurrence_date(request.data.get("date"))
        if error:
            return error

        payload = {
            key: value
            for key, value in request.data.items()
            if key not in ("scope", "date")
        }
        if "branch" not in payload:
            payload["branch"] = event.branch_id
        if scope == "occurrence":
            payload["is_recurring"] = False
            payload["recurrence_pattern"] = None

        create_serializer = self.get_serializer(data=payload)
        create_serializer.context["schedule_ignore_event_id"] = event.pk
        if scope == "occurrence":
            create_serializer.context["schedule_ignore_dates"] = {
                target_date
            }
        else:
            create_serializer.context["schedule_ignore_dates_gte"] = (
                target_date
            )
        create_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if scope == "occurrence":
                range_error = self._exclude_target_date(
                    event, target_date, request.user
                )
            else:
                range_error = self._end_series_before(
                    event, target_date, request.user
                )
            if range_error:
                return range_error

            new_event = create_serializer.save(created_by=request.user)
            new_occurrence_date = church_calendar_date(new_event.start_date)
            if scope == "occurrence":
                self._move_attendance(
                    event,
                    new_event,
                    occurrence_date=target_date,
                    new_occurrence_date=new_occurrence_date,
                )
            else:
                self._move_attendance(
                    event,
                    new_event,
                    occurrence_date_gte=target_date,
                )

        event.refresh_from_db()
        return Response(
            {
                "event": self.get_serializer(event).data,
                "created_event": self.get_serializer(new_event).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def _recheck_schedule_conflicts(self, event):
        validate_sunday_service_uniqueness(
            event_type=event.event_type,
            start=event.start_date,
            end=event.end_date,
            is_recurring=event.is_recurring,
            recurrence_pattern=event.recurrence_pattern,
            branch=event.branch,
            exclude_event_id=event.pk,
        )
        validate_room_booking(
            room=event.room,
            start=event.start_date,
            end=event.end_date,
            is_recurring=event.is_recurring,
            recurrence_pattern=event.recurrence_pattern,
            exclude_event_id=event.pk,
        )

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        event = self.get_object()
        if event.booking_status != Event.BookingStatus.PENDING:
            return Response(
                {"detail": "Only pending bookings can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self._recheck_schedule_conflicts(event)
        mark_approved(
            event,
            request.user,
            note=request.data.get("review_note") or request.data.get("note") or "",
        )
        event.refresh_from_db()
        return Response(self.get_serializer(event).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        event = self.get_object()
        if event.booking_status != Event.BookingStatus.PENDING:
            return Response(
                {"detail": "Only pending bookings can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mark_rejected(
            event,
            request.user,
            note=request.data.get("review_note") or request.data.get("note") or "",
        )
        event.refresh_from_db()
        return Response(self.get_serializer(event).data)

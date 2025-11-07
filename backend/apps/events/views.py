from datetime import datetime

from django.utils import dateparse, timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from .models import Event
from .serializers import EventSerializer
from .services.recurrence import clean_weekly_pattern


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by("start_date")
    serializer_class = EventSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["title", "description"]
    filterset_fields = ["type", "start_date"]

    def _parse_dt(self, value):
        if not value:
            return None
        parsed = dateparse.parse_datetime(value)
        if parsed and timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def get_queryset(self):
        queryset = super().get_queryset()
        start_param = self.request.query_params.get("start") if self.request else None
        end_param = self.request.query_params.get("end") if self.request else None

        start_dt = self._parse_dt(start_param)
        end_dt = self._parse_dt(end_param)

        if start_dt:
            queryset = queryset.filter(end_date__gte=start_dt)
        if end_dt:
            queryset = queryset.filter(start_date__lte=end_dt)
        return queryset

    @action(detail=True, methods=["post"], url_path="exclude-occurrence")
    def exclude_occurrence(self, request, pk=None):
        event = self.get_object()

        if not event.is_recurring:
            return Response(
                {"detail": "Event is not recurring."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_value = request.data.get("date")
        if not date_value:
            return Response(
                {"date": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_dt = dateparse.parse_datetime(date_value)
        if parsed_dt is not None:
            if timezone.is_naive(parsed_dt):
                parsed_dt = timezone.make_aware(
                    parsed_dt, timezone.get_current_timezone()
                )
            target_date = parsed_dt.date()
        else:
            try:
                parsed_date = datetime.fromisoformat(date_value)
                target_date = parsed_date.date()
            except ValueError:
                try:
                    parsed_date = datetime.strptime(date_value, "%Y-%m-%d")
                    target_date = parsed_date.date()
                except ValueError:
                    return Response(
                        {"date": ["Invalid date format. Use ISO 8601."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        pattern = clean_weekly_pattern(event.recurrence_pattern, event.start_date)
        start_date = event.start_date.date()
        through_date = datetime.fromisoformat(pattern["through"]).date()

        if target_date < start_date or target_date > through_date:
            return Response(
                {
                    "date": [
                        "Date must fall between the event start date and recurrence end date."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        excluded = set(pattern.get("excluded_dates", []))
        excluded.add(target_date.isoformat())
        pattern["excluded_dates"] = sorted(excluded)
        event.recurrence_pattern = pattern
        event.save(update_fields=["recurrence_pattern"])

        serializer = self.get_serializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

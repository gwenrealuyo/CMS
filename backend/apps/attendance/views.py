from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.generics import get_object_or_404

from apps.events.models import Event
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
)

from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    queryset = AttendanceRecord.objects.select_related("event", "person", "milestone")
    serializer_class = AttendanceRecordSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["event", "person", "occurrence_date", "status"]

    def get_queryset(self):
        queryset = super().get_queryset()
        include_event = self.request.query_params.get("include_event", "").lower()
        if include_event in {"1", "true", "yes", "on"}:
            queryset = queryset.select_related("event")
        return queryset

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"], url_path="by-event/(?P<event_id>[^/.]+)")
    def by_event(self, request, event_id=None):
        event = get_object_or_404(Event.objects.all(), pk=event_id)
        occurrence_date_param = request.query_params.get("occurrence_date")
        queryset = event.attendance_records.select_related("person", "milestone")
        if occurrence_date_param:
            parsed = parse_date(occurrence_date_param)
            if parsed:
                queryset = queryset.filter(occurrence_date=parsed)
            else:
                return Response(
                    {"occurrence_date": ["Invalid date format. Use YYYY-MM-DD."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        serializer = self.get_serializer(
            queryset, many=True, context={"request": request}
        )
        return Response(serializer.data)

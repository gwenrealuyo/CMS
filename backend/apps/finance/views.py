from datetime import date
from typing import Optional

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from .models import Donation, Offering, Pledge, PledgeContribution
from .serializers import (
    DonationSerializer,
    OfferingSerializer,
    PledgeSerializer,
    PledgeContributionSerializer,
)
from .services import donation_stats, pledge_summaries, weekly_offering_totals


class RecordedByMixin:
    def _current_user_or_none(self):
        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            return user
        return None

    def perform_create(self, serializer):
        serializer.save(recorded_by=self._current_user_or_none())

class DonationViewSet(RecordedByMixin, viewsets.ModelViewSet):
    serializer_class = DonationSerializer

    def get_queryset(self):
        queryset = Donation.objects.all().order_by("-date", "-created_at")
        start = _parse_date(self.request.query_params.get("start"))
        end = _parse_date(self.request.query_params.get("end"))
        if start:
            queryset = queryset.filter(date__gte=start)
        if end:
            queryset = queryset.filter(date__lte=end)
        return queryset

    @action(detail=False, methods=["get"])
    def stats(self, request):
        start = _parse_date(request.query_params.get("start"))
        end = _parse_date(request.query_params.get("end"))
        stats = donation_stats(start=start, end=end)
        return Response(stats, status=status.HTTP_200_OK)


class OfferingViewSet(RecordedByMixin, viewsets.ModelViewSet):
    serializer_class = OfferingSerializer

    def get_queryset(self):
        queryset = Offering.objects.all().order_by("-service_date", "-created_at")
        start = _parse_date(self.request.query_params.get("start"))
        end = _parse_date(self.request.query_params.get("end"))
        if start:
            queryset = queryset.filter(service_date__gte=start)
        if end:
            queryset = queryset.filter(service_date__lte=end)
        return queryset

    @action(detail=False, methods=["get"])
    def weekly_summary(self, request):
        start = _parse_date(request.query_params.get("start"))
        end = _parse_date(request.query_params.get("end"))
        summary = weekly_offering_totals(start=start, end=end)
        return Response(summary, status=status.HTTP_200_OK)


class PledgeViewSet(RecordedByMixin, viewsets.ModelViewSet):
    queryset = (
        Pledge.objects.all()
        .prefetch_related("contributions", "contributions__recorded_by")
        .order_by("status", "target_date", "pledge_title")
    )
    serializer_class = PledgeSerializer

    def perform_create(self, serializer):
        pledge = serializer.save(recorded_by=self._current_user_or_none())
        
        # If amount_received is set, create an initial contribution
        # representing pre-existing contributions before system implementation
        if pledge.amount_received and pledge.amount_received > 0:
            PledgeContribution.objects.create(
                pledge=pledge,
                amount=pledge.amount_received,
                contribution_date=pledge.start_date,
                note="Initial contribution (pre-existing contributions before system implementation)",
                recorded_by=self._current_user_or_none()
            )
            # Refresh to recalculate from contributions
            pledge.refresh_amount_received()
        
        return pledge

    @action(detail=False, methods=["get"])
    def summary(self, request):
        statuses = request.query_params.getlist("status") or None
        summary = pledge_summaries(statuses)
        return Response(summary, status=status.HTTP_200_OK)


class PledgeContributionViewSet(RecordedByMixin, viewsets.ModelViewSet):
    serializer_class = PledgeContributionSerializer
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = (
            PledgeContribution.objects.select_related("pledge", "recorded_by", "contributor")
            .order_by("-contribution_date", "-created_at")
        )
        pledge_id = self.request.query_params.get("pledge")
        if pledge_id:
            queryset = queryset.filter(pledge_id=pledge_id)
        start = _parse_date(self.request.query_params.get("start"))
        end = _parse_date(self.request.query_params.get("end"))
        if start:
            queryset = queryset.filter(contribution_date__gte=start)
        if end:
            queryset = queryset.filter(contribution_date__lte=end)
        return queryset

    def perform_create(self, serializer):
        pledge_id = self.request.data.get("pledge")
        if not pledge_id:
            raise ValidationError({"pledge": "This field is required."})
        pledge = get_object_or_404(Pledge, pk=pledge_id)
        contribution = serializer.save(pledge=pledge, recorded_by=self._current_user_or_none())
        pledge.refresh_amount_received()
        return contribution

    def perform_update(self, serializer):
        contribution = serializer.save()
        # Refresh the parent pledge's totals after update
        contribution.pledge.refresh_amount_received()
        return contribution

    def perform_destroy(self, instance):
        pledge = instance.pledge
        super().perform_destroy(instance)
        pledge.refresh_amount_received()

def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None

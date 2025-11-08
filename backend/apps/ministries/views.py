from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from .models import Ministry, MinistryMember
from .serializers import MinistryMemberSerializer, MinistrySerializer


class MinistryViewSet(viewsets.ModelViewSet):
    queryset = (
        Ministry.objects.select_related("primary_coordinator")
        .prefetch_related("support_coordinators", "memberships__member")
        .all()
    )
    serializer_class = MinistrySerializer
    permission_classes = (IsAuthenticatedOrReadOnly,)
    filter_backends = (
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    filterset_fields = ("activity_cadence", "category", "is_active")
    search_fields = (
        "name",
        "description",
        "primary_coordinator__first_name",
        "primary_coordinator__last_name",
    )
    ordering_fields = ("name", "activity_cadence", "created_at")
    ordering = ("name",)


class MinistryMemberViewSet(viewsets.ModelViewSet):
    queryset = (
        MinistryMember.objects.select_related("ministry", "member")
        .prefetch_related("ministry__support_coordinators")
        .all()
    )
    serializer_class = MinistryMemberSerializer
    permission_classes = (IsAuthenticatedOrReadOnly,)
    filter_backends = (DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter)
    filterset_fields = ("ministry", "role", "is_active")
    search_fields = ("ministry__name", "member__first_name", "member__last_name")
    ordering_fields = ("join_date", "role")
    ordering = ("ministry__name", "member__first_name")

    def perform_create(self, serializer):
        serializer.save()

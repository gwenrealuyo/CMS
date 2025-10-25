from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count, Q
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Person, Family, Cluster, Milestone, ClusterWeeklyReport
from .serializers import (
    PersonSerializer,
    FamilySerializer,
    ClusterSerializer,
    MilestoneSerializer,
    ClusterWeeklyReportSerializer,
)
from rest_framework.permissions import IsAuthenticated


class PersonViewSet(viewsets.ModelViewSet):
    queryset = Person.objects.all()
    serializer_class = PersonSerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["username", "email", "first_name", "last_name"]
    filterset_fields = ["role"]


class FamilyViewSet(viewsets.ModelViewSet):
    queryset = Family.objects.all()
    serializer_class = FamilySerializer
    # permission_classes = [IsAuthenticated]


class ClusterViewSet(viewsets.ModelViewSet):
    queryset = Cluster.objects.all()
    serializer_class = ClusterSerializer
    # permission_classes = [IsAuthenticated]


class MilestoneViewSet(viewsets.ModelViewSet):
    queryset = Milestone.objects.all()
    serializer_class = MilestoneSerializer
    # permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["user", "type"]


class ClusterWeeklyReportViewSet(viewsets.ModelViewSet):
    queryset = ClusterWeeklyReport.objects.all()
    serializer_class = ClusterWeeklyReportSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        "cluster",
        "year",
        "week_number",
        "gathering_type",
        "submitted_by",
    ]

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Generate analytics from cluster weekly reports"""
        cluster_id = request.query_params.get("cluster")
        year = request.query_params.get("year")

        queryset = self.get_queryset()

        if cluster_id:
            queryset = queryset.filter(cluster_id=cluster_id)
        if year:
            queryset = queryset.filter(year=year)

        analytics_data = {
            "total_reports": queryset.count(),
            "total_attendance": queryset.aggregate(
                members=Sum("members_present"), visitors=Sum("visitors_present")
            ),
            "average_attendance": queryset.aggregate(
                avg_members=Avg("members_present"), avg_visitors=Avg("visitors_present")
            ),
            "total_offerings": queryset.aggregate(total=Sum("offerings"))["total"] or 0,
            "gathering_type_distribution": queryset.values("gathering_type").annotate(
                count=Count("id")
            ),
        }

        return Response(analytics_data)

    @action(detail=False, methods=["get"])
    def overdue(self, request):
        """Get clusters with overdue reports for current week"""
        # Get current year and week number
        today = timezone.now().date()
        current_year = today.year
        current_week = today.isocalendar()[1]  # ISO week number

        # Get all active clusters
        all_clusters = Cluster.objects.all()

        # Get clusters that have submitted for current week
        submitted_cluster_ids = ClusterWeeklyReport.objects.filter(
            year=current_year, week_number=current_week
        ).values_list("cluster_id", flat=True)

        # Clusters without submission
        overdue_clusters = all_clusters.exclude(id__in=submitted_cluster_ids)

        return Response(
            {
                "current_year": current_year,
                "current_week": current_week,
                "overdue_count": overdue_clusters.count(),
                "overdue_clusters": ClusterSerializer(overdue_clusters, many=True).data,
            }
        )

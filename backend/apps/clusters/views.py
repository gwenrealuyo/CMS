from rest_framework import viewsets, filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count, Q
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Cluster, ClusterWeeklyReport
from .serializers import (
    ClusterSerializer,
    ClusterWeeklyReportSerializer,
)
from apps.authentication.permissions import (
    IsCoordinatorOrAbove,
    IsAuthenticatedAndNotVisitor,
    IsModuleCoordinator,
    IsSeniorCoordinator,
    CanEditOwnResource,
    HasModuleAccess,
)
from apps.people.models import ModuleCoordinator


class ClusterViewSet(viewsets.ModelViewSet):
    queryset = Cluster.objects.all()
    serializer_class = ClusterSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'code', 'location']
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # ADMIN/PASTOR: All clusters
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Senior Coordinator (CLUSTER, SENIOR_COORDINATOR): All clusters
        if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
            return queryset
        
        # Cluster Coordinator (CLUSTER, COORDINATOR, resource_id): Only their assigned cluster
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR
        )
        if coordinator_assignments.exists():
            cluster_ids = [
                assignment.resource_id 
                for assignment in coordinator_assignments 
                if assignment.resource_id
            ]
            # Also check if user is coordinator of any cluster
            coordinator_clusters = queryset.filter(coordinator=user)
            if cluster_ids:
                assigned_clusters = queryset.filter(id__in=cluster_ids)
                return (coordinator_clusters | assigned_clusters).distinct()
            return coordinator_clusters
        
        # MEMBER: Only clusters where they are members
        if user.role == "MEMBER":
            return queryset.filter(members=user).distinct()
        
        # Default: empty queryset for safety
        return queryset.none()
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action == 'create':
            # Only ADMIN, PASTOR, or Senior Coordinator can create
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'create')]
        elif self.action in ['update', 'partial_update']:
            # ADMIN, PASTOR, Senior Coordinator, or cluster coordinator can update
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'write')]
        elif self.action == 'destroy':
            # Only ADMIN, PASTOR can delete
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'delete')]
        else:
            # Read operations
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'read')]


class ClusterWeeklyReportPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


class ClusterWeeklyReportViewSet(viewsets.ModelViewSet):
    queryset = ClusterWeeklyReport.objects.all()
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = ClusterWeeklyReportSerializer
    pagination_class = ClusterWeeklyReportPagination
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        "cluster",
        "year",
        "week_number",
        "gathering_type",
        "submitted_by",
    ]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        # Apply month filter if provided
        month = self.request.query_params.get("month")
        if month:
            try:
                month_int = int(month)
                if 1 <= month_int <= 12:
                    queryset = queryset.filter(meeting_date__month=month_int)
            except ValueError:
                pass
        
        # ADMIN/PASTOR: All reports
        if user.role in ["ADMIN", "PASTOR"]:
            return queryset
        
        # Senior Coordinator: All reports
        if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
            return queryset
        
        # Cluster Coordinator: Only reports for their cluster
        coordinator_assignments = user.module_coordinator_assignments.filter(
            module=ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR
        )
        if coordinator_assignments.exists():
            cluster_ids = [
                assignment.resource_id 
                for assignment in coordinator_assignments 
                if assignment.resource_id
            ]
            # Also check clusters where user is coordinator
            coordinator_clusters = Cluster.objects.filter(coordinator=user)
            if cluster_ids:
                assigned_clusters = Cluster.objects.filter(id__in=cluster_ids)
                all_clusters = (coordinator_clusters | assigned_clusters).distinct()
            else:
                all_clusters = coordinator_clusters
            return queryset.filter(cluster__in=all_clusters)
        
        # MEMBER: Read-only, only reports for clusters they're in
        if user.role == "MEMBER":
            member_clusters = Cluster.objects.filter(members=user)
            return queryset.filter(cluster__in=member_clusters)
        
        # Default: empty queryset for safety
        return queryset.none()
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action == 'create':
            # ADMIN, PASTOR, Senior Coordinator, or Cluster Coordinator can create
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'create')]
        elif self.action in ['update', 'partial_update']:
            # ADMIN, PASTOR, Senior Coordinator, or Cluster Coordinator can update
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'write')]
        elif self.action == 'destroy':
            # Only ADMIN, PASTOR can delete
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'delete')]
        else:
            # Read operations
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('CLUSTER', 'read')]

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Generate analytics from cluster weekly reports"""
        # get_queryset() already applies filters from filterset_fields (cluster, year, gathering_type)
        # and the month filter from get_queryset() override
        queryset = self.get_queryset()

        # Calculate total attendance by counting ManyToMany relationships
        total_members = sum(report.members_attended.count() for report in queryset)
        total_visitors = sum(report.visitors_attended.count() for report in queryset)

        # Calculate average attendance
        report_count = queryset.count()
        avg_members = total_members / report_count if report_count > 0 else 0
        avg_visitors = total_visitors / report_count if report_count > 0 else 0

        analytics_data = {
            "total_reports": report_count,
            "total_attendance": {
                "members": total_members,
                "visitors": total_visitors,
            },
            "average_attendance": {
                "avg_members": round(avg_members, 2),
                "avg_visitors": round(avg_visitors, 2),
            },
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

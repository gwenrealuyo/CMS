from rest_framework import viewsets, filters, status
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Avg, Count, Q
from django.http import HttpResponse
from datetime import datetime, timedelta
from django.utils import timezone
import csv
import io
from .models import Cluster, ClusterWeeklyReport, ClusterComplianceNote
from .serializers import (
    ClusterSerializer,
    ClusterWeeklyReportSerializer,
    ClusterComplianceSerializer,
    ComplianceSummarySerializer,
    ClusterComplianceNoteSerializer,
)
from .utils import (
    calculate_cluster_compliance,
    calculate_trend,
    is_at_risk,
    get_weeks_in_range,
)
from apps.authentication.permissions import (
    IsCoordinatorOrAbove,
    IsAuthenticatedAndNotVisitor,
    IsModuleCoordinator,
    IsSeniorCoordinator,
    CanEditOwnResource,
    HasModuleAccess,
)
from apps.people.models import ModuleCoordinator, Person


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

    def _check_compliance_access(self, user):
        """Check if user has access to compliance features"""
        if user.role in ["ADMIN", "PASTOR"]:
            return True
        if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
            return True
        return False

    @action(detail=False, methods=["get"])
    def compliance(self, request):
        """
        Get compliance data for all clusters.
        Accessible to ADMIN, PASTOR, and Senior Coordinators only.
        
        Query params:
        - start_date (YYYY-MM-DD): Start of compliance period (default: 4 weeks ago)
        - end_date (YYYY-MM-DD): End of compliance period (default: today)
        - branch_id: Filter by branch
        - coordinator_id: Filter by coordinator
        - status: Filter by compliance status (COMPLIANT, NON_COMPLIANT, PARTIAL)
        - min_compliance_rate: Minimum compliance rate threshold (0-100)
        """
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to access compliance data."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Parse date range (default: last 4 weeks)
        today = timezone.now().date()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid start_date format. Use YYYY-MM-DD."}, status=400)
        else:
            start_date = today - timedelta(weeks=4)
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid end_date format. Use YYYY-MM-DD."}, status=400)
        else:
            end_date = today
        
        # Get clusters with filters
        clusters = Cluster.objects.all()
        
        branch_id = request.query_params.get('branch_id')
        if branch_id:
            try:
                clusters = clusters.filter(branch_id=int(branch_id))
            except ValueError:
                pass
        
        coordinator_id = request.query_params.get('coordinator_id')
        if coordinator_id:
            try:
                clusters = clusters.filter(coordinator_id=int(coordinator_id))
            except ValueError:
                pass
        
        # Calculate compliance for each cluster
        compliance_data = []
        for cluster in clusters:
            cluster_compliance = calculate_cluster_compliance(cluster, start_date, end_date)
            
            # Calculate trend (compare with previous period)
            previous_start = start_date - timedelta(days=(end_date - start_date).days + 1)
            previous_end = start_date - timedelta(days=1)
            previous_compliance = calculate_cluster_compliance(cluster, previous_start, previous_end)
            trend = calculate_trend(cluster_compliance, previous_compliance)
            
            # Get compliance notes for this period
            notes = ClusterComplianceNote.objects.filter(
                cluster=cluster,
                period_start__lte=end_date,
                period_end__gte=start_date
            ).select_related('created_by').order_by('-created_at')
            
            compliance_data.append({
                "cluster": cluster,
                "status": cluster_compliance["status"],
                "reports_submitted": cluster_compliance["reports_submitted"],
                "reports_expected": cluster_compliance["reports_expected"],
                "compliance_rate": cluster_compliance["compliance_rate"],
                "missing_weeks": cluster_compliance["missing_weeks"],
                "last_report_date": cluster_compliance["last_report_date"],
                "days_since_last_report": cluster_compliance["days_since_last_report"],
                "consecutive_missing_weeks": cluster_compliance["consecutive_missing_weeks"],
                "trend": trend,
                "compliance_notes": notes,
            })
        
        # Apply status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            compliance_data = [d for d in compliance_data if d["status"] == status_filter]
        
        # Apply min compliance rate filter
        min_rate = request.query_params.get('min_compliance_rate')
        if min_rate:
            try:
                min_rate_float = float(min_rate)
                compliance_data = [d for d in compliance_data if d["compliance_rate"] >= min_rate_float]
            except ValueError:
                pass
        
        # Calculate summary
        total_clusters = len(compliance_data)
        compliant_count = sum(1 for d in compliance_data if d["status"] == "COMPLIANT")
        non_compliant_count = sum(1 for d in compliance_data if d["status"] == "NON_COMPLIANT")
        partial_count = sum(1 for d in compliance_data if d["status"] == "PARTIAL")
        
        overall_compliance_rate = (
            sum(d["compliance_rate"] for d in compliance_data) / total_clusters
            if total_clusters > 0 else 0.0
        )
        
        weeks_expected = len(get_weeks_in_range(start_date, end_date))
        
        summary = {
            "total_clusters": total_clusters,
            "compliant_clusters": compliant_count,
            "non_compliant_clusters": non_compliant_count,
            "partial_compliant_clusters": partial_count,
            "compliance_rate": round(overall_compliance_rate, 2),
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "weeks_expected": weeks_expected,
            }
        }
        
        # Group by status
        by_status = {
            "compliant": [d for d in compliance_data if d["status"] == "COMPLIANT"],
            "non_compliant": [d for d in compliance_data if d["status"] == "NON_COMPLIANT"],
            "partial": [d for d in compliance_data if d["status"] == "PARTIAL"],
        }
        
        # Serialize data
        serializer = ClusterComplianceSerializer(compliance_data, many=True)
        
        # Serialize by_status groups
        compliant_serialized = ClusterComplianceSerializer(by_status["compliant"], many=True).data
        non_compliant_serialized = ClusterComplianceSerializer(by_status["non_compliant"], many=True).data
        partial_serialized = ClusterComplianceSerializer(by_status["partial"], many=True).data
        
        return Response({
            "summary": summary,
            "clusters": serializer.data,
            "by_status": {
                "compliant": compliant_serialized,
                "non_compliant": non_compliant_serialized,
                "partial": partial_serialized,
            }
        })

    @action(detail=False, methods=["get"])
    def at_risk(self, request):
        """
        Get clusters that are at risk of non-compliance.
        Criteria:
        - 2+ consecutive weeks without reports
        - No reports in last 2-3 weeks
        - Declining compliance trend
        
        Query params:
        - weeks_back: Number of weeks to check (default: 4)
        """
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to access at-risk clusters data."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        weeks_back = int(request.query_params.get('weeks_back', 4))
        today = timezone.now().date()
        start_date = today - timedelta(weeks=weeks_back)
        end_date = today
        
        # Get all clusters
        clusters = Cluster.objects.all()
        
        at_risk_clusters = []
        for cluster in clusters:
            compliance = calculate_cluster_compliance(cluster, start_date, end_date)
            
            # Calculate trend
            previous_start = start_date - timedelta(days=(end_date - start_date).days + 1)
            previous_end = start_date - timedelta(days=1)
            previous_compliance = calculate_cluster_compliance(cluster, previous_start, previous_end)
            trend = calculate_trend(compliance, previous_compliance)
            compliance["trend"] = trend
            
            # Check if at risk
            is_risk, reason = is_at_risk(compliance, weeks_back)
            if is_risk:
                at_risk_clusters.append({
                    "cluster": cluster,
                    "compliance": compliance,
                    "risk_reason": reason,
                })
        
        # Serialize
        result = []
        for item in at_risk_clusters:
            cluster_data = ClusterSerializer(item["cluster"]).data
            compliance_data = ClusterComplianceSerializer([{
                "cluster": item["cluster"],
                **item["compliance"]
            }], many=True).data[0]
            
            result.append({
                "cluster": cluster_data,
                "compliance": compliance_data,
                "risk_reason": item["risk_reason"],
            })
        
        return Response(result)

    @action(detail=False, methods=["get"])
    def compliance_history(self, request):
        """
        Get historical compliance data for trend analysis.
        
        Query params:
        - months: Number of months to look back (default: 3)
        - cluster_id: Specific cluster (optional)
        - coordinator_id: Specific coordinator (optional)
        - group_by: "week" | "month" (default: "week")
        """
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to access compliance history."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        months = int(request.query_params.get('months', 3))
        group_by = request.query_params.get('group_by', 'week')
        
        today = timezone.now().date()
        start_date = today - timedelta(days=months * 30)
        end_date = today
        
        # Get clusters to analyze
        clusters = Cluster.objects.all()
        
        cluster_id = request.query_params.get('cluster_id')
        if cluster_id:
            try:
                clusters = clusters.filter(id=int(cluster_id))
            except ValueError:
                pass
        
        coordinator_id = request.query_params.get('coordinator_id')
        if coordinator_id:
            try:
                clusters = clusters.filter(coordinator_id=int(coordinator_id))
            except ValueError:
                pass
        
        if group_by == 'week':
            # Group by week
            weeks = get_weeks_in_range(start_date, end_date)
            history_data = []
            
            for year, week in weeks:
                # Get week start and end dates
                week_start = datetime.strptime(f"{year}-W{week:02d}-1", "%Y-W%W-%w").date()
                week_end = week_start + timedelta(days=6)
                
                # Calculate compliance for this week
                total_expected = clusters.count()
                total_submitted = ClusterWeeklyReport.objects.filter(
                    cluster__in=clusters,
                    year=year,
                    week_number=week,
                    meeting_date__gte=week_start,
                    meeting_date__lte=week_end
                ).count()
                
                compliance_rate = (total_submitted / total_expected * 100) if total_expected > 0 else 0.0
                
                history_data.append({
                    "period": f"{year}-W{week:02d}",
                    "compliance_rate": round(compliance_rate, 2),
                    "reports_expected": total_expected,
                    "reports_submitted": total_submitted,
                })
        else:
            # Group by month
            history_data = []
            current = start_date.replace(day=1)
            
            while current <= end_date:
                month_start = current
                if current.month == 12:
                    month_end = current.replace(day=31)
                    next_month = current.replace(year=current.year + 1, month=1, day=1)
                else:
                    next_month = current.replace(month=current.month + 1, day=1)
                    month_end = next_month - timedelta(days=1)
                
                # Calculate compliance for this month
                total_expected = clusters.count() * 4  # Approx 4 weeks per month
                total_submitted = ClusterWeeklyReport.objects.filter(
                    cluster__in=clusters,
                    meeting_date__gte=month_start,
                    meeting_date__lte=month_end
                ).count()
                
                compliance_rate = (total_submitted / total_expected * 100) if total_expected > 0 else 0.0
                
                history_data.append({
                    "period": f"{current.year}-{current.month:02d}",
                    "compliance_rate": round(compliance_rate, 2),
                    "reports_expected": total_expected,
                    "reports_submitted": total_submitted,
                })
                
                current = next_month
        
        return Response({
            "data": history_data,
            "group_by": group_by,
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        })

    @action(detail=False, methods=["post"])
    def add_compliance_note(self, request):
        """
        Add a compliance note for a cluster.
        Required fields: cluster_id, note, period_start, period_end
        """
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to add compliance notes."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        cluster_id = request.data.get('cluster_id')
        note_text = request.data.get('note')
        period_start_str = request.data.get('period_start')
        period_end_str = request.data.get('period_end')
        
        if not all([cluster_id, note_text, period_start_str, period_end_str]):
            return Response(
                {"error": "Missing required fields: cluster_id, note, period_start, period_end"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            cluster = Cluster.objects.get(id=cluster_id)
            period_start = datetime.strptime(period_start_str, '%Y-%m-%d').date()
            period_end = datetime.strptime(period_end_str, '%Y-%m-%d').date()
        except (Cluster.DoesNotExist, ValueError) as e:
            return Response(
                {"error": f"Invalid data: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compliance_note = ClusterComplianceNote.objects.create(
            cluster=cluster,
            note=note_text,
            period_start=period_start,
            period_end=period_end,
            created_by=request.user
        )
        
        serializer = ClusterComplianceNoteSerializer(compliance_note)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def compliance_notes(self, request):
        """
        Get compliance notes for clusters.
        Query params:
        - cluster_id: Filter by specific cluster
        - start_date: Notes for periods starting after this date
        - end_date: Notes for periods ending before this date
        """
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to view compliance notes."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        notes = ClusterComplianceNote.objects.all().select_related('cluster', 'created_by')
        
        cluster_id = request.query_params.get('cluster_id')
        if cluster_id:
            try:
                notes = notes.filter(cluster_id=int(cluster_id))
            except ValueError:
                pass
        
        start_date_str = request.query_params.get('start_date')
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                notes = notes.filter(period_start__gte=start_date)
            except ValueError:
                pass
        
        end_date_str = request.query_params.get('end_date')
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                notes = notes.filter(period_end__lte=end_date)
            except ValueError:
                pass
        
        serializer = ClusterComplianceNoteSerializer(notes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def compliance_export_csv(self, request):
        """Export compliance data as CSV"""
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to export compliance data."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get compliance data (reuse compliance endpoint logic)
        response = self.compliance(request)
        if response.status_code != 200:
            return response
        
        compliance_data = response.data
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Cluster Code', 'Cluster Name', 'Coordinator', 'Status',
            'Reports Submitted', 'Reports Expected', 'Compliance Rate (%)',
            'Missing Weeks', 'Last Report Date', 'Days Since Last Report',
            'Consecutive Missing Weeks', 'Trend'
        ])
        
        # Write data
        for cluster_data in compliance_data['clusters']:
            cluster = cluster_data['cluster']
            writer.writerow([
                cluster.get('code', ''),
                cluster.get('name', ''),
                f"{cluster.get('coordinator', {}).get('first_name', '')} {cluster.get('coordinator', {}).get('last_name', '')}".strip() if cluster.get('coordinator') else '',
                cluster_data['status'],
                cluster_data['reports_submitted'],
                cluster_data['reports_expected'],
                cluster_data['compliance_rate'],
                ', '.join(map(str, cluster_data['missing_weeks'])),
                cluster_data['last_report_date'] or '',
                cluster_data['days_since_last_report'] or '',
                cluster_data['consecutive_missing_weeks'],
                cluster_data['trend'],
            ])
        
        # Create HTTP response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="cluster_compliance.csv"'
        return response

    @action(detail=False, methods=["get"])
    def compliance_export_pdf(self, request):
        """Export compliance data as PDF"""
        # Check permissions
        if not self._check_compliance_access(request.user):
            return Response(
                {"error": "You do not have permission to export compliance data."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For now, return CSV (PDF generation can be added later with reportlab/weasyprint)
        # This is a placeholder - you may want to implement proper PDF generation
        return Response(
            {"error": "PDF export not yet implemented. Use CSV export instead."},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )


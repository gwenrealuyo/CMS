from datetime import datetime, timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance.models import AttendanceRecord
from apps.clusters.models import Cluster, ClusterComplianceNote, ClusterWeeklyReport
from apps.clusters.serializers import ClusterComplianceNoteSerializer
from apps.evangelism.models import EvangelismWeeklyReport
from apps.lessons.models import PersonLessonProgress
from apps.people.models import Branch, Person

from . import services
from .permissions import IsReportsViewer
from .scoping import apply_branch_filter, resolve_branch_scope


def _parse_date(value):
    """Parse a YYYY-MM-DD string, returning (date, error_response)."""
    if not value:
        return None, None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date(), None
    except ValueError:
        return None, Response(
            {"error": "Invalid date format. Use YYYY-MM-DD."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )


def _scoped_clusters(request):
    """Cluster queryset limited to the user's branch scope."""
    return apply_branch_filter(
        Cluster.objects.all(),
        request.user,
        request,
        branch_lookup="branch_id",
    )


def _scoped_people(request):
    """Person queryset limited to the user's branch scope (ADMIN excluded)."""
    return apply_branch_filter(
        Person.objects.exclude(role="ADMIN"),
        request.user,
        request,
        branch_lookup="branch_id",
    )


def _scoped_cluster_reports(request):
    return apply_branch_filter(
        ClusterWeeklyReport.objects.all(),
        request.user,
        request,
        branch_lookup="cluster__branch_id",
    )


def _scoped_evangelism_reports(request):
    return apply_branch_filter(
        EvangelismWeeklyReport.objects.all(),
        request.user,
        request,
        branch_lookup="evangelism_group__cluster__branch_id",
    )


def _scoped_service_attendance(request):
    return apply_branch_filter(
        AttendanceRecord.objects.filter(
            event__event_type_id="SUNDAY_SERVICE",
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        ),
        request.user,
        request,
        branch_lookup="event__branch_id",
    )


def _scoped_lesson_progress(request):
    return apply_branch_filter(
        PersonLessonProgress.objects.select_related("person", "lesson"),
        request.user,
        request,
        branch_lookup="person__branch_id",
    )


def _parse_year_param(request, *, use_current_year_default: bool = True):
    year_param = request.query_params.get("year")
    if not year_param:
        if use_current_year_default:
            return timezone.now().year, None
        return None, None
    try:
        year = int(year_param)
    except (TypeError, ValueError):
        return None, Response(
            {"error": "year must be a valid integer."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    if year < 1900 or year > 3000:
        return None, Response(
            {"error": "year must be between 1900 and 3000."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    return year, None


def _parse_month_param(request):
    month_param = request.query_params.get("month")
    if not month_param:
        return None, None
    try:
        month = int(month_param)
    except (TypeError, ValueError):
        return None, Response(
            {"error": "month must be a valid integer."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    if not 1 <= month <= 12:
        return None, Response(
            {"error": "month must be between 1 and 12."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    return month, None


class ReportsMetaView(APIView):
    """Returns the current user's reporting scope.

    The frontend uses this as the single source of truth for branch scoping
    (which branches are selectable and whether the selector is locked), so it
    does not need to re-derive headquarters/role logic on the client.
    """

    permission_classes = [IsReportsViewer]

    def get(self, request):
        user = request.user
        scope = resolve_branch_scope(user, request)

        if scope["can_pick"]:
            branch_rows = Branch.objects.filter(is_active=True).values("id", "name")
        elif user.branch_id:
            branch_rows = Branch.objects.filter(id=user.branch_id).values("id", "name")
        else:
            branch_rows = []

        return Response(
            {
                "role": user.role,
                "can_pick_branch": scope["can_pick"],
                "branch_locked": scope["locked"],
                "effective_branch_id": scope["effective_branch_id"],
                "branches": list(branch_rows),
            }
        )


class ComplianceView(APIView):
    """Cluster compliance summary + table, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        today = timezone.now().date()

        start_date, err = _parse_date(request.query_params.get("start_date"))
        if err:
            return err
        end_date, err = _parse_date(request.query_params.get("end_date"))
        if err:
            return err
        if start_date is None:
            start_date = today - timedelta(weeks=4)
        if end_date is None:
            end_date = today

        clusters = _scoped_clusters(request)

        coordinator_id = request.query_params.get("coordinator_id")
        if coordinator_id:
            try:
                clusters = clusters.filter(coordinator_id=int(coordinator_id))
            except ValueError:
                pass

        status_filter = request.query_params.get("status") or None

        min_rate = None
        min_rate_param = request.query_params.get("min_compliance_rate")
        if min_rate_param:
            try:
                min_rate = float(min_rate_param)
            except ValueError:
                min_rate = None

        payload = services.build_compliance_payload(
            clusters,
            start_date,
            end_date,
            status=status_filter,
            min_rate=min_rate,
        )
        return Response(payload)


class ComplianceOverdueView(APIView):
    """Clusters with no report for the current ISO week, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        return Response(services.build_overdue(_scoped_clusters(request)))


class ComplianceAtRiskView(APIView):
    """Clusters at risk of non-compliance, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            weeks_back = int(request.query_params.get("weeks_back", 4))
        except (TypeError, ValueError):
            weeks_back = 4
        return Response(
            services.build_at_risk(_scoped_clusters(request), weeks_back)
        )


class ComplianceHistoryView(APIView):
    """Historical compliance trend series, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 3))
        except (TypeError, ValueError):
            months = 3
        group_by = request.query_params.get("group_by", "week")
        if group_by not in ("week", "month"):
            group_by = "week"

        clusters = _scoped_clusters(request)

        cluster_id = request.query_params.get("cluster_id")
        if cluster_id:
            try:
                clusters = clusters.filter(id=int(cluster_id))
            except ValueError:
                pass

        coordinator_id = request.query_params.get("coordinator_id")
        if coordinator_id:
            try:
                clusters = clusters.filter(coordinator_id=int(coordinator_id))
            except ValueError:
                pass

        return Response(
            services.build_compliance_history(clusters, months, group_by)
        )


class ComplianceNotesView(APIView):
    """List or create compliance notes, scoped to in-branch clusters."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        clusters = _scoped_clusters(request)

        cluster_id = request.query_params.get("cluster_id")
        cluster_id_int = None
        if cluster_id:
            try:
                cluster_id_int = int(cluster_id)
            except ValueError:
                cluster_id_int = None

        start_date, err = _parse_date(request.query_params.get("start_date"))
        if err:
            return err
        end_date, err = _parse_date(request.query_params.get("end_date"))
        if err:
            return err

        return Response(
            services.build_compliance_notes(
                clusters,
                cluster_id=cluster_id_int,
                start_date=start_date,
                end_date=end_date,
            )
        )

    def post(self, request):
        cluster_id = request.data.get("cluster_id")
        note_text = request.data.get("note")
        period_start_str = request.data.get("period_start")
        period_end_str = request.data.get("period_end")

        if not all([cluster_id, note_text, period_start_str, period_end_str]):
            return Response(
                {
                    "error": "Missing required fields: cluster_id, note, "
                    "period_start, period_end"
                },
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        period_start, err = _parse_date(period_start_str)
        if err:
            return err
        period_end, err = _parse_date(period_end_str)
        if err:
            return err

        # Only allow notes on clusters within the user's branch scope.
        clusters = _scoped_clusters(request)
        try:
            cluster = clusters.get(id=int(cluster_id))
        except (ValueError, Cluster.DoesNotExist):
            return Response(
                {"error": "Cluster not found in your scope."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        note = ClusterComplianceNote.objects.create(
            cluster=cluster,
            note=note_text,
            period_start=period_start,
            period_end=period_end,
            created_by=request.user,
        )
        return Response(
            ClusterComplianceNoteSerializer(note).data,
            status=http_status.HTTP_201_CREATED,
        )


class ComplianceExportCsvView(APIView):
    """Export branch-scoped compliance data as CSV."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        today = timezone.now().date()

        start_date, err = _parse_date(request.query_params.get("start_date"))
        if err:
            return err
        end_date, err = _parse_date(request.query_params.get("end_date"))
        if err:
            return err
        if start_date is None:
            start_date = today - timedelta(weeks=4)
        if end_date is None:
            end_date = today

        clusters = _scoped_clusters(request)
        status_filter = request.query_params.get("status") or None

        payload = services.build_compliance_payload(
            clusters, start_date, end_date, status=status_filter
        )
        csv_text = services.build_compliance_csv(payload)

        response = HttpResponse(csv_text, content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="cluster_compliance.csv"'
        )
        return response


class PeopleSummaryView(APIView):
    """People & demographics summary, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 12))
        except (TypeError, ValueError):
            months = 12
        months = max(1, min(months, 60))

        people = _scoped_people(request)
        scope = resolve_branch_scope(request.user, request)
        single_branch_view = scope["effective_branch_id"] is not None

        payload = services.build_people_summary(
            people,
            months=months,
            single_branch_view=single_branch_view,
        )
        return Response(payload)


class PeopleExportCsvView(APIView):
    """Export branch-scoped people summary as CSV."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 12))
        except (TypeError, ValueError):
            months = 12
        months = max(1, min(months, 60))

        people = _scoped_people(request)
        scope = resolve_branch_scope(request.user, request)
        single_branch_view = scope["effective_branch_id"] is not None

        payload = services.build_people_summary(
            people,
            months=months,
            single_branch_view=single_branch_view,
        )
        csv_text = services.build_people_summary_csv(payload)

        response = HttpResponse(csv_text, content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="people_demographics.csv"'
        )
        return response


class EngagementSummaryView(APIView):
    """Engagement & attendance summary, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 12))
        except (TypeError, ValueError):
            months = 12
        months = max(1, min(months, 60))

        scope = resolve_branch_scope(request.user, request)
        single_branch_view = scope["effective_branch_id"] is not None

        payload = services.build_engagement_summary(
            _scoped_cluster_reports(request),
            _scoped_evangelism_reports(request),
            _scoped_service_attendance(request),
            months=months,
            single_branch_view=single_branch_view,
        )
        return Response(payload)


class EngagementExportCsvView(APIView):
    """Export branch-scoped engagement summary as CSV."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        try:
            months = int(request.query_params.get("months", 12))
        except (TypeError, ValueError):
            months = 12
        months = max(1, min(months, 60))

        scope = resolve_branch_scope(request.user, request)
        single_branch_view = scope["effective_branch_id"] is not None

        payload = services.build_engagement_summary(
            _scoped_cluster_reports(request),
            _scoped_evangelism_reports(request),
            _scoped_service_attendance(request),
            months=months,
            single_branch_view=single_branch_view,
        )
        csv_text = services.build_engagement_summary_csv(payload)

        response = HttpResponse(csv_text, content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="engagement_attendance.csv"'
        )
        return response


class NccSummaryView(APIView):
    """New Converts Class (lessons) summary, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        year, err = _parse_year_param(request)
        if err:
            return err

        payload = services.build_ncc_summary(
            _scoped_lesson_progress(request),
            _scoped_people(request),
            year=year,
        )
        return Response(payload)


class NccExportCsvView(APIView):
    """Export branch-scoped NCC summary as CSV."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        year, err = _parse_year_param(request)
        if err:
            return err

        payload = services.build_ncc_summary(
            _scoped_lesson_progress(request),
            _scoped_people(request),
            year=year,
        )
        csv_text = services.build_ncc_summary_csv(payload)

        response = HttpResponse(csv_text, content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="ncc_summary.csv"'
        )
        return response


class CymSummaryView(APIView):
    """Children Youth Ministry (Sunday School) summary, branch-scoped."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        year, year_err = _parse_year_param(request, use_current_year_default=False)
        if year_err:
            return year_err
        month, month_err = _parse_month_param(request)
        if month_err:
            return month_err

        scope = resolve_branch_scope(request.user, request)
        payload = services.build_cym_summary(
            branch_id=scope["effective_branch_id"],
            year=year,
            month=month,
        )
        return Response(payload)


class CymExportCsvView(APIView):
    """Export branch-scoped CYM summary as CSV."""

    permission_classes = [IsReportsViewer]

    def get(self, request):
        year, year_err = _parse_year_param(request, use_current_year_default=False)
        if year_err:
            return year_err
        month, month_err = _parse_month_param(request)
        if month_err:
            return month_err

        scope = resolve_branch_scope(request.user, request)
        payload = services.build_cym_summary(
            branch_id=scope["effective_branch_id"],
            year=year,
            month=month,
        )
        csv_text = services.build_cym_summary_csv(payload)

        response = HttpResponse(csv_text, content_type="text/csv")
        response["Content-Disposition"] = (
            'attachment; filename="cym_summary.csv"'
        )
        return response

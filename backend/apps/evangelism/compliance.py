"""Cluster Bible Study setup coverage and weekly-report compliance."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, timedelta

from apps.clusters.models import Cluster
from apps.clusters.utils import get_weeks_in_range, parse_iso_weeks, week_span
from apps.people.models import ModuleCoordinator
from core.datetime_utils import church_today

from .models import EvangelismGroup, EvangelismWeeklyReport

COMPLIANCE_STATUSES = ("COMPLIANT", "NON_COMPLIANT", "PARTIAL", "NO_GROUP")


class ComplianceQueryError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def user_can_view_evangelism_compliance(user) -> bool:
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM):
        return True
    if user.is_senior_coordinator(ModuleCoordinator.ModuleType.CLUSTER):
        return True
    return False


def user_can_change_evangelism_branch(user) -> bool:
    """Matches the Evangelism page branch lock: admin, pastor, evangelism senior."""
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return user.is_senior_coordinator(ModuleCoordinator.ModuleType.EVANGELISM)


def _parse_date(raw, field_name: str) -> date:
    if raw in (None, ""):
        raise ComplianceQueryError(f"{field_name} is required.")
    try:
        return date.fromisoformat(str(raw))
    except ValueError as exc:
        raise ComplianceQueryError(
            f"Invalid {field_name} format. Use YYYY-MM-DD."
        ) from exc


def resolve_compliance_weeks(year_raw, week_values, today: date | None = None):
    """ISO weeks for the compliance filter. ``week_values`` may be comma-separated."""
    today = today or church_today()
    if year_raw in (None, ""):
        year = today.isocalendar().year
    else:
        try:
            year = int(year_raw)
        except (TypeError, ValueError) as exc:
            raise ComplianceQueryError("Invalid year.") from exc

    numbers = []
    for value in week_values:
        numbers.extend(part.strip() for part in str(value).split(",") if part.strip())
    if not numbers:
        raise ComplianceQueryError("Select at least one week.")
    try:
        weeks = parse_iso_weeks(year, [int(number) for number in numbers])
    except ValueError as exc:
        raise ComplianceQueryError(str(exc)) from exc
    if not weeks:
        raise ComplianceQueryError("Select at least one week.")
    start_date, end_date = week_span(weeks)
    return start_date, end_date, weeks


def resolve_compliance_dates(start_raw, end_raw, today: date | None = None):
    today = today or church_today()
    if start_raw in (None, ""):
        start_date = today - timedelta(weeks=4)
    else:
        start_date = _parse_date(start_raw, "start_date")
    if end_raw in (None, ""):
        end_date = today
    else:
        end_date = _parse_date(end_raw, "end_date")
    if start_date > end_date:
        raise ComplianceQueryError("start_date must be on or before end_date.")
    return start_date, end_date


def clusters_for_compliance(user, branch_raw):
    """Branch-scoped clusters. Users who cannot change branch stay on their own."""
    if user_can_change_evangelism_branch(user):
        if branch_raw in (None, ""):
            return Cluster.objects.all()
        try:
            branch_id = int(branch_raw)
        except (TypeError, ValueError) as exc:
            raise ComplianceQueryError("Invalid branch_id.") from exc
        return Cluster.objects.filter(branch_id=branch_id)

    branch_id = getattr(user, "branch_id", None)
    if branch_id is None:
        return Cluster.objects.none()
    return Cluster.objects.filter(branch_id=branch_id)


def _status_for_rate(rate: float) -> str:
    if rate == 100.0:
        return "COMPLIANT"
    if rate == 0.0:
        return "NON_COMPLIANT"
    return "PARTIAL"


def build_evangelism_compliance(
    clusters, start_date: date, end_date: date, *, status=None, weeks=None
):
    """
    Setup coverage counts every cluster. Report compliance averages only clusters
    that have an active, approved Cluster BS group. ``status`` filters table rows
    and does not change the summary.

    When ``weeks`` is set, only those ISO weeks are expected. Last report date
    still comes from the latest report of any week.
    """
    if status not in (None, "") and status not in COMPLIANCE_STATUSES:
        raise ComplianceQueryError(
            "Invalid status. Use COMPLIANT, NON_COMPLIANT, PARTIAL, or NO_GROUP."
        )

    cluster_list = list(clusters.order_by("name", "code", "id"))
    cluster_ids = [cluster.id for cluster in cluster_list]
    selected_weeks = set(weeks) if weeks is not None else None
    expected_weeks = (
        selected_weeks
        if selected_weeks is not None
        else set(get_weeks_in_range(start_date, end_date))
    )
    weeks_expected = len(expected_weeks)

    groups = EvangelismGroup.objects.filter(
        cluster_id__in=cluster_ids,
        is_active=True,
        approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
    ).order_by("name", "id")
    groups_by_cluster = defaultdict(list)
    group_ids = []
    for group in groups:
        groups_by_cluster[group.cluster_id].append(group)
        group_ids.append(group.id)

    submitted_by_cluster = defaultdict(set)
    last_date_by_cluster = {}
    if group_ids:
        reports = EvangelismWeeklyReport.objects.filter(
            evangelism_group_id__in=group_ids,
        )
        if selected_weeks is None:
            reports = reports.filter(
                meeting_date__gte=start_date,
                meeting_date__lte=end_date,
            )
        for cluster_id, year, week_number, meeting_date in reports.values_list(
            "evangelism_group__cluster_id",
            "year",
            "week_number",
            "meeting_date",
        ):
            in_period = selected_weeks is None or (year, week_number) in expected_weeks
            if in_period:
                submitted_by_cluster[cluster_id].add((year, week_number))
            if selected_weeks is not None or in_period:
                previous = last_date_by_cluster.get(cluster_id)
                if previous is None or meeting_date > previous:
                    last_date_by_cluster[cluster_id] = meeting_date

    today = church_today()
    rows = []
    for cluster in cluster_list:
        cluster_groups = groups_by_cluster.get(cluster.id, [])
        group_payload = [{"id": group.id, "name": group.name} for group in cluster_groups]
        if not cluster_groups:
            rows.append(
                {
                    "cluster": {
                        "id": cluster.id,
                        "name": cluster.name,
                        "code": cluster.code,
                        "branch": cluster.branch_id,
                    },
                    "status": "NO_GROUP",
                    "groups": [],
                    "reports_submitted": 0,
                    "reports_expected": 0,
                    "compliance_rate": None,
                    "missing_weeks": [],
                    "last_report_date": None,
                    "days_since_last_report": None,
                }
            )
            continue

        submitted_weeks = submitted_by_cluster.get(cluster.id, set()) & expected_weeks
        reports_submitted = len(submitted_weeks)
        missing = sorted(expected_weeks - submitted_weeks)
        rate = (
            round(reports_submitted / weeks_expected * 100, 2)
            if weeks_expected > 0
            else 0.0
        )
        last_report_date = last_date_by_cluster.get(cluster.id)
        rows.append(
            {
                "cluster": {
                    "id": cluster.id,
                    "name": cluster.name,
                    "code": cluster.code,
                    "branch": cluster.branch_id,
                },
                "status": _status_for_rate(rate),
                "groups": group_payload,
                "reports_submitted": reports_submitted,
                "reports_expected": weeks_expected,
                "compliance_rate": rate,
                "missing_weeks": [week for _year, week in missing],
                "last_report_date": (
                    last_report_date.isoformat() if last_report_date else None
                ),
                "days_since_last_report": (
                    (today - last_report_date).days if last_report_date else None
                ),
            }
        )

    with_group = [row for row in rows if row["status"] != "NO_GROUP"]
    total_clusters = len(rows)
    clusters_with_group = len(with_group)
    clusters_without_group = total_clusters - clusters_with_group
    setup_coverage_rate = (
        round(clusters_with_group / total_clusters * 100, 2)
        if total_clusters
        else 0.0
    )
    report_compliance_rate = (
        round(
            sum(row["compliance_rate"] for row in with_group) / clusters_with_group,
            2,
        )
        if clusters_with_group
        else 0.0
    )

    summary = {
        "total_clusters": total_clusters,
        "clusters_with_group": clusters_with_group,
        "clusters_without_group": clusters_without_group,
        "setup_coverage_rate": setup_coverage_rate,
        "report_compliance_rate": report_compliance_rate,
        "compliant_clusters": sum(1 for row in with_group if row["status"] == "COMPLIANT"),
        "partial_clusters": sum(1 for row in with_group if row["status"] == "PARTIAL"),
        "non_compliant_clusters": sum(
            1 for row in with_group if row["status"] == "NON_COMPLIANT"
        ),
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "weeks_expected": weeks_expected,
        },
    }

    if status:
        rows = [row for row in rows if row["status"] == status]

    return {"summary": summary, "clusters": rows}


def build_evangelism_compliance_csv(payload: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Cluster Code",
            "Cluster Name",
            "Groups",
            "Status",
            "Reports Submitted",
            "Reports Expected",
            "Compliance Rate (%)",
            "Missing Weeks",
            "Last Report Date",
        ]
    )
    for row in payload["clusters"]:
        cluster = row["cluster"]
        rate = row["compliance_rate"]
        writer.writerow(
            [
                cluster.get("code") or "",
                cluster.get("name") or "",
                ", ".join(group["name"] for group in row["groups"]) or "No group",
                row["status"],
                row["reports_submitted"],
                row["reports_expected"],
                "" if rate is None else rate,
                ", ".join(str(week) for week in row["missing_weeks"]),
                row["last_report_date"] or "",
            ]
        )
    return output.getvalue()

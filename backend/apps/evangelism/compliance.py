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


def unclustered_groups_for_compliance(user, branch_raw):
    """Approved groups with no cluster, excluding irregular meetings."""
    groups = EvangelismGroup.objects.filter(
        cluster__isnull=True,
        is_active=True,
        approval_status=EvangelismGroup.ApprovalStatus.APPROVED,
    ).exclude(
        meeting_frequency=EvangelismGroup.MeetingFrequency.IRREGULAR
    ).order_by("name", "id")
    if user_can_change_evangelism_branch(user):
        if branch_raw in (None, ""):
            return groups
        try:
            branch_id = int(branch_raw)
        except (TypeError, ValueError) as exc:
            raise ComplianceQueryError("Invalid branch_id.") from exc
        return groups.filter(branch_id=branch_id)

    branch_id = getattr(user, "branch_id", None)
    if branch_id is None:
        return groups.none()
    return groups.filter(branch_id=branch_id)


def _status_for_rate(rate: float) -> str:
    if rate == 100.0:
        return "COMPLIANT"
    if rate == 0.0:
        return "NON_COMPLIANT"
    return "PARTIAL"


def _frequency_slots(frequency, expected_weeks, start_date: date, end_date: date):
    """Slots one group must file. Each slot is (matcher, missing_week)."""
    Frequency = EvangelismGroup.MeetingFrequency
    ordered = sorted(expected_weeks)
    if frequency == Frequency.BIWEEKLY:
        slots = []
        cursor = start_date
        first = True
        while cursor <= end_date:
            window_end = min(cursor + timedelta(days=13), end_date)
            window_start = cursor - timedelta(days=13) if first else cursor
            slots.append(
                (
                    ("dates", window_start, window_end),
                    _missing_week_label(window_start, window_end, ordered),
                )
            )
            cursor = window_end + timedelta(days=1)
            first = False
        return slots
    if frequency == Frequency.MONTHLY:
        slots = []
        seen = set()
        for year, week in ordered:
            monday = date.fromisocalendar(year, week, 1)
            key = (monday.year, monday.month)
            if key in seen:
                continue
            seen.add(key)
            slots.append((("month", key), week))
        return slots
    return [(("week", week), week[1]) for week in ordered]


def _missing_week_label(window_start: date, window_end: date, ordered_weeks) -> int:
    for year, week in ordered_weeks:
        monday = date.fromisocalendar(year, week, 1)
        sunday = monday + timedelta(days=6)
        if monday <= window_end and sunday >= window_start:
            return week
    return window_end.isocalendar().week


def _report_matches_slot(slot, meeting_date: date, year: int, week_number: int) -> bool:
    kind = slot[0]
    if kind == "week":
        return (year, week_number) == slot[1]
    if kind == "dates":
        return slot[1] <= meeting_date <= slot[2]
    return (meeting_date.year, meeting_date.month) == slot[1]


def _score_unclustered_group(
    group, reports, expected_weeks, start_date, end_date, selected_weeks, today
):
    slots = _frequency_slots(
        group.meeting_frequency, expected_weeks, start_date, end_date
    )
    held_slots = set()
    cancelled_slots = set()
    cancelled_reasons = defaultdict(list)
    last_report_date = None
    for year, week_number, meeting_date, cancelled, reason in reports:
        in_period = selected_weeks is not None or (
            start_date <= meeting_date <= end_date
        )
        if in_period and (
            last_report_date is None or meeting_date > last_report_date
        ):
            last_report_date = meeting_date
        for index, (slot, _label) in enumerate(slots):
            if not _report_matches_slot(slot, meeting_date, year, week_number):
                continue
            if cancelled:
                cancelled_slots.add(index)
                cancelled_reasons[index].append((reason or "").strip())
            else:
                held_slots.add(index)

    submitted = 0
    excused = 0
    missing = []
    cancelled_week_details = []
    for index, (_slot, label) in enumerate(slots):
        if index in held_slots:
            submitted += 1
        elif index in cancelled_slots:
            excused += 1
            cancelled_week_details.append(
                {
                    "week": label,
                    "reason": "; ".join(
                        dict.fromkeys(
                            text for text in cancelled_reasons[index] if text
                        )
                    ),
                    "group": None,
                }
            )
        else:
            missing.append(label)

    expected = len(slots) - excused
    if expected > 0:
        rate = round(submitted / expected * 100, 2)
    elif excused:
        rate = 100.0
    else:
        rate = 0.0
    return {
        "cluster": {
            "id": None,
            "name": group.name,
            "code": "No cluster",
            "branch": group.branch_id,
        },
        "status": _status_for_rate(rate),
        "groups": [
            {"id": group.id, "name": group.get_meeting_frequency_display()}
        ],
        "reports_submitted": submitted,
        "reports_expected": expected,
        "compliance_rate": rate,
        "missing_weeks": missing,
        "cancelled_weeks": cancelled_week_details,
        "last_report_date": (
            last_report_date.isoformat() if last_report_date else None
        ),
        "days_since_last_report": (
            (today - last_report_date).days if last_report_date else None
        ),
    }


def build_evangelism_compliance(
    clusters,
    start_date: date,
    end_date: date,
    *,
    status=None,
    weeks=None,
    unclustered_groups=None,
):
    """
    Setup coverage counts every cluster. Report compliance averages clusters
    that have an active, approved Cluster BS group, plus approved groups that
    are not linked to a cluster. Those groups are scored by meeting frequency.
    Irregular groups are left out. ``status`` filters table rows and does not
    change the summary.

    When ``weeks`` is set, only those ISO weeks are expected for a cluster.
    A cluster-week is excused when every report for that week is cancelled.
    A group that is not on a cluster is excused only for its own cancelled
    slot. Last report date still includes cancelled reports. A period whose
    slots are all excused stays compliant with nothing expected.
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

    held_by_cluster = defaultdict(set)
    cancelled_by_cluster = defaultdict(set)
    reasons_by_cluster = defaultdict(lambda: defaultdict(list))
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
        for (
            cluster_id,
            group_name,
            year,
            week_number,
            meeting_date,
            cancelled,
            reason,
        ) in reports.values_list(
            "evangelism_group__cluster_id",
            "evangelism_group__name",
            "year",
            "week_number",
            "meeting_date",
            "cancelled",
            "cancellation_reason",
        ):
            week = (year, week_number)
            in_period = selected_weeks is None or week in expected_weeks
            if in_period:
                if cancelled:
                    cancelled_by_cluster[cluster_id].add(week)
                    reasons_by_cluster[cluster_id][week].append(
                        {
                            "week": week_number,
                            "reason": (reason or "").strip(),
                            "group": group_name,
                        }
                    )
                else:
                    held_by_cluster[cluster_id].add(week)
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
                    "cancelled_weeks": [],
                    "last_report_date": None,
                    "days_since_last_report": None,
                }
            )
            continue

        held_weeks = held_by_cluster.get(cluster.id, set()) & expected_weeks
        cancelled_weeks = cancelled_by_cluster.get(cluster.id, set()) & expected_weeks
        excused_weeks = cancelled_weeks - held_weeks
        active_expected = expected_weeks - excused_weeks
        reports_submitted = len(held_weeks & active_expected)
        cluster_weeks_expected = len(active_expected)
        missing = sorted(active_expected - held_weeks)
        cancelled_week_details = []
        for year, week in sorted(excused_weeks):
            cancelled_week_details.extend(
                sorted(
                    reasons_by_cluster[cluster.id].get((year, week), []),
                    key=lambda item: item["group"] or "",
                )
            )
        if cluster_weeks_expected > 0:
            rate = round(reports_submitted / cluster_weeks_expected * 100, 2)
        elif excused_weeks:
            rate = 100.0
        else:
            rate = 0.0
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
                "reports_expected": cluster_weeks_expected,
                "compliance_rate": rate,
                "missing_weeks": [week for _year, week in missing],
                "cancelled_weeks": cancelled_week_details,
                "last_report_date": (
                    last_report_date.isoformat() if last_report_date else None
                ),
                "days_since_last_report": (
                    (today - last_report_date).days if last_report_date else None
                ),
            }
        )

    unclustered_rows = []
    extra_groups = list(unclustered_groups) if unclustered_groups is not None else []
    if extra_groups:
        reports_by_group = defaultdict(list)
        for group_id, year, week_number, meeting_date, cancelled, reason in (
            EvangelismWeeklyReport.objects.filter(
                evangelism_group_id__in=[group.id for group in extra_groups]
            ).values_list(
                "evangelism_group_id",
                "year",
                "week_number",
                "meeting_date",
                "cancelled",
                "cancellation_reason",
            )
        ):
            reports_by_group[group_id].append(
                (year, week_number, meeting_date, cancelled, reason)
            )
        for group in extra_groups:
            unclustered_rows.append(
                _score_unclustered_group(
                    group,
                    reports_by_group.get(group.id, []),
                    expected_weeks,
                    start_date,
                    end_date,
                    selected_weeks,
                    today,
                )
            )

    with_group = [row for row in rows if row["status"] != "NO_GROUP"]
    scored_rows = with_group + unclustered_rows
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
            sum(row["compliance_rate"] for row in scored_rows) / len(scored_rows),
            2,
        )
        if scored_rows
        else 0.0
    )
    rows.extend(unclustered_rows)

    summary = {
        "total_clusters": total_clusters,
        "clusters_with_group": clusters_with_group,
        "clusters_without_group": clusters_without_group,
        "setup_coverage_rate": setup_coverage_rate,
        "report_compliance_rate": report_compliance_rate,
        "compliant_clusters": sum(
            1 for row in scored_rows if row["status"] == "COMPLIANT"
        ),
        "partial_clusters": sum(
            1 for row in scored_rows if row["status"] == "PARTIAL"
        ),
        "non_compliant_clusters": sum(
            1 for row in scored_rows if row["status"] == "NON_COMPLIANT"
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


def _format_cancelled_weeks(items) -> str:
    parts = []
    for item in items or []:
        week = item.get("week")
        group = (item.get("group") or "").strip()
        reason = (item.get("reason") or "").strip()
        if group and reason:
            parts.append(f"{week}: {group}: {reason}")
        elif reason:
            parts.append(f"{week}: {reason}")
        elif group:
            parts.append(f"{week}: {group}")
        else:
            parts.append(str(week))
    return "; ".join(parts)


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
            "Cancelled Weeks",
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
                _format_cancelled_weeks(row.get("cancelled_weeks")),
                row["last_report_date"] or "",
            ]
        )
    return output.getvalue()

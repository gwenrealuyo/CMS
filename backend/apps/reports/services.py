"""Report builders for the analytics hub.

Compliance builders reuse ``apps.clusters`` primitives/serializers (passthrough).
People builders aggregate ``Person`` (and related) data for the demographics tab.
"""

from __future__ import annotations

import csv
import io
from collections import Counter
from datetime import date, datetime, timedelta

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.clusters.models import Cluster, ClusterComplianceNote, ClusterWeeklyReport
from apps.events.models import EventType
from apps.evangelism.models import EvangelismWeeklyReport
from apps.clusters.serializers import (
    ClusterComplianceNoteSerializer,
    ClusterComplianceSerializer,
    ClusterSerializer,
)
from apps.clusters.utils import (
    calculate_cluster_compliance,
    calculate_trend,
    get_weeks_in_range,
    is_at_risk,
)


def build_compliance_payload(
    clusters,
    start_date,
    end_date,
    *,
    status=None,
    min_rate=None,
):
    """Build the {summary, clusters, by_status} compliance payload."""
    compliance_data = []
    for cluster in clusters:
        cluster_compliance = calculate_cluster_compliance(
            cluster, start_date, end_date
        )

        # Trend vs the immediately preceding period of equal length.
        previous_start = start_date - timedelta(
            days=(end_date - start_date).days + 1
        )
        previous_end = start_date - timedelta(days=1)
        previous_compliance = calculate_cluster_compliance(
            cluster, previous_start, previous_end
        )
        trend = calculate_trend(cluster_compliance, previous_compliance)

        notes = (
            ClusterComplianceNote.objects.filter(
                cluster=cluster,
                period_start__lte=end_date,
                period_end__gte=start_date,
            )
            .select_related("created_by")
            .order_by("-created_at")
        )

        compliance_data.append(
            {
                "cluster": cluster,
                "status": cluster_compliance["status"],
                "reports_submitted": cluster_compliance["reports_submitted"],
                "reports_expected": cluster_compliance["reports_expected"],
                "compliance_rate": cluster_compliance["compliance_rate"],
                "missing_weeks": cluster_compliance["missing_weeks"],
                "last_report_date": cluster_compliance["last_report_date"],
                "days_since_last_report": cluster_compliance[
                    "days_since_last_report"
                ],
                "consecutive_missing_weeks": cluster_compliance[
                    "consecutive_missing_weeks"
                ],
                "trend": trend,
                "compliance_notes": notes,
            }
        )

    if status:
        compliance_data = [d for d in compliance_data if d["status"] == status]

    if min_rate is not None:
        compliance_data = [
            d for d in compliance_data if d["compliance_rate"] >= min_rate
        ]

    total_clusters = len(compliance_data)
    compliant_count = sum(
        1 for d in compliance_data if d["status"] == "COMPLIANT"
    )
    non_compliant_count = sum(
        1 for d in compliance_data if d["status"] == "NON_COMPLIANT"
    )
    partial_count = sum(1 for d in compliance_data if d["status"] == "PARTIAL")

    overall_compliance_rate = (
        sum(d["compliance_rate"] for d in compliance_data) / total_clusters
        if total_clusters > 0
        else 0.0
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
        },
    }

    by_status = {
        "compliant": [d for d in compliance_data if d["status"] == "COMPLIANT"],
        "non_compliant": [
            d for d in compliance_data if d["status"] == "NON_COMPLIANT"
        ],
        "partial": [d for d in compliance_data if d["status"] == "PARTIAL"],
    }

    return {
        "summary": summary,
        "clusters": ClusterComplianceSerializer(compliance_data, many=True).data,
        "by_status": {
            "compliant": ClusterComplianceSerializer(
                by_status["compliant"], many=True
            ).data,
            "non_compliant": ClusterComplianceSerializer(
                by_status["non_compliant"], many=True
            ).data,
            "partial": ClusterComplianceSerializer(
                by_status["partial"], many=True
            ).data,
        },
    }


def build_at_risk(clusters, weeks_back):
    """Build the at-risk clusters list."""
    today = timezone.now().date()
    start_date = today - timedelta(weeks=weeks_back)
    end_date = today

    result = []
    for cluster in clusters:
        compliance = calculate_cluster_compliance(cluster, start_date, end_date)

        previous_start = start_date - timedelta(
            days=(end_date - start_date).days + 1
        )
        previous_end = start_date - timedelta(days=1)
        previous_compliance = calculate_cluster_compliance(
            cluster, previous_start, previous_end
        )
        compliance["trend"] = calculate_trend(compliance, previous_compliance)

        is_risk, reason = is_at_risk(compliance, weeks_back)
        if not is_risk:
            continue

        compliance_data = ClusterComplianceSerializer(
            [{"cluster": cluster, **compliance}], many=True
        ).data[0]
        result.append(
            {
                "cluster": ClusterSerializer(cluster).data,
                "compliance": compliance_data,
                "risk_reason": reason,
            }
        )

    return result


def build_compliance_history(clusters, months, group_by):
    """Build historical compliance series grouped by week or month."""
    today = timezone.now().date()
    start_date = today - timedelta(days=months * 30)
    end_date = today

    history_data = []

    if group_by == "week":
        for year, week in get_weeks_in_range(start_date, end_date):
            week_start = datetime.strptime(
                f"{year}-W{week:02d}-1", "%Y-W%W-%w"
            ).date()
            week_end = week_start + timedelta(days=6)

            total_expected = clusters.count()
            total_submitted = ClusterWeeklyReport.objects.filter(
                cluster__in=clusters,
                year=year,
                week_number=week,
                meeting_date__gte=week_start,
                meeting_date__lte=week_end,
            ).count()

            compliance_rate = (
                (total_submitted / total_expected * 100)
                if total_expected > 0
                else 0.0
            )

            history_data.append(
                {
                    "period": f"{year}-W{week:02d}",
                    "compliance_rate": round(compliance_rate, 2),
                    "reports_expected": total_expected,
                    "reports_submitted": total_submitted,
                }
            )
    else:
        current = start_date.replace(day=1)
        while current <= end_date:
            month_start = current
            if current.month == 12:
                month_end = current.replace(day=31)
                next_month = current.replace(year=current.year + 1, month=1, day=1)
            else:
                next_month = current.replace(month=current.month + 1, day=1)
                month_end = next_month - timedelta(days=1)

            total_expected = clusters.count() * 4  # ~4 weeks per month
            total_submitted = ClusterWeeklyReport.objects.filter(
                cluster__in=clusters,
                meeting_date__gte=month_start,
                meeting_date__lte=month_end,
            ).count()

            compliance_rate = (
                (total_submitted / total_expected * 100)
                if total_expected > 0
                else 0.0
            )

            history_data.append(
                {
                    "period": f"{current.year}-{current.month:02d}",
                    "compliance_rate": round(compliance_rate, 2),
                    "reports_expected": total_expected,
                    "reports_submitted": total_submitted,
                }
            )

            current = next_month

    return {
        "data": history_data,
        "group_by": group_by,
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
    }


def build_overdue(clusters):
    """Build the overdue-this-week payload for the given clusters."""
    today = timezone.now().date()
    current_year = today.year
    current_week = today.isocalendar()[1]

    submitted_cluster_ids = ClusterWeeklyReport.objects.filter(
        cluster__in=clusters,
        year=current_year,
        week_number=current_week,
    ).values_list("cluster_id", flat=True)

    overdue_clusters = clusters.exclude(id__in=submitted_cluster_ids)

    return {
        "current_year": current_year,
        "current_week": current_week,
        "overdue_count": overdue_clusters.count(),
        "overdue_clusters": ClusterSerializer(overdue_clusters, many=True).data,
    }


def build_compliance_notes(clusters, *, cluster_id=None, start_date=None, end_date=None):
    """List compliance notes for clusters in scope."""
    notes = ClusterComplianceNote.objects.filter(
        cluster__in=clusters
    ).select_related("cluster", "created_by")

    if cluster_id is not None:
        notes = notes.filter(cluster_id=cluster_id)
    if start_date is not None:
        notes = notes.filter(period_start__gte=start_date)
    if end_date is not None:
        notes = notes.filter(period_end__lte=end_date)

    notes = notes.order_by("-created_at")
    return ClusterComplianceNoteSerializer(notes, many=True).data


def build_compliance_csv(payload):
    """Render a compliance payload (from build_compliance_payload) as CSV text."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        [
            "Cluster Code",
            "Cluster Name",
            "Coordinator",
            "Status",
            "Reports Submitted",
            "Reports Expected",
            "Compliance Rate (%)",
            "Missing Weeks",
            "Last Report Date",
            "Days Since Last Report",
            "Consecutive Missing Weeks",
            "Trend",
        ]
    )

    for row in payload["clusters"]:
        cluster = row["cluster"]
        coordinator = cluster.get("coordinator") or {}
        coordinator_name = (
            f"{coordinator.get('first_name', '')} "
            f"{coordinator.get('last_name', '')}".strip()
            if coordinator
            else ""
        )
        writer.writerow(
            [
                cluster.get("code", ""),
                cluster.get("name", ""),
                coordinator_name,
                row["status"],
                row["reports_submitted"],
                row["reports_expected"],
                row["compliance_rate"],
                ", ".join(map(str, row["missing_weeks"])),
                row["last_report_date"] or "",
                row["days_since_last_report"]
                if row["days_since_last_report"] is not None
                else "",
                row["consecutive_missing_weeks"],
                row["trend"],
            ]
        )

    return output.getvalue()


# --- People & demographics ---

ROLE_LABELS = {
    "MEMBER": "Member",
    "VISITOR": "Visitor",
    "PASTOR": "Pastor",
}

STATUS_LABELS = {
    "ACTIVE": "Active",
    "SEMIACTIVE": "Semiactive",
    "INACTIVE": "Inactive",
    "DECEASED": "Deceased",
    "INVITED": "Invited",
    "ATTENDED": "Attended",
}

GENDER_LABELS = {
    "MALE": "Male",
    "FEMALE": "Female",
    "UNKNOWN": "Unknown",
}

AGE_BAND_ORDER = [
    "0-17",
    "18-25",
    "26-35",
    "36-50",
    "51-65",
    "65+",
    "Unknown",
]


def _age_band(dob: date | None, today: date) -> str:
    if not dob:
        return "Unknown"
    age = today.year - dob.year - (
        (today.month, today.day) < (dob.month, dob.day)
    )
    if age <= 17:
        return "0-17"
    if age <= 25:
        return "18-25"
    if age <= 35:
        return "26-35"
    if age <= 50:
        return "36-50"
    if age <= 65:
        return "51-65"
    return "65+"


def _month_periods(months: int, end: date | None = None) -> list[str]:
    end = end or timezone.now().date()
    year, month = end.year, end.month
    periods: list[str] = []
    for _ in range(months):
        periods.append(f"{year}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(periods))


def _breakdown_from_counter(
    counter: Counter,
    labels: dict[str, str],
    key_order: list[str] | None = None,
) -> list[dict]:
    keys = key_order if key_order is not None else sorted(labels.keys())
    return [
        {"key": key, "label": labels.get(key, key), "count": counter.get(key, 0)}
        for key in keys
    ]


def build_people_summary(
    people_qs,
    *,
    months: int = 12,
    single_branch_view: bool = False,
):
    """Aggregate people demographics for a pre-scoped Person queryset."""
    today = timezone.now().date()
    people_qs = people_qs.distinct()

    total_people = people_qs.count()
    total_members = people_qs.filter(role="MEMBER").count()
    total_visitors = people_qs.filter(role="VISITOR").count()
    active_members = people_qs.filter(role="MEMBER", status="ACTIVE").count()
    semiactive_members = people_qs.filter(role="MEMBER", status="SEMIACTIVE").count()
    inactive_members = people_qs.filter(role="MEMBER", status="INACTIVE").count()
    deceased = people_qs.filter(status="DECEASED").count()

    with_family = (
        people_qs.annotate(_fam_count=Count("families"))
        .filter(_fam_count__gt=0)
        .count()
    )
    without_family = total_people - with_family

    in_cluster = (
        people_qs.annotate(_cluster_count=Count("clusters"))
        .filter(_cluster_count__gt=0)
        .count()
    )
    without_cluster = total_people - in_cluster

    summary = {
        "total_people": total_people,
        "total_members": total_members,
        "total_visitors": total_visitors,
        "active_members": active_members,
        "semiactive_members": semiactive_members,
        "inactive_members": inactive_members,
        "deceased": deceased,
        "with_family": with_family,
        "without_family": without_family,
        "in_cluster": in_cluster,
        "without_cluster": without_cluster,
    }

    role_counter = Counter(
        people_qs.values_list("role", flat=True),
    )
    by_role = _breakdown_from_counter(
        role_counter, ROLE_LABELS, list(ROLE_LABELS.keys())
    )

    status_counter = Counter(people_qs.values_list("status", flat=True))
    by_status = _breakdown_from_counter(
        status_counter, STATUS_LABELS, list(STATUS_LABELS.keys())
    )

    gender_counter: Counter = Counter()
    for gender in people_qs.values_list("gender", flat=True):
        key = gender if gender in ("MALE", "FEMALE") else "UNKNOWN"
        gender_counter[key] += 1
    by_gender = _breakdown_from_counter(
        gender_counter, GENDER_LABELS, list(GENDER_LABELS.keys())
    )

    age_counter: Counter = Counter()
    for dob in people_qs.values_list("date_of_birth", flat=True):
        age_counter[_age_band(dob, today)] += 1
    by_age_band = _breakdown_from_counter(
        age_counter,
        {b: b for b in AGE_BAND_ORDER},
        AGE_BAND_ORDER,
    )

    channel_counter: Counter = Counter()
    for channel in people_qs.values_list("first_activity_attended_id", flat=True):
        key = channel if channel else "UNKNOWN"
        channel_counter[key] += 1
    channel_labels = dict(EventType.objects.values_list("code", "label"))
    channel_labels["UNKNOWN"] = "Unknown"
    by_entry_channel = [
        {
            "key": key,
            "label": channel_labels.get(key, key),
            "count": count,
        }
        for key, count in sorted(
            channel_counter.items(), key=lambda x: (-x[1], x[0])
        )
    ]

    by_branch: list[dict] = []
    if not single_branch_view:
        branch_rows = (
            people_qs.filter(branch_id__isnull=False)
            .values("branch_id", "branch__name")
            .annotate(count=Count("id"))
            .order_by("branch__name")
        )
        by_branch = [
            {
                "branch_id": row["branch_id"],
                "branch_name": row["branch__name"] or f"Branch {row['branch_id']}",
                "count": row["count"],
            }
            for row in branch_rows
        ]

    periods = _month_periods(months, today)
    water_trend = []
    spirit_trend = []
    for period in periods:
        year_s, month_s = period.split("-")
        year_i, month_i = int(year_s), int(month_s)
        water_trend.append(
            {
                "period": period,
                "count": people_qs.filter(
                    water_baptism_date__year=year_i,
                    water_baptism_date__month=month_i,
                ).count(),
            }
        )
        spirit_trend.append(
            {
                "period": period,
                "count": people_qs.filter(
                    spirit_baptism_date__year=year_i,
                    spirit_baptism_date__month=month_i,
                ).count(),
            }
        )

    return {
        "summary": summary,
        "by_role": by_role,
        "by_status": by_status,
        "by_gender": by_gender,
        "by_age_band": by_age_band,
        "by_entry_channel": by_entry_channel,
        "by_branch": by_branch,
        "baptism_trend": {
            "months": months,
            "water": water_trend,
            "spirit": spirit_trend,
        },
    }


def build_people_summary_csv(payload: dict) -> str:
    """Render a people summary payload as CSV text."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["People & Demographics Summary"])
    for key, value in payload["summary"].items():
        writer.writerow([key, value])
    writer.writerow([])

    sections = [
        ("Role", payload["by_role"]),
        ("Status", payload["by_status"]),
        ("Gender", payload["by_gender"]),
        ("Age Band", payload["by_age_band"]),
        ("Entry Channel", payload["by_entry_channel"]),
    ]
    if payload.get("by_branch"):
        sections.append(("Branch", payload["by_branch"]))

    for section_name, rows in sections:
        writer.writerow([section_name, "Label", "Count"])
        for row in rows:
            label = row.get("label") or row.get("branch_name", row.get("key", ""))
            writer.writerow([row.get("key", ""), label, row["count"]])
        writer.writerow([])

    writer.writerow(["Baptism Trend (Water)", "Period", "Count"])
    for row in payload["baptism_trend"]["water"]:
        writer.writerow(["water", row["period"], row["count"]])
    writer.writerow([])
    writer.writerow(["Baptism Trend (Spirit)", "Period", "Count"])
    for row in payload["baptism_trend"]["spirit"]:
        writer.writerow(["spirit", row["period"], row["count"]])

    return output.getvalue()


def _engagement_start_date(months: int, end: date | None = None) -> date:
    """First day of the calendar month ``months`` periods before ``end``."""
    end = end or timezone.now().date()
    year, month = end.year, end.month
    month -= months - 1
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def _filter_reports_by_window(reports_qs, months: int, today: date | None = None):
    today = today or timezone.now().date()
    start = _engagement_start_date(months, today)
    return reports_qs.filter(meeting_date__gte=start, meeting_date__lte=today)


def _entity_label_from_row(row: dict, *, name_key: str, code_key: str | None = None) -> str:
    name = row.get(name_key) or ""
    code = row.get(code_key) or "" if code_key else ""
    entity_id = row.get("entity_id")
    if code and name:
        return f"{code} - {name}"
    if name:
        return name
    if code:
        return code
    return f"Entity {entity_id}"


def _build_weekly_report_section(
    reports_qs,
    *,
    member_through,
    visitor_through,
    report_fk: str,
    entity_id_field: str,
    entity_values: tuple[str, ...],
    entity_label_name_key: str,
    entity_label_code_key: str | None = None,
):
    """Aggregate weekly report attendance (cluster or evangelism)."""
    report_count = reports_qs.count()

    member_links = member_through.objects.filter(**{f"{report_fk}__in": reports_qs})
    visitor_links = visitor_through.objects.filter(**{f"{report_fk}__in": reports_qs})

    total_members = member_links.count()
    total_visitors = visitor_links.count()

    avg_members = total_members / report_count if report_count > 0 else 0
    avg_visitors = total_visitors / report_count if report_count > 0 else 0

    monthly_members = (
        member_links.annotate(_month=TruncMonth(f"{report_fk}__meeting_date"))
        .values("_month")
        .annotate(members=Count("id"))
    )
    monthly_visitors = (
        visitor_links.annotate(_month=TruncMonth(f"{report_fk}__meeting_date"))
        .values("_month")
        .annotate(visitors=Count("id"))
    )

    members_by_month: dict = {}
    for row in monthly_members:
        mt = row["_month"]
        if mt is not None:
            members_by_month[mt] = row["members"]

    visitors_by_month: dict = {}
    for row in monthly_visitors:
        mt = row["_month"]
        if mt is not None:
            visitors_by_month[mt] = row["visitors"]

    all_months = sorted(set(members_by_month.keys()) | set(visitors_by_month.keys()))
    monthly_trend = []
    for mt in all_months:
        monthly_trend.append(
            {
                "period": mt.strftime("%Y-%m"),
                "members": int(members_by_month.get(mt, 0)),
                "visitors": int(visitors_by_month.get(mt, 0)),
            }
        )

    group_id_path = f"{report_fk}__{entity_id_field}"
    member_counts_by_entity = {
        row[group_id_path]: row["sum_members_attended"]
        for row in member_links.values(group_id_path).annotate(
            sum_members_attended=Count("id")
        )
    }

    value_fields = list(entity_values)
    entity_qs = (
        reports_qs.values(*value_fields)
        .annotate(report_count=Count("id"))
        .order_by(entity_id_field)
    )

    by_entity = []
    for row in entity_qs:
        eid = row[entity_id_field]
        label_row = {
            "entity_id": eid,
            entity_label_name_key: row.get(entity_label_name_key, ""),
        }
        if entity_label_code_key:
            label_row[entity_label_code_key] = row.get(entity_label_code_key, "")
        by_entity.append(
            {
                "entity_id": eid,
                "label": _entity_label_from_row(
                    label_row,
                    name_key=entity_label_name_key,
                    code_key=entity_label_code_key,
                ),
                "report_count": row["report_count"],
                "sum_members_attended": int(member_counts_by_entity.get(eid, 0)),
            }
        )

    gathering_type_distribution = list(
        reports_qs.values("gathering_type").annotate(count=Count("id"))
    )

    return {
        "total_reports": report_count,
        "total_attendance": {
            "members": total_members,
            "visitors": total_visitors,
        },
        "average_attendance": {
            "avg_members": round(avg_members, 2),
            "avg_visitors": round(avg_visitors, 2),
        },
        "gathering_type_distribution": gathering_type_distribution,
        "monthly_trend": monthly_trend,
        "by_entity": by_entity,
    }


def _build_service_section(service_attendance_qs, *, months: int, today: date | None = None):
    """Sunday Service headcount from pre-scoped PRESENT attendance records."""
    today = today or timezone.now().date()
    start = _engagement_start_date(months, today)
    qs = service_attendance_qs.filter(
        occurrence_date__gte=start,
        occurrence_date__lte=today,
    )

    occurrence_rows = list(
        qs.values("event_id", "event__title", "occurrence_date")
        .annotate(headcount=Count("id"))
        .order_by("-occurrence_date")
    )

    occurrence_count = len(occurrence_rows)
    total_headcount = sum(row["headcount"] for row in occurrence_rows)
    avg_headcount = (
        round(total_headcount / occurrence_count, 2) if occurrence_count > 0 else 0
    )

    monthly_rows = (
        qs.annotate(_month=TruncMonth("occurrence_date"))
        .values("_month")
        .annotate(headcount=Count("id"))
        .order_by("_month")
    )
    monthly_trend = [
        {
            "period": row["_month"].strftime("%Y-%m"),
            "headcount": row["headcount"],
        }
        for row in monthly_rows
        if row["_month"] is not None
    ]

    recent_occurrences = [
        {
            "event_id": row["event_id"],
            "event_title": row["event__title"] or f"Event {row['event_id']}",
            "occurrence_date": row["occurrence_date"].isoformat(),
            "headcount": row["headcount"],
        }
        for row in occurrence_rows[:20]
    ]

    return {
        "occurrence_count": occurrence_count,
        "avg_headcount": avg_headcount,
        "monthly_trend": monthly_trend,
        "occurrences": recent_occurrences,
    }


def _build_engagement_by_branch(
    cluster_reports_qs,
    evangelism_reports_qs,
    service_attendance_qs,
    *,
    months: int,
    today: date | None = None,
) -> list[dict]:
    today = today or timezone.now().date()
    cluster_reports = _filter_reports_by_window(cluster_reports_qs, months, today)
    evangelism_reports = _filter_reports_by_window(
        evangelism_reports_qs, months, today
    )
    service_qs = service_attendance_qs.filter(
        occurrence_date__gte=_engagement_start_date(months, today),
        occurrence_date__lte=today,
    )

    branch_data: dict[int, dict] = {}

    def ensure_branch(branch_id: int, branch_name: str):
        if branch_id not in branch_data:
            branch_data[branch_id] = {
                "branch_id": branch_id,
                "branch_name": branch_name or f"Branch {branch_id}",
                "cluster_members": 0,
                "evangelism_members": 0,
                "service_headcount": 0,
            }

    cluster_member_links = (
        ClusterWeeklyReport.members_attended.through.objects.filter(
            clusterweeklyreport__in=cluster_reports
        )
        .values(
            "clusterweeklyreport__cluster__branch_id",
            "clusterweeklyreport__cluster__branch__name",
        )
        .annotate(count=Count("id"))
    )
    for row in cluster_member_links:
        bid = row["clusterweeklyreport__cluster__branch_id"]
        if bid:
            ensure_branch(bid, row["clusterweeklyreport__cluster__branch__name"])
            branch_data[bid]["cluster_members"] = row["count"]

    ev_member_links = (
        EvangelismWeeklyReport.members_attended.through.objects.filter(
            evangelismweeklyreport__in=evangelism_reports
        )
        .values(
            "evangelismweeklyreport__evangelism_group__cluster__branch_id",
            "evangelismweeklyreport__evangelism_group__cluster__branch__name",
        )
        .annotate(count=Count("id"))
    )
    for row in ev_member_links:
        bid = row["evangelismweeklyreport__evangelism_group__cluster__branch_id"]
        if bid:
            ensure_branch(
                bid,
                row["evangelismweeklyreport__evangelism_group__cluster__branch__name"],
            )
            branch_data[bid]["evangelism_members"] = row["count"]

    service_by_branch = (
        service_qs.values("event__branch_id", "event__branch__name")
        .annotate(headcount=Count("id"))
        .order_by("event__branch__name")
    )
    for row in service_by_branch:
        bid = row["event__branch_id"]
        if bid:
            ensure_branch(bid, row["event__branch__name"])
            branch_data[bid]["service_headcount"] = row["headcount"]

    return sorted(branch_data.values(), key=lambda r: r["branch_name"])


def build_engagement_summary(
    cluster_reports_qs,
    evangelism_reports_qs,
    service_attendance_qs,
    *,
    months: int = 12,
    single_branch_view: bool = False,
):
    """Aggregate engagement & attendance for pre-scoped querysets."""
    today = timezone.now().date()
    cluster_window = _filter_reports_by_window(cluster_reports_qs, months, today)
    evangelism_window = _filter_reports_by_window(
        evangelism_reports_qs, months, today
    )

    cluster_raw = _build_weekly_report_section(
        cluster_window,
        member_through=ClusterWeeklyReport.members_attended.through,
        visitor_through=ClusterWeeklyReport.visitors_attended.through,
        report_fk="clusterweeklyreport",
        entity_id_field="cluster_id",
        entity_values=("cluster_id", "cluster__name", "cluster__code"),
        entity_label_name_key="cluster__name",
        entity_label_code_key="cluster__code",
    )
    cluster_section = {
        "total_reports": cluster_raw["total_reports"],
        "total_attendance": cluster_raw["total_attendance"],
        "average_attendance": cluster_raw["average_attendance"],
        "gathering_type_distribution": cluster_raw["gathering_type_distribution"],
        "monthly_trend": cluster_raw["monthly_trend"],
        "by_cluster": [
            {
                "cluster_id": row["entity_id"],
                "cluster_label": row["label"],
                "report_count": row["report_count"],
                "sum_members_attended": row["sum_members_attended"],
            }
            for row in cluster_raw["by_entity"]
        ],
    }

    evangelism_raw = _build_weekly_report_section(
        evangelism_window,
        member_through=EvangelismWeeklyReport.members_attended.through,
        visitor_through=EvangelismWeeklyReport.visitors_attended.through,
        report_fk="evangelismweeklyreport",
        entity_id_field="evangelism_group_id",
        entity_values=("evangelism_group_id", "evangelism_group__name"),
        entity_label_name_key="evangelism_group__name",
        entity_label_code_key=None,
    )
    evangelism_section = {
        "total_reports": evangelism_raw["total_reports"],
        "total_attendance": evangelism_raw["total_attendance"],
        "average_attendance": evangelism_raw["average_attendance"],
        "gathering_type_distribution": evangelism_raw["gathering_type_distribution"],
        "monthly_trend": evangelism_raw["monthly_trend"],
        "by_group": [
            {
                "group_id": row["entity_id"],
                "group_label": row["label"],
                "report_count": row["report_count"],
                "sum_members_attended": row["sum_members_attended"],
            }
            for row in evangelism_raw["by_entity"]
        ],
    }

    service_section = _build_service_section(
        service_attendance_qs, months=months, today=today
    )

    summary = {
        "cluster_reports": cluster_section["total_reports"],
        "cluster_avg_members": cluster_section["average_attendance"]["avg_members"],
        "cluster_avg_visitors": cluster_section["average_attendance"]["avg_visitors"],
        "evangelism_reports": evangelism_section["total_reports"],
        "evangelism_avg_members": evangelism_section["average_attendance"]["avg_members"],
        "evangelism_avg_visitors": evangelism_section["average_attendance"]["avg_visitors"],
        "service_occurrences": service_section["occurrence_count"],
        "service_avg_headcount": service_section["avg_headcount"],
    }

    by_branch: list[dict] = []
    if not single_branch_view:
        by_branch = _build_engagement_by_branch(
            cluster_reports_qs,
            evangelism_reports_qs,
            service_attendance_qs,
            months=months,
            today=today,
        )

    return {
        "summary": summary,
        "cluster": cluster_section,
        "evangelism": evangelism_section,
        "service": service_section,
        "by_branch": by_branch,
    }


def build_engagement_summary_csv(payload: dict) -> str:
    """Render an engagement summary payload as CSV text."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Engagement & Attendance Summary"])
    for key, value in payload["summary"].items():
        writer.writerow([key, value])
    writer.writerow([])

    for section_name, section in (
        ("Cluster Monthly Trend", payload["cluster"]["monthly_trend"]),
        ("Evangelism Monthly Trend", payload["evangelism"]["monthly_trend"]),
        ("Sunday Service Monthly Trend", payload["service"]["monthly_trend"]),
    ):
        writer.writerow([section_name, "Period", "Members", "Visitors", "Headcount"])
        for row in section:
            if "headcount" in row:
                writer.writerow(["", row["period"], "", "", row["headcount"]])
            else:
                writer.writerow(
                    ["", row["period"], row.get("members", ""), row.get("visitors", "")]
                )
        writer.writerow([])

    writer.writerow(
        ["Cluster Comparison", "Cluster", "Reports", "Members Attended"]
    )
    for row in payload["cluster"]["by_cluster"]:
        writer.writerow(
            ["", row["cluster_label"], row["report_count"], row["sum_members_attended"]]
        )
    writer.writerow([])

    writer.writerow(["Evangelism Comparison", "Group", "Reports", "Members Attended"])
    for row in payload["evangelism"]["by_group"]:
        writer.writerow(
            ["", row["group_label"], row["report_count"], row["sum_members_attended"]]
        )
    writer.writerow([])

    if payload.get("by_branch"):
        writer.writerow(
            [
                "By Branch",
                "Branch",
                "Cluster Members",
                "Evangelism Members",
                "Service Headcount",
            ]
        )
        for row in payload["by_branch"]:
            writer.writerow(
                [
                    "",
                    row["branch_name"],
                    row["cluster_members"],
                    row["evangelism_members"],
                    row["service_headcount"],
                ]
            )

    return output.getvalue()


def build_ncc_summary(progress_qs, people_qs, *, year: int):
    """Build NCC (lessons) analytics for pre-scoped querysets."""
    from apps.lessons.services import build_lesson_progress_summary

    payload = build_lesson_progress_summary(progress_qs, year=year)
    payload["unassigned_visitors"] = (
        people_qs.filter(role="VISITOR", lesson_progress__isnull=True)
        .distinct()
        .count()
    )
    return payload


def build_ncc_summary_csv(payload: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["New Converts Class Summary"])
    writer.writerow(["year", payload.get("year", "")])
    writer.writerow(["total_participants", payload.get("total_participants", 0)])
    writer.writerow(["unassigned_visitors", payload.get("unassigned_visitors", 0)])
    writer.writerow([])

    writer.writerow(["Overall Status", "Count"])
    for status, count in (payload.get("overall") or {}).items():
        writer.writerow([status, count])
    writer.writerow([])

    writer.writerow(
        [
            "Lessons",
            "Title",
            "Completed",
            "In Progress",
            "Assigned",
            "Skipped",
            "Total",
        ]
    )
    for row in payload.get("lessons", []):
        writer.writerow(
            [
                row.get("lesson_id", ""),
                row.get("lesson_title", ""),
                row.get("completed", 0),
                row.get("in_progress", 0),
                row.get("assigned", 0),
                row.get("skipped", 0),
                row.get("total", 0),
            ]
        )

    return output.getvalue()


def build_cym_summary(
    *,
    branch_id: int | None = None,
    year: int | None = None,
    month: int | None = None,
):
    """Build CYM (Sunday School) analytics with optional branch and month scope."""
    from apps.sunday_school.services import generate_branch_scoped_summary_stats

    return generate_branch_scoped_summary_stats(
        branch_id=branch_id,
        scoped_year=year,
        scoped_month=month,
    )


def build_cym_summary_csv(payload: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Children Youth Ministry Summary"])
    for key in (
        "total_classes",
        "active_classes",
        "inactive_classes",
        "total_students",
        "total_teachers",
        "average_attendance_rate",
    ):
        writer.writerow([key, payload.get(key, "")])
    writer.writerow([])

    writer.writerow(["Classes", "Name", "Students", "Attendance Rate"])
    for row in payload.get("by_class", []):
        writer.writerow(
            [
                row.get("class_id", ""),
                row.get("class_name", ""),
                row.get("student_count", 0),
                row.get("attendance_rate", ""),
            ]
        )
    writer.writerow([])

    if payload.get("unenrolled_by_category"):
        writer.writerow(["Unenrolled by Category", "Category", "Age Range", "Count"])
        for row in payload["unenrolled_by_category"]:
            writer.writerow(
                [
                    "",
                    row.get("category_name", ""),
                    row.get("age_range", ""),
                    row.get("unenrolled_count", 0),
                ]
            )

    return output.getvalue()

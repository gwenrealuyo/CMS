from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Count, Avg
from .models import Cluster, ClusterWeeklyReport
from apps.people.models import Person


def get_weeks_in_range(start_date, end_date):
    """Get list of ISO week numbers in a date range"""
    weeks = []
    current = start_date
    while current <= end_date:
        year, week, _ = current.isocalendar()
        weeks.append((year, week))
        current += timedelta(days=7)
    return weeks


def calculate_cluster_compliance(cluster, start_date, end_date):
    """
    Calculate compliance metrics for a cluster in a given date range.

    Returns:
        dict with compliance metrics
    """
    # Get all weeks in the range
    weeks_in_range = get_weeks_in_range(start_date, end_date)
    weeks_expected = len(weeks_in_range)

    # Get all reports for this cluster in the date range
    reports = ClusterWeeklyReport.objects.filter(
        cluster=cluster, meeting_date__gte=start_date, meeting_date__lte=end_date
    ).select_related("cluster", "submitted_by")

    # Count submitted reports
    reports_submitted = reports.count()

    # Find missing weeks
    submitted_weeks = set((r.year, r.week_number) for r in reports)
    expected_weeks = set(weeks_in_range)
    missing_weeks_list = sorted(
        [week for week in expected_weeks if week not in submitted_weeks]
    )
    missing_weeks = [week[1] for week in missing_weeks_list]  # Just week numbers

    # Calculate consecutive missing weeks
    consecutive_missing = 0
    if missing_weeks_list:
        # Sort by year and week
        sorted_missing = sorted(missing_weeks_list)
        max_consecutive = 1
        current_consecutive = 1

        for i in range(1, len(sorted_missing)):
            prev_year, prev_week = sorted_missing[i - 1]
            curr_year, curr_week = sorted_missing[i]

            # Check if consecutive (same year and week+1, or next year week 1)
            if (curr_year == prev_year and curr_week == prev_week + 1) or (
                curr_year == prev_year + 1 and curr_week == 1 and prev_week == 52
            ):
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 1

        consecutive_missing = max_consecutive

    # Calculate compliance rate
    compliance_rate = (
        (reports_submitted / weeks_expected * 100) if weeks_expected > 0 else 0.0
    )

    # Determine status
    if compliance_rate == 100.0:
        status = "COMPLIANT"
    elif compliance_rate == 0.0:
        status = "NON_COMPLIANT"
    else:
        status = "PARTIAL"

    # Get last report date
    last_report = reports.order_by("-meeting_date").first()
    last_report_date = last_report.meeting_date if last_report else None

    # Calculate days since last report
    days_since_last_report = None
    if last_report_date:
        days_since_last_report = (timezone.now().date() - last_report_date).days

    return {
        "status": status,
        "reports_submitted": reports_submitted,
        "reports_expected": weeks_expected,
        "compliance_rate": round(compliance_rate, 2),
        "missing_weeks": missing_weeks,
        "last_report_date": last_report_date,
        "days_since_last_report": days_since_last_report,
        "consecutive_missing_weeks": consecutive_missing,
    }


def calculate_trend(current_period_data, previous_period_data):
    """
    Calculate trend by comparing current period compliance with previous period.

    Returns: "IMPROVING", "STABLE", or "DECLINING"
    """
    current_rate = current_period_data.get("compliance_rate", 0)
    previous_rate = previous_period_data.get("compliance_rate", 0)

    if current_rate > previous_rate + 5:  # 5% threshold
        return "IMPROVING"
    elif current_rate < previous_rate - 5:
        return "DECLINING"
    else:
        return "STABLE"


def is_at_risk(cluster_compliance_data, weeks_back=4):
    """
    Determine if a cluster is at risk based on compliance data.

    Criteria:
    - 2+ consecutive weeks without reports
    - No reports in last 2-3 weeks
    - Declining compliance trend
    """
    consecutive_missing = cluster_compliance_data.get("consecutive_missing_weeks", 0)
    days_since_last = cluster_compliance_data.get("days_since_last_report")
    trend = cluster_compliance_data.get("trend", "STABLE")

    # Check consecutive missing weeks
    if consecutive_missing >= 2:
        return True, "2+ consecutive weeks without reports"

    # Check days since last report (2-3 weeks = 14-21 days)
    if days_since_last is not None and days_since_last >= 14:
        return True, f"No reports in last {days_since_last} days"

    # Check declining trend
    if trend == "DECLINING":
        return True, "Declining compliance trend"

    return False, None

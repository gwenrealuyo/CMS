"""Where a person first attended: activity, cluster, or evangelism group."""

from typing import Optional

from django.db.models import OuterRef, Subquery

CLUSTER_ACTIVITY_CODE = "CLUSTERING"
GROUP_ACTIVITY_CODES = frozenset({"BIBLE_STUDY", "BS/CLUSTER_EVANGELISM"})


def annotate_first_attendance_places(queryset):
    """Attach the cluster, evangelism group, or event from the first-attended date."""
    from apps.attendance.models import AttendanceRecord
    from apps.clusters.models import ClusterWeeklyReport
    from apps.evangelism.models import EvangelismWeeklyReport

    cluster_name = Subquery(
        ClusterWeeklyReport.objects.filter(
            visitors_attended=OuterRef("pk"),
            meeting_date=OuterRef("date_first_attended"),
            cancelled=False,
        )
        .order_by("id")
        .values("cluster__name")[:1]
    )
    group_name = Subquery(
        EvangelismWeeklyReport.objects.filter(
            visitors_attended=OuterRef("pk"),
            meeting_date=OuterRef("date_first_attended"),
        )
        .order_by("id")
        .values("evangelism_group__name")[:1]
    )
    event_title = Subquery(
        AttendanceRecord.objects.filter(
            person=OuterRef("pk"),
            occurrence_date=OuterRef("date_first_attended"),
            status=AttendanceRecord.AttendanceStatus.PRESENT,
        )
        .order_by("id")
        .values("event__title")[:1]
    )
    return queryset.annotate(
        first_attended_cluster_name=cluster_name,
        first_attended_group_name=group_name,
        first_attended_event_title=event_title,
    )


def resolve_first_attendance_place(person) -> Optional[str]:
    """Prefer the cluster or group when that is the first activity, else the event."""
    activity = getattr(person, "first_activity_attended", None)
    code = getattr(activity, "code", "") or ""
    label = (getattr(activity, "label", None) or "").strip()
    cluster = (getattr(person, "first_attended_cluster_name", None) or "").strip()
    group = (getattr(person, "first_attended_group_name", None) or "").strip()
    event_title = (getattr(person, "first_attended_event_title", None) or "").strip()

    if code == CLUSTER_ACTIVITY_CODE:
        return cluster or label or None
    if code in GROUP_ACTIVITY_CODES:
        return group or label or None
    if event_title:
        return event_title
    if label:
        return label
    if cluster:
        return cluster
    if group:
        return group
    return None

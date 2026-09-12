"""
Utility functions for person status management based on attendance patterns.
"""
from datetime import timedelta
from django.utils import timezone

from core.datetime_utils import church_today
from django.db.models import Q
from apps.events.models import Event
from apps.attendance.models import AttendanceRecord
from apps.clusters.models import ClusterWeeklyReport

STATUS_UPDATE_JOURNEY_PREFIX = "Status Update:"
AUTO_ATTENDANCE_REASON = (
    "Status automatically updated from {from_status} to {to_status} "
    "based on attendance patterns (4-week rolling window)."
)


def calculate_person_attendance_status(person, reference_date=None):
    """
    Calculate person's attendance status based on 4-week rolling window.
    
    Status Rules (Option A - Threshold-based):
    - ACTIVE: ≥3 attendances for ALL THREE types (Sunday Service AND Clustering AND Doctrinal Class)
    - SEMIACTIVE: ≥1 attendance for at least ONE type (but not all three with ≥3 each)
    - INACTIVE: 0 attendances for ALL types
    - Special: If person not in any cluster, maximum status is SEMIACTIVE
    
    Args:
        person: Person instance
        reference_date: Date to calculate from (default: today)
    
    Returns:
        "ACTIVE", "SEMIACTIVE", "INACTIVE", or None (if insufficient data)
    """
    if reference_date is None:
        reference_date = church_today()
    
    start_date = reference_date - timedelta(weeks=4)
    
    # Count Sunday Service attendances
    sunday_events = Event.objects.filter(
        event_type_id="SUNDAY_SERVICE",
        start_date__date__gte=start_date,
        start_date__date__lte=reference_date
    )
    total_sundays = sunday_events.count()
    
    sunday_attended = 0
    if total_sundays > 0:
        sunday_attended = AttendanceRecord.objects.filter(
            person=person,
            event__in=sunday_events,
            status=AttendanceRecord.AttendanceStatus.PRESENT
        ).count()
    
    # Count Cluster attendances
    person_clusters = person.clusters.all()
    cluster_attended = 0
    total_cluster_meetings = 0
    
    if person_clusters.exists():
        cluster_reports = ClusterWeeklyReport.objects.filter(
            cluster__in=person_clusters,
            meeting_date__gte=start_date,
            meeting_date__lte=reference_date
        )
        total_cluster_meetings = cluster_reports.count()
        
        if total_cluster_meetings > 0:
            cluster_attended = cluster_reports.filter(
                members_attended=person
            ).count()
    
    # Count Doctrinal Class attendances
    doctrinal_events = Event.objects.filter(
        event_type_id="DOCTRINAL_CLASS",
        start_date__date__gte=start_date,
        start_date__date__lte=reference_date
    )
    total_doctrinal = doctrinal_events.count()
    
    doctrinal_attended = 0
    if total_doctrinal > 0:
        doctrinal_attended = AttendanceRecord.objects.filter(
            person=person,
            event__in=doctrinal_events,
            status=AttendanceRecord.AttendanceStatus.PRESENT
        ).count()
    
    # Check if we have sufficient data
    # If no events of any type exist, return None
    if total_sundays == 0 and total_cluster_meetings == 0 and total_doctrinal == 0:
        return None
    
    # Apply thresholds
    THRESHOLD_ACTIVE = 3  # For ACTIVE status (all three types need ≥3)
    THRESHOLD_SEMIACTIVE = 1  # For SEMIACTIVE status (at least one type needs ≥1)
    
    sunday_meets_active = sunday_attended >= THRESHOLD_ACTIVE
    cluster_meets_active = cluster_attended >= THRESHOLD_ACTIVE
    doctrinal_meets_active = doctrinal_attended >= THRESHOLD_ACTIVE
    
    sunday_meets_semiactive = sunday_attended >= THRESHOLD_SEMIACTIVE
    cluster_meets_semiactive = cluster_attended >= THRESHOLD_SEMIACTIVE
    doctrinal_meets_semiactive = doctrinal_attended >= THRESHOLD_SEMIACTIVE
    
    # Determine status
    # ACTIVE: All three types meet ACTIVE threshold (≥3)
    if sunday_meets_active and cluster_meets_active and doctrinal_meets_active:
        return "ACTIVE"
    
    # SEMIACTIVE: At least one type has at least 1 attendance (but not all three with ≥3 each)
    elif sunday_meets_semiactive or cluster_meets_semiactive or doctrinal_meets_semiactive:
        # If person not in any cluster, max is SEMIACTIVE (already satisfied)
        if not person_clusters.exists():
            return "SEMIACTIVE"
        return "SEMIACTIVE"
    
    # INACTIVE: No attendances for any type (all are 0)
    else:
        return "INACTIVE"


def record_person_status_change(
    *,
    person,
    from_status,
    to_status,
    source,
    reason="",
    changed_by=None,
):
    """
    Persist a PersonStatusChange and a Journey NOTE when status actually changes.

    Journey notes are skipped on first assignment (empty from_status). Auto
    attendance coalesces to one Status Update NOTE per person per day.
    """
    from apps.people.models import Journey, PersonStatusChange

    from_status = from_status or ""
    to_status = to_status or ""
    if from_status == to_status:
        return None

    reason = (reason or "").strip()
    if source == PersonStatusChange.Source.AUTO_ATTENDANCE and not reason:
        reason = AUTO_ATTENDANCE_REASON.format(
            from_status=from_status, to_status=to_status
        )

    change = PersonStatusChange.objects.create(
        person=person,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        source=source,
        changed_by=changed_by if getattr(changed_by, "pk", None) else None,
    )

    if not from_status:
        return change

    title = f"{STATUS_UPDATE_JOURNEY_PREFIX} {from_status} → {to_status}"
    today = church_today()
    if source == PersonStatusChange.Source.AUTO_ATTENDANCE:
        existing_journey = Journey.objects.filter(
            user=person,
            type="NOTE",
            date=today,
            title__startswith=STATUS_UPDATE_JOURNEY_PREFIX,
        ).first()
        if existing_journey:
            existing_journey.title = title
            existing_journey.description = reason
            existing_journey.save(update_fields=["title", "description"])
            return change

    Journey.objects.create(
        user=person,
        type="NOTE",
        title=title,
        description=reason,
        date=today,
        verified_by=None,
    )
    return change


def update_person_status(person, force=False):
    """
    Update person's status based on attendance and create Journey entry if changed.
    
    Args:
        person: Person instance
        force: If True, update even if status hasn't changed
    
    Returns:
        bool: True if status was updated, False otherwise
    """
    from apps.people.models import PeopleAutomationSetting, PersonStatusChange

    if not PeopleAutomationSetting.get_solo().auto_status_updates_enabled:
        return False

    # Manual pastoral statuses must not be overwritten by attendance auto-calc
    MANUAL_STATUSES = {"DECEASED", "DORMANT", "FALLAWAY"}
    if person.status in MANUAL_STATUSES:
        return False
    
    new_status = calculate_person_attendance_status(person)
    
    # Only update if status changed or force is True
    if new_status and (person.status != new_status or force):
        old_status = person.status
        
        # Update status
        person.status = new_status
        person.save(update_fields=['status'])

        record_person_status_change(
            person=person,
            from_status=old_status,
            to_status=new_status,
            source=PersonStatusChange.Source.AUTO_ATTENDANCE,
        )
        
        return True
    return False


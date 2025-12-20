"""
Utility functions for person status management based on attendance patterns.
"""
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from apps.events.models import Event
from apps.attendance.models import AttendanceRecord
from apps.clusters.models import ClusterWeeklyReport


def calculate_person_attendance_status(person, reference_date=None):
    """
    Calculate person's attendance status based on 4-week rolling window.
    
    Status Rules (Option A - Threshold-based):
    - ACTIVE: ≥3 attendances for ALL THREE types (Sunday Service AND Clustering AND Doctrinal Class)
    - SEMIACTIVE: ≥3 attendances for at least ONE type (but not all three)
    - INACTIVE: <3 attendances for ALL types
    - Special: If person not in any cluster, maximum status is SEMIACTIVE
    
    Args:
        person: Person instance
        reference_date: Date to calculate from (default: today)
    
    Returns:
        "ACTIVE", "SEMIACTIVE", "INACTIVE", or None (if insufficient data)
    """
    if reference_date is None:
        reference_date = timezone.now().date()
    
    start_date = reference_date - timedelta(weeks=4)
    
    # Count Sunday Service attendances
    sunday_events = Event.objects.filter(
        type="SUNDAY_SERVICE",
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
        type="DOCTRINAL_CLASS",
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
    
    # Apply threshold (≥3 = meets threshold)
    THRESHOLD = 3
    sunday_meets = sunday_attended >= THRESHOLD
    cluster_meets = cluster_attended >= THRESHOLD
    doctrinal_meets = doctrinal_attended >= THRESHOLD
    
    # Determine status
    # ACTIVE: All three types meet threshold
    if sunday_meets and cluster_meets and doctrinal_meets:
        return "ACTIVE"
    
    # SEMIACTIVE: At least one type meets threshold (but not all three)
    elif sunday_meets or cluster_meets or doctrinal_meets:
        # If person not in any cluster, max is SEMIACTIVE (already satisfied)
        if not person_clusters.exists():
            return "SEMIACTIVE"
        return "SEMIACTIVE"
    
    # INACTIVE: None of the types meet threshold
    else:
        return "INACTIVE"


def update_person_status(person, force=False):
    """
    Update person's status based on attendance and create Journey entry if changed.
    
    Args:
        person: Person instance
        force: If True, update even if status hasn't changed
    
    Returns:
        bool: True if status was updated, False otherwise
    """
    from apps.people.models import Journey
    
    new_status = calculate_person_attendance_status(person)
    
    # Only update if status changed or force is True
    if new_status and (person.status != new_status or force):
        old_status = person.status
        
        # Update status
        person.status = new_status
        person.save(update_fields=['status'])
        
        # Create Journey entry for status change (type: NOTE)
        # Only create if there was a previous status (not first assignment)
        if old_status:
            today = timezone.now().date()
            
            # Check if journey already exists for today (prevent duplicates)
            existing_journey = Journey.objects.filter(
                user=person,
                type="NOTE",
                date=today,
                title__startswith="Status Update:"
            ).first()
            
            if existing_journey:
                # Update existing journey with latest status change
                existing_journey.title = f"Status Update: {old_status} → {new_status}"
                existing_journey.description = f"Status automatically updated from {old_status} to {new_status} based on attendance patterns (4-week rolling window)."
                existing_journey.save()
            else:
                # Create new journey entry
                Journey.objects.create(
                    user=person,
                    type="NOTE",
                    title=f"Status Update: {old_status} → {new_status}",
                    description=f"Status automatically updated from {old_status} to {new_status} based on attendance patterns (4-week rolling window).",
                    date=today,
                    verified_by=None,  # System-generated, no verifier
                )
        
        return True
    return False


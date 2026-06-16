import calendar
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from django.db.models import Q
from django.utils import timezone

from apps.people.models import Person

from .models import (
    SundaySchoolCategory,
    SundaySchoolClass,
    SundaySchoolClassMember,
    SundaySchoolSession,
)


def calculate_age(date_of_birth: Optional[date]) -> Optional[int]:
    """
    Calculate age from date_of_birth.
    Returns None if date_of_birth is None.
    """
    if date_of_birth is None:
        return None

    today = timezone.now().date()
    age = today.year - date_of_birth.year
    # Adjust if birthday hasn't occurred this year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        age -= 1
    return age


def bulk_enroll_students(
    sunday_school_class: SundaySchoolClass,
    person_ids: List[int],
    role: str,
    enrolled_date: Optional[date] = None,
) -> int:
    """
    Bulk enroll students/teachers into a Sunday School class.
    Returns the number of enrollments created.
    """
    if enrolled_date is None:
        enrolled_date = timezone.now().date()

    created_count = 0
    for person_id in person_ids:
        member, created = SundaySchoolClassMember.objects.get_or_create(
            sunday_school_class=sunday_school_class,
            person_id=person_id,
            defaults={
                "role": role,
                "enrolled_date": enrolled_date,
                "is_active": True,
            },
        )
        if created:
            created_count += 1
        else:
            # Update existing membership if inactive
            if not member.is_active:
                member.is_active = True
                member.role = role
                member.save()
                created_count += 1

    return created_count


def calculate_attendance_rate(
    sunday_school_class: SundaySchoolClass,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    branch_id: Optional[int] = None,
) -> Optional[float]:
    """
    Calculate average attendance rate for a class.
    Returns None if no sessions found.
    """
    from apps.attendance.models import AttendanceRecord

    sessions = sunday_school_class.sessions.all()
    if start_date:
        sessions = sessions.filter(session_date__gte=start_date)
    if end_date:
        sessions = sessions.filter(session_date__lte=end_date)

    if not sessions.exists():
        return None

    student_qs = sunday_school_class.members.filter(
        is_active=True, role=SundaySchoolClassMember.Role.STUDENT
    )
    if branch_id is not None:
        student_qs = student_qs.filter(person__branch_id=branch_id)

    student_ids = list(student_qs.values_list("person_id", flat=True))
    total_enrolled = len(student_ids)

    if total_enrolled == 0:
        return None

    total_present = 0
    total_sessions = 0

    for session in sessions:
        if not session.event:
            continue

        attendance_records = AttendanceRecord.objects.filter(
            event=session.event,
            occurrence_date=session.session_date,
            status=AttendanceRecord.AttendanceStatus.PRESENT,
            person_id__in=student_ids,
        )
        present_count = attendance_records.count()
        total_present += present_count
        total_sessions += 1

    if total_sessions == 0:
        return None

    average_attendance = total_present / (total_sessions * total_enrolled)
    return round(average_attendance * 100, 2)


def get_unenrolled_by_category(
    status_filter: Optional[str] = None,
    role_filter: Optional[str] = None,
    branch_id: Optional[int] = None,
) -> List[Dict]:
    """
    Find unenrolled people by category based on age brackets.
    Returns list of dictionaries with category info and unenrolled people.
    """
    categories = SundaySchoolCategory.objects.filter(is_active=True).order_by("order", "name")

    # Get all enrolled person IDs
    enrolled_person_ids = set(
        SundaySchoolClassMember.objects.filter(is_active=True).values_list("person_id", flat=True)
    )

    # Get all people with date_of_birth
    people_query = Person.objects.filter(date_of_birth__isnull=False)
    if branch_id is not None:
        people_query = people_query.filter(branch_id=branch_id)
    if status_filter:
        people_query = people_query.filter(status=status_filter)
    if role_filter:
        people_query = people_query.filter(role=role_filter)

    people = people_query.select_related().prefetch_related("clusters", "families").all()

    result = []
    for category in categories:
        unenrolled_people = []
        for person in people:
            # Skip if already enrolled
            if person.id in enrolled_person_ids:
                continue

            age = calculate_age(person.date_of_birth)
            if age is None:
                continue

            # Check if person matches category age bracket
            matches = True
            if category.min_age is not None and age < category.min_age:
                matches = False
            if category.max_age is not None and age > category.max_age:
                matches = False

            if matches:
                # Format name with middle initial, nickname, and suffix
                name_parts = []
                if person.first_name:
                    name_parts.append(person.first_name.strip())
                if person.nickname:
                    name_parts.append(f'"{person.nickname.strip()}"')
                if person.middle_name:
                    middle_initial = person.middle_name.strip()[0].upper() if person.middle_name.strip() else ""
                    if middle_initial:
                        name_parts.append(f"{middle_initial}.")
                if person.last_name:
                    name_parts.append(person.last_name.strip())
                if person.suffix:
                    name_parts.append(person.suffix.strip())
                full_name = " ".join(name_parts).strip() or person.username
                
                # Get cluster information
                clusters = person.clusters.all()
                cluster_info = []
                for cluster in clusters:
                    cluster_display = []
                    if cluster.code:
                        cluster_display.append(cluster.code)
                    if cluster.name:
                        cluster_display.append(cluster.name)
                    if cluster_display:
                        cluster_info.append(" - ".join(cluster_display))
                cluster_display_str = ", ".join(cluster_info) if cluster_info else ""
                
                # Get family names
                family_names = list(person.families.values_list("name", flat=True))
                family_display_str = ", ".join(family_names) if family_names else ""
                
                # Create a person object with age attribute
                person_data = {
                    "id": person.id,
                    "full_name": full_name,
                    "first_name": person.first_name,
                    "middle_name": person.middle_name,
                    "last_name": person.last_name,
                    "suffix": person.suffix,
                    "age": age,
                    "date_of_birth": person.date_of_birth,
                    "status": person.status,
                    "cluster_info": cluster_display_str,
                    "family_names": family_display_str,
                }
                unenrolled_people.append(person_data)

        age_range = ""
        if category.min_age is not None and category.max_age is not None:
            age_range = f"{category.min_age}-{category.max_age}"
        elif category.min_age is not None:
            age_range = f"{category.min_age}+"

        result.append(
            {
                "category_id": category.id,
                "category_name": category.name,
                "age_range": age_range,
                "unenrolled_count": len(unenrolled_people),
                "unenrolled_people": unenrolled_people,
            }
        )

    return result


def _scoped_active_members(branch_id: Optional[int] = None):
    members = SundaySchoolClassMember.objects.filter(is_active=True)
    if branch_id is not None:
        members = members.filter(person__branch_id=branch_id)
    return members


def generate_branch_scoped_summary_stats(
    *,
    branch_id: Optional[int] = None,
    scoped_year: Optional[int] = None,
    scoped_month: Optional[int] = None,
) -> Dict:
    """Summary statistics scoped by enrolled members' branch when branch_id is set."""
    members = _scoped_active_members(branch_id)
    students = members.filter(role=SundaySchoolClassMember.Role.STUDENT)
    teachers = members.filter(
        role__in=[
            SundaySchoolClassMember.Role.TEACHER,
            SundaySchoolClassMember.Role.ASSISTANT_TEACHER,
        ]
    )

    if branch_id is not None:
        class_ids = members.values_list("sunday_school_class_id", flat=True).distinct()
        classes = SundaySchoolClass.objects.filter(id__in=class_ids)
    else:
        classes = SundaySchoolClass.objects.all()

    active_classes = classes.filter(is_active=True)
    inactive_classes = classes.filter(is_active=False)

    window_start = window_end = None
    if scoped_year is not None and scoped_month is not None:
        last_day = calendar.monthrange(scoped_year, scoped_month)[1]
        window_start = date(scoped_year, scoped_month, 1)
        window_end = date(scoped_year, scoped_month, last_day)

    total_attendance_rate = 0.0
    classes_with_attendance = 0
    by_class = []

    for class_obj in active_classes:
        if window_start and window_end:
            rate = calculate_attendance_rate(
                class_obj, window_start, window_end, branch_id=branch_id
            )
        else:
            rate = calculate_attendance_rate(class_obj, branch_id=branch_id)

        student_count = students.filter(sunday_school_class=class_obj).count()
        if student_count == 0:
            continue

        if rate is not None:
            total_attendance_rate += rate
            classes_with_attendance += 1

        by_class.append(
            {
                "class_id": class_obj.id,
                "class_name": class_obj.name,
                "attendance_rate": rate,
                "student_count": student_count,
            }
        )

    by_class.sort(
        key=lambda row: (row["attendance_rate"] is None, -(row["attendance_rate"] or 0))
    )

    avg_attendance_rate = (
        round(total_attendance_rate / classes_with_attendance, 2)
        if classes_with_attendance > 0
        else None
    )

    unenrolled = get_unenrolled_by_category(branch_id=branch_id)
    unenrolled_summary = [
        {
            "category_id": row["category_id"],
            "category_name": row["category_name"],
            "age_range": row["age_range"],
            "unenrolled_count": row["unenrolled_count"],
        }
        for row in unenrolled
        if row["unenrolled_count"] > 0
    ]

    return {
        "total_classes": classes.count(),
        "active_classes": active_classes.count(),
        "inactive_classes": inactive_classes.count(),
        "total_students": students.count(),
        "total_teachers": teachers.count(),
        "average_attendance_rate": avg_attendance_rate,
        "by_class": by_class,
        "unenrolled_by_category": unenrolled_summary,
    }


def generate_summary_stats(
    scoped_year: Optional[int] = None,
    scoped_month: Optional[int] = None,
) -> Dict:
    """
    Generate summary statistics for Sunday School.

    When scoped_year and scoped_month are set (calendar month 1-12),
    average_attendance_rate uses sessions only in that month (for MoM dashboards).
    Otherwise counts use all-time attendance rate per class as before.
    """
    stats = generate_branch_scoped_summary_stats(
        branch_id=None,
        scoped_year=scoped_year,
        scoped_month=scoped_month,
    )

    if scoped_year is not None and scoped_month is not None:
        stats["most_attended_classes"] = []
        stats["least_attended_classes"] = []
    else:
        class_attendance = [
            row
            for row in stats.get("by_class", [])
            if row.get("attendance_rate") is not None
        ]
        class_attendance.sort(key=lambda x: x["attendance_rate"], reverse=True)
        stats["most_attended_classes"] = class_attendance[:5]
        stats["least_attended_classes"] = (
            class_attendance[-5:] if len(class_attendance) > 5 else []
        )

    stats.pop("by_class", None)
    stats.pop("unenrolled_by_category", None)
    return stats


def create_recurring_sessions(
    sunday_school_class: SundaySchoolClass,
    start_date: date,
    end_date: Optional[date],
    num_occurrences: Optional[int],
    recurrence_pattern: str,
    day_of_week: Optional[int] = None,
    default_lesson_title: str = "",
) -> List[SundaySchoolSession]:
    """
    Create multiple sessions based on recurrence pattern.
    Returns list of created sessions.
    """
    from apps.events.models import Event

    sessions = []
    current_date = start_date
    occurrence_count = 0
    recurring_group_id = f"{sunday_school_class.id}_{timezone.now().timestamp()}"

    # Determine end condition
    if num_occurrences:
        max_occurrences = num_occurrences
    elif end_date:
        max_occurrences = 1000  # Large number, will be limited by end_date
    else:
        max_occurrences = 52  # Default to 1 year of weekly sessions

    # Get class meeting time
    meeting_time = sunday_school_class.meeting_time or timezone.now().time()

    while occurrence_count < max_occurrences:
        if end_date and current_date > end_date:
            break

        # For weekly patterns, adjust to the correct day of week
        if recurrence_pattern == "weekly" and day_of_week is not None:
            # day_of_week: 0=Monday, 6=Sunday
            current_weekday = current_date.weekday()
            days_to_add = (day_of_week - current_weekday) % 7
            if days_to_add > 0:
                current_date += timedelta(days=days_to_add)
            if end_date and current_date > end_date:
                break

        # Create session
        session = SundaySchoolSession.objects.create(
            sunday_school_class=sunday_school_class,
            session_date=current_date,
            session_time=meeting_time,
            lesson_title=default_lesson_title,
            is_recurring_instance=True,
            recurring_group_id=recurring_group_id,
        )

        # Create corresponding Event
        session_datetime = datetime.combine(current_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)  # Default 1 hour session

        event_title = sunday_school_class.name
        if default_lesson_title:
            event_title = f"{event_title} - {default_lesson_title}"

        event = Event.objects.create(
            title=event_title,
            description=f"Sunday School session for {sunday_school_class.name}",
            start_date=session_datetime,
            end_date=end_datetime,
            event_type_id="SUNDAY_SCHOOL",
            location=sunday_school_class.room_location or "",
            is_recurring=False,
        )

        session.event = event
        session.save()

        sessions.append(session)
        occurrence_count += 1

        # Calculate next date based on pattern
        if recurrence_pattern == "weekly":
            current_date += timedelta(weeks=1)
        elif recurrence_pattern == "bi_weekly":
            current_date += timedelta(weeks=2)
        elif recurrence_pattern == "monthly":
            # Add approximately one month (30 days)
            # For more accurate monthly calculation, we'd need dateutil
            current_date += timedelta(days=30)

    return sessions


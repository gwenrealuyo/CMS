from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from django.db.models import Q, Count
from django.utils import timezone

from apps.people.models import Person, Journey
from apps.clusters.models import Cluster

from .models import (
    EvangelismGroup,
    EvangelismGroupMember,
    EvangelismSession,
    Prospect,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
    FollowUpTask,
    DropOff,
)


def bulk_enroll_members(
    evangelism_group: EvangelismGroup,
    person_ids: List[int],
    role: str,
    joined_date: Optional[date] = None,
) -> int:
    """
    Bulk enroll members into an evangelism group.
    Returns the number of enrollments created.
    """
    if joined_date is None:
        joined_date = timezone.now().date()

    created_count = 0
    for person_id in person_ids:
        member, created = EvangelismGroupMember.objects.get_or_create(
            evangelism_group=evangelism_group,
            person_id=person_id,
            defaults={
                "role": role,
                "joined_date": joined_date,
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


def get_inviter_cluster(inviter: Person) -> Optional[Cluster]:
    """
    Get the cluster of the inviter for prospect tracking.
    Returns the first cluster the inviter belongs to, or None.
    """
    clusters = inviter.clusters.all()
    return clusters.first() if clusters.exists() else None


def create_person_from_prospect(
    prospect: Prospect,
    first_name: str,
    last_name: str,
    **kwargs
) -> Person:
    """
    Create a Person record from a prospect when they first attend.
    Sets Person.inviter = prospect.invited_by.
    Links the prospect to the created Person.
    """
    from apps.people.serializers import PersonSerializer

    # Generate username from first two letters of first name + last name
    first_two_letters = first_name[:2].lower() if first_name else ""
    username = f"{first_two_letters}{last_name.lower()}"
    
    # Ensure username is unique
    original_username = username
    counter = 1
    while Person.objects.filter(username=username).exists():
        username = f"{original_username}{counter}"
        counter += 1

    person_data = {
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "facebook_name": prospect.facebook_name,
        "role": "VISITOR",
        "status": "ATTENDED",
        "inviter": prospect.invited_by,
        "date_first_attended": timezone.now().date(),
        **kwargs
    }

    person = Person.objects.create(**person_data)
    prospect.person = person
    prospect.save(update_fields=["person"])
    
    return person


def update_monthly_tracking(
    prospect: Prospect,
    stage: str,
    cluster: Optional[Cluster] = None,
    tracking_date: Optional[date] = None,
) -> MonthlyConversionTracking:
    """
    Update monthly conversion tracking when prospect reaches new stage.
    Creates or updates tracking record for the current month.
    """
    if tracking_date is None:
        tracking_date = timezone.now().date()
    
    if cluster is None:
        cluster = prospect.inviter_cluster or prospect.endorsed_cluster
    
    if not cluster:
        raise ValueError("Cluster is required for monthly tracking")

    year = tracking_date.year
    month = tracking_date.month

    tracking, created = MonthlyConversionTracking.objects.get_or_create(
        cluster=cluster,
        prospect=prospect,
        year=year,
        month=month,
        stage=stage,
        defaults={
            "person": prospect.person,
            "first_date_in_stage": tracking_date,
        }
    )

    if not created and tracking.first_date_in_stage > tracking_date:
        tracking.first_date_in_stage = tracking_date
        tracking.save()

    return tracking


def calculate_monthly_statistics(
    cluster: Optional[Cluster] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> List[Dict]:
    """
    Calculate monthly statistics by stage with proper unique person counting.
    Returns list of statistics dictionaries.
    """
    if year is None:
        year = timezone.now().year
    if month is None:
        month = timezone.now().month

    query = MonthlyConversionTracking.objects.filter(year=year, month=month)
    if cluster:
        query = query.filter(cluster=cluster)

    # Get unique persons per stage
    invited_prospects = query.filter(stage=MonthlyConversionTracking.Stage.INVITED).values_list("prospect_id", flat=True).distinct()
    attended_prospects = query.filter(stage=MonthlyConversionTracking.Stage.ATTENDED).values_list("prospect_id", flat=True).distinct()
    baptized_prospects = query.filter(stage=MonthlyConversionTracking.Stage.BAPTIZED).values_list("prospect_id", flat=True).distinct()
    received_hg_prospects = query.filter(stage=MonthlyConversionTracking.Stage.RECEIVED_HG).values_list("prospect_id", flat=True).distinct()

    # For INVITED: only count if they haven't attended yet
    invited_count = len([p for p in invited_prospects if p not in attended_prospects])

    # For ATTENDED: count unique persons
    attended_count = len(attended_prospects)

    # For BAPTIZED: count events (journey count)
    baptized_count = query.filter(stage=MonthlyConversionTracking.Stage.BAPTIZED).count()

    # For RECEIVED_HG: count events (journey count)
    received_hg_count = query.filter(stage=MonthlyConversionTracking.Stage.RECEIVED_HG).count()

    # For CONVERTED: count unique persons who completed both within same year
    converted_prospects = set()
    for prospect_id in baptized_prospects:
        if prospect_id in received_hg_prospects:
            # Check if both happened in this year (could be different months)
            baptized_query = MonthlyConversionTracking.objects.filter(
                prospect_id=prospect_id,
                year=year,
                stage=MonthlyConversionTracking.Stage.BAPTIZED
            )
            if cluster:
                baptized_query = baptized_query.filter(cluster=cluster)
            baptized_in_year = baptized_query.exists()
            
            received_hg_query = MonthlyConversionTracking.objects.filter(
                prospect_id=prospect_id,
                year=year,
                stage=MonthlyConversionTracking.Stage.RECEIVED_HG
            )
            if cluster:
                received_hg_query = received_hg_query.filter(cluster=cluster)
            received_hg_in_year = received_hg_query.exists()
            
            if baptized_in_year and received_hg_in_year:
                # Find the month they first completed both
                baptized_query = MonthlyConversionTracking.objects.filter(
                    prospect_id=prospect_id,
                    year=year,
                    stage=MonthlyConversionTracking.Stage.BAPTIZED
                )
                if cluster:
                    baptized_query = baptized_query.filter(cluster=cluster)
                baptized_month = baptized_query.order_by("month").first()
                
                received_hg_query = MonthlyConversionTracking.objects.filter(
                    prospect_id=prospect_id,
                    year=year,
                    stage=MonthlyConversionTracking.Stage.RECEIVED_HG
                )
                if cluster:
                    received_hg_query = received_hg_query.filter(cluster=cluster)
                received_hg_month = received_hg_query.order_by("month").first()
                
                if baptized_month and received_hg_month:
                    completion_month = max(baptized_month.month, received_hg_month.month)
                    if completion_month == month:
                        converted_prospects.add(prospect_id)

    converted_count = len(converted_prospects)

    result = {
        "year": year,
        "month": month,
        "cluster_id": cluster.id if cluster else None,
        "cluster_name": cluster.name if cluster else "All Clusters",
        "invited_count": invited_count,
        "attended_count": attended_count,
        "baptized_count": baptized_count,
        "received_hg_count": received_hg_count,
        "converted_count": converted_count,
    }

    return [result] if cluster else [result]


def check_conversion_completion(
    prospect: Prospect,
    year: int,
    cluster: Optional[Cluster] = None,
) -> bool:
    """
    Check if prospect has completed both BAPTIZED and RECEIVED_HG within same year.
    """
    if cluster is None:
        cluster = prospect.inviter_cluster or prospect.endorsed_cluster
    
    if not cluster:
        return False

    baptized = MonthlyConversionTracking.objects.filter(
        prospect=prospect,
        cluster=cluster,
        year=year,
        stage=MonthlyConversionTracking.Stage.BAPTIZED
    ).exists()

    received_hg = MonthlyConversionTracking.objects.filter(
        prospect=prospect,
        cluster=cluster,
        year=year,
        stage=MonthlyConversionTracking.Stage.RECEIVED_HG
    ).exists()

    return baptized and received_hg


def endorse_visitor_to_cluster(prospect: Prospect, cluster: Cluster) -> Prospect:
    """
    Transfer visitor to a different cluster.
    """
    prospect.endorsed_cluster = cluster
    prospect.save(update_fields=["endorsed_cluster"])
    return prospect


def get_cluster_visitors(cluster: Cluster) -> List[Prospect]:
    """
    Get all visitors for a cluster (from inviter's cluster or endorsed).
    """
    return Prospect.objects.filter(
        Q(inviter_cluster=cluster) | Q(endorsed_cluster=cluster),
        is_dropped_off=False
    ).distinct()


def detect_drop_offs(inactivity_days: int = 30) -> List[Prospect]:
    """
    Auto-detect drop-offs based on inactivity period (default 30 days).
    Returns list of prospects that should be marked as dropped off.
    """
    cutoff_date = timezone.now().date() - timedelta(days=inactivity_days)
    
    prospects = Prospect.objects.filter(
        is_dropped_off=False,
        last_activity_date__lt=cutoff_date
    ).exclude(
        pipeline_stage=Prospect.PipelineStage.CONVERTED
    )

    return list(prospects)


def check_lesson_completion(prospect: Prospect) -> bool:
    """
    Verify if prospect has completed required lessons before baptism (unless fast-tracked).
    """
    if prospect.fast_track_reason != Prospect.FastTrackReason.NONE:
        return True  # Fast-tracked, skip lesson check
    
    return prospect.has_finished_lessons


def update_person_baptism_dates(
    conversion: Conversion, notes: Optional[str] = None
) -> None:
    """
    Sync conversion data to Person model.
    """
    person = conversion.person
    if conversion.water_baptism_date:
        person.water_baptism_date = conversion.water_baptism_date
    if conversion.spirit_baptism_date:
        person.spirit_baptism_date = conversion.spirit_baptism_date
    person.save(update_fields=["water_baptism_date", "spirit_baptism_date"])

    if not notes:
        return

    if person.date_first_attended:
        Journey.objects.filter(
            user=person, type="NOTE", date=person.date_first_attended
        ).update(description=notes)

    if conversion.water_baptism_date:
        Journey.objects.filter(
            user=person, type="BAPTISM", date=conversion.water_baptism_date
        ).update(description=notes)

    if conversion.spirit_baptism_date:
        Journey.objects.filter(
            user=person, type="SPIRIT", date=conversion.spirit_baptism_date
        ).update(description=notes)


def update_each1reach1_goal(conversion: Conversion) -> None:
    """
    Update cluster goal progress when conversion is completed.
    """
    if not conversion.is_complete:
        return

    cluster = conversion.cluster
    if not cluster:
        return

    year = conversion.conversion_date.year

    goal, created = Each1Reach1Goal.objects.get_or_create(
        cluster=cluster,
        year=year,
        defaults={
            "target_conversions": 1,  # Default target
            "achieved_conversions": 0,
            "status": Each1Reach1Goal.Status.NOT_STARTED,
        }
    )

    goal.achieved_conversions += 1
    if goal.achieved_conversions >= goal.target_conversions:
        goal.status = Each1Reach1Goal.Status.COMPLETED
    else:
        goal.status = Each1Reach1Goal.Status.IN_PROGRESS
    
    goal.save()


def calculate_conversion_rate(
    group: Optional[EvangelismGroup] = None,
    cluster: Optional[Cluster] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Optional[float]:
    """
    Calculate conversion rate for a group or cluster.
    """
    conversions = Conversion.objects.filter(is_complete=True)
    
    if group:
        conversions = conversions.filter(evangelism_group=group)
    if cluster:
        conversions = conversions.filter(cluster=cluster)
    if start_date:
        conversions = conversions.filter(conversion_date__gte=start_date)
    if end_date:
        conversions = conversions.filter(conversion_date__lte=end_date)

    total_conversions = conversions.count()
    
    # Get total prospects
    prospects = Prospect.objects.all()
    if group:
        prospects = prospects.filter(evangelism_group=group)
    if cluster:
        prospects = prospects.filter(
            Q(inviter_cluster=cluster) | Q(endorsed_cluster=cluster)
        )

    total_prospects = prospects.count()
    
    if total_prospects == 0:
        return None

    return round((total_conversions / total_prospects) * 100, 2)


def get_group_statistics(group: EvangelismGroup) -> Dict:
    """
    Get group-level analytics.
    """
    members_count = group.members.filter(is_active=True).count()
    prospects_count = group.prospects.count()
    conversions_count = group.conversions.filter(is_complete=True).count()
    conversion_rate = calculate_conversion_rate(group=group)

    return {
        "group_id": group.id,
        "group_name": group.name,
        "members_count": members_count,
        "prospects_count": prospects_count,
        "conversions_count": conversions_count,
        "conversion_rate": conversion_rate,
    }


def get_cluster_statistics(cluster: Cluster, year: Optional[int] = None) -> Dict:
    """
    Get cluster-level evangelism analytics.
    """
    if year is None:
        year = timezone.now().year

    prospects = get_cluster_visitors(cluster)
    conversions = Conversion.objects.filter(cluster=cluster, is_complete=True)
    if year:
        conversions = conversions.filter(conversion_date__year=year)

    goal = Each1Reach1Goal.objects.filter(cluster=cluster, year=year).first()

    return {
        "cluster_id": cluster.id,
        "cluster_name": cluster.name,
        "year": year,
        "prospects_count": prospects.count(),
        "conversions_count": conversions.count(),
        "goal": {
            "target": goal.target_conversions if goal else 0,
            "achieved": goal.achieved_conversions if goal else 0,
            "progress_percentage": goal.progress_percentage if goal else 0.0,
            "status": goal.status if goal else Each1Reach1Goal.Status.NOT_STARTED,
        },
    }


def create_recurring_sessions(
    evangelism_group: EvangelismGroup,
    start_date: date,
    end_date: Optional[date],
    num_occurrences: Optional[int],
    recurrence_pattern: str,
    day_of_week: Optional[int] = None,
    default_topic: str = "",
) -> List[EvangelismSession]:
    """
    Create multiple sessions based on recurrence pattern.
    Returns list of created sessions.
    """
    from apps.events.models import Event

    sessions = []
    current_date = start_date
    occurrence_count = 0
    recurring_group_id = f"{evangelism_group.id}_{timezone.now().timestamp()}"

    # Determine end condition
    if num_occurrences:
        max_occurrences = num_occurrences
    elif end_date:
        max_occurrences = 1000
    else:
        max_occurrences = 52

    # Get group meeting time
    meeting_time = evangelism_group.meeting_time or timezone.now().time()

    # Determine event type based on cluster affiliation
    event_type = "CLUSTER_BS_EVANGELISM" if evangelism_group.cluster else "BIBLE_STUDY"

    while occurrence_count < max_occurrences:
        if end_date and current_date > end_date:
            break

        # For weekly patterns, adjust to the correct day of week
        if recurrence_pattern == "weekly" and day_of_week is not None:
            current_weekday = current_date.weekday()
            days_to_add = (day_of_week - current_weekday) % 7
            if days_to_add > 0:
                current_date += timedelta(days=days_to_add)
            if end_date and current_date > end_date:
                break

        # Create session
        session = EvangelismSession.objects.create(
            evangelism_group=evangelism_group,
            session_date=current_date,
            session_time=meeting_time,
            topic=default_topic,
            is_recurring_instance=True,
            recurring_group_id=recurring_group_id,
        )

        # Create corresponding Event
        session_datetime = datetime.combine(current_date, meeting_time)
        session_datetime = timezone.make_aware(session_datetime)
        end_datetime = session_datetime + timedelta(hours=1)

        event_title = evangelism_group.name
        if default_topic:
            event_title = f"{event_title} - {default_topic}"

        event = Event.objects.create(
            title=event_title,
            description=f"Bible Study session for {evangelism_group.name}",
            start_date=session_datetime,
            end_date=end_datetime,
            type=event_type,
            location=evangelism_group.location or "",
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
            current_date += timedelta(days=30)

    return sessions


def generate_each1reach1_report(cluster: Optional[Cluster] = None, year: Optional[int] = None) -> Dict:
    """
    Generate yearly progress reports (cluster-based).
    """
    if year is None:
        year = timezone.now().year

    goals = Each1Reach1Goal.objects.filter(year=year)
    if cluster:
        goals = goals.filter(cluster=cluster)

    total_target = sum(goal.target_conversions for goal in goals)
    total_achieved = sum(goal.achieved_conversions for goal in goals)
    completed_goals = goals.filter(status=Each1Reach1Goal.Status.COMPLETED).count()

    return {
        "year": year,
        "total_clusters": goals.count(),
        "total_target": total_target,
        "total_achieved": total_achieved,
        "completed_goals": completed_goals,
        "overall_progress": round((total_achieved / total_target * 100), 2) if total_target > 0 else 0.0,
        "goals": [
            {
                "cluster_id": goal.cluster.id,
                "cluster_name": goal.cluster.name,
                "target": goal.target_conversions,
                "achieved": goal.achieved_conversions,
                "progress_percentage": goal.progress_percentage,
                "status": goal.status,
            }
            for goal in goals
        ],
    }


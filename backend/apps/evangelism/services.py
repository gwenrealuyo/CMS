from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from django.db.models import Q, Count
from django.utils import timezone

from apps.people.models import Person, Journey
from apps.clusters.models import Cluster

from .models import (
    EvangelismGroup,
    EvangelismSession,
    Prospect,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
    FollowUpTask,
    DropOff,
)


def bulk_enroll_members(evangelism_group: EvangelismGroup, person_ids: List[int]) -> int:
    """
    Bulk add people to the group's members M2M.
    Returns the number of new links added (not already in the group).
    """
    if not person_ids:
        return 0
    before = set(evangelism_group.members.values_list("id", flat=True))
    qs = Person.objects.filter(id__in=person_ids).exclude(role__in=["ADMIN", "VISITOR"])
    ids_to_add = [pid for pid in qs.values_list("id", flat=True) if pid not in before]
    if not ids_to_add:
        return 0
    evangelism_group.members.add(*ids_to_add)
    return len(ids_to_add)


def get_inviter_cluster(inviter: Person) -> Optional[Cluster]:
    """
    Get the cluster of the inviter for prospect tracking.
    Returns the first cluster the inviter belongs to, or None.
    """
    clusters = inviter.clusters.all()
    return clusters.first() if clusters.exists() else None


def sync_prospect_invitation_journey_note(person: Person, prospect: Prospect) -> None:
    """Copy invitation-time notes to a Journey NOTE dated by first invitation."""
    text = (prospect.notes or "").strip()
    if not text:
        return
    invite_date = prospect.date_first_invited or timezone.now().date()
    Journey.objects.update_or_create(
        user=person,
        type="NOTE",
        date=invite_date,
        title="Invitation note",
        defaults={
            "description": text,
            "verified_by": None,
        },
    )


def create_person_from_prospect(
    prospect: Prospect,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    **kwargs,
) -> Person:
    """
    Create a Person record from a prospect when they first attend.
    Sets Person.inviter = prospect.invited_by.
    Links the prospect to the created Person.
    """
    date_first_attended = kwargs.pop("date_first_attended", timezone.now().date())

    fn = (first_name or "").strip() or prospect.first_name
    ln = (last_name or "").strip() or prospect.last_name

    # Generate username from first two letters of first name + last name
    first_two_letters = fn[:2].lower() if fn else ""
    username = f"{first_two_letters}{ln.lower()}" if ln else f"user{prospect.pk}"

    # Ensure username is unique
    original_username = username
    counter = 1
    while Person.objects.filter(username=username).exists():
        username = f"{original_username}{counter}"
        counter += 1

    middle_name = kwargs.pop("middle_name", prospect.middle_name)
    suffix = kwargs.pop("suffix", prospect.suffix)
    gender = kwargs.pop("gender", prospect.gender) or ""
    facebook_name = kwargs.pop("facebook_name", prospect.facebook_name) or ""
    date_first_invited = kwargs.pop("date_first_invited", prospect.date_first_invited)

    person_data = {
        "username": username,
        "first_name": fn,
        "last_name": ln,
        "middle_name": middle_name or "",
        "suffix": suffix or "",
        "gender": gender,
        "facebook_name": facebook_name,
        "role": "VISITOR",
        "status": "ATTENDED",
        "inviter": prospect.invited_by,
        "date_first_attended": date_first_attended,
        "date_first_invited": date_first_invited,
        **kwargs,
    }

    person = Person.objects.create(**person_data)
    prospect.person = person
    prospect.save(update_fields=["person"])

    sync_prospect_invitation_journey_note(person, prospect)

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
    branch_id: Optional[int] = None,
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
    elif branch_id is not None:
        query = query.filter(cluster__branch_id=branch_id)

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
            baptized_query = MonthlyConversionTracking.objects.filter(
                prospect_id=prospect_id,
                year=year,
                stage=MonthlyConversionTracking.Stage.BAPTIZED,
            )
            if cluster:
                baptized_query = baptized_query.filter(cluster=cluster)
            elif branch_id is not None:
                baptized_query = baptized_query.filter(cluster__branch_id=branch_id)
            baptized_in_year = baptized_query.exists()

            received_hg_query = MonthlyConversionTracking.objects.filter(
                prospect_id=prospect_id,
                year=year,
                stage=MonthlyConversionTracking.Stage.RECEIVED_HG,
            )
            if cluster:
                received_hg_query = received_hg_query.filter(cluster=cluster)
            elif branch_id is not None:
                received_hg_query = received_hg_query.filter(cluster__branch_id=branch_id)
            received_hg_in_year = received_hg_query.exists()

            if baptized_in_year and received_hg_in_year:
                baptized_query = MonthlyConversionTracking.objects.filter(
                    prospect_id=prospect_id,
                    year=year,
                    stage=MonthlyConversionTracking.Stage.BAPTIZED,
                )
                if cluster:
                    baptized_query = baptized_query.filter(cluster=cluster)
                elif branch_id is not None:
                    baptized_query = baptized_query.filter(cluster__branch_id=branch_id)
                baptized_month = baptized_query.order_by("month").first()

                received_hg_query = MonthlyConversionTracking.objects.filter(
                    prospect_id=prospect_id,
                    year=year,
                    stage=MonthlyConversionTracking.Stage.RECEIVED_HG,
                )
                if cluster:
                    received_hg_query = received_hg_query.filter(cluster=cluster)
                elif branch_id is not None:
                    received_hg_query = received_hg_query.filter(cluster__branch_id=branch_id)
                received_hg_month = received_hg_query.order_by("month").first()

                if baptized_month and received_hg_month:
                    completion_month = max(baptized_month.month, received_hg_month.month)
                    if completion_month == month:
                        converted_prospects.add(prospect_id)

    converted_count = len(converted_prospects)

    taken_ncc_count = count_taken_ncc_prospects_for_month(
        year=year,
        month=month,
        branch_id=branch_id,
        cluster_id=cluster.id if cluster else None,
    )

    result = {
        "year": year,
        "month": month,
        "cluster_id": cluster.id if cluster else None,
        "cluster_name": cluster.name if cluster else "All Clusters",
        "invited_count": invited_count,
        "attended_count": attended_count,
        "taken_ncc_count": taken_ncc_count,
        "baptized_count": baptized_count,
        "received_hg_count": received_hg_count,
        "converted_count": converted_count,
    }

    return [result]


TAKEN_NCC_STAGE = "TAKEN_NCC"


def _prospects_taken_ncc_qs(active_qs):
    """Active prospects who have taken NCC or progressed past it."""
    from apps.lessons.models import LessonSessionReport, PersonLessonProgress

    lesson_person_ids = LessonSessionReport.objects.values_list(
        "student_id", flat=True
    ).distinct()
    progress_person_ids = PersonLessonProgress.objects.values_list(
        "person_id", flat=True
    ).distinct()
    activity_person_ids = set(lesson_person_ids) | set(progress_person_ids)

    past_ncc_stages = [
        Prospect.PipelineStage.BAPTIZED,
        Prospect.PipelineStage.RECEIVED_HG,
        Prospect.PipelineStage.CONVERTED,
    ]

    return active_qs.filter(
        Q(pipeline_stage__in=past_ncc_stages)
        | Q(has_finished_lessons=True)
        | Q(person_id__in=activity_person_ids)
    ).distinct()


def count_taken_ncc_prospects_for_month(
    *,
    year: int,
    month: int,
    branch_id: Optional[int] = None,
    cluster_id: Optional[int] = None,
    evangelism_group_id: Optional[int] = None,
    group_person_ids: Optional[frozenset] = None,
) -> int:
    """Count unique prospects with NCC lesson activity in a month (People Tally NCC rule)."""
    from apps.lessons.models import LessonSessionReport

    student_lsr = LessonSessionReport.objects.filter(
        session_date__year=year,
        session_date__month=month,
    )
    if branch_id is not None:
        student_lsr = student_lsr.filter(student__branch_id=branch_id)
    if cluster_id is not None:
        student_lsr = student_lsr.filter(student__clusters__id=cluster_id)
    elif evangelism_group_id is not None:
        gp_ids = group_person_ids or frozenset()
        if gp_ids:
            student_lsr = student_lsr.filter(student_id__in=gp_ids)
        else:
            student_lsr = student_lsr.none()

    student_ids = student_lsr.values_list("student_id", flat=True).distinct()

    student_qs = Prospect.objects.filter(
        person_id__in=student_ids,
        commitment_form_signed=False,
    )
    if branch_id is not None:
        student_qs = student_qs.filter(person__branch_id=branch_id)
    if cluster_id is not None:
        student_qs = student_qs.filter(person__clusters__id=cluster_id)
    elif evangelism_group_id is not None:
        gp_ids = group_person_ids or frozenset()
        if gp_ids:
            student_qs = student_qs.filter(person_id__in=gp_ids)
        else:
            student_qs = student_qs.none()

    return student_qs.values_list("person_id", flat=True).distinct().count()


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
    """Whether the prospect's lesson completion flag allows baptism."""

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


def get_default_each1reach1_target(cluster: Cluster) -> int:
    """
    Compute default target conversions for a cluster.
    Business rule: target is 2x all non-admin cluster members.
    """
    member_count = cluster.members.exclude(role="ADMIN").count()
    return member_count * 2


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
            "target_conversions": get_default_each1reach1_target(cluster),
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
    members_count = group.members.exclude(role__in=["ADMIN", "VISITOR"]).count()
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
    event_type = "BS/CLUSTER_EVANGELISM" if evangelism_group.cluster else "BIBLE_STUDY"

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
            event_type_id=event_type,
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


def _prospect_branch_q(branch_id: int) -> Q:
    """Filter prospects tied to a branch via cluster or linked person."""
    return (
        Q(inviter_cluster__branch_id=branch_id)
        | Q(endorsed_cluster__branch_id=branch_id)
        | Q(person__branch_id=branch_id)
    )


def _drop_off_branch_q(branch_id: int) -> Q:
    return (
        Q(prospect__inviter_cluster__branch_id=branch_id)
        | Q(prospect__endorsed_cluster__branch_id=branch_id)
        | Q(prospect__person__branch_id=branch_id)
    )


_PIPELINE_FUNNEL_STAGES = [
    (Prospect.PipelineStage.INVITED, "Invited"),
    (Prospect.PipelineStage.ATTENDED, "Attended"),
    (TAKEN_NCC_STAGE, "Taken NCC"),
    (Prospect.PipelineStage.BAPTIZED, "Baptized"),
    (Prospect.PipelineStage.RECEIVED_HG, "Received Holy Ghost"),
    (Prospect.PipelineStage.CONVERTED, "Converted"),
]

_PIPELINE_STAGE_ORDER = {
    Prospect.PipelineStage.INVITED: 0,
    Prospect.PipelineStage.ATTENDED: 1,
    TAKEN_NCC_STAGE: 2,
    Prospect.PipelineStage.BAPTIZED: 3,
    Prospect.PipelineStage.RECEIVED_HG: 4,
    Prospect.PipelineStage.CONVERTED: 5,
}


def build_pipeline_funnel(prospects_qs) -> List[Dict]:
    """Cumulative funnel counts for active (non-dropped-off) prospects."""
    active = prospects_qs.filter(is_dropped_off=False)
    funnel = []
    previous_count = None

    for stage, label in _PIPELINE_FUNNEL_STAGES:
        if stage == TAKEN_NCC_STAGE:
            count = _prospects_taken_ncc_qs(active).count()
        else:
            min_order = _PIPELINE_STAGE_ORDER[stage]
            at_or_beyond = [
                key
                for key, order in _PIPELINE_STAGE_ORDER.items()
                if order >= min_order and key != TAKEN_NCC_STAGE
            ]
            count = active.filter(pipeline_stage__in=at_or_beyond).count()
        rate_from_previous = None
        if previous_count is not None and previous_count > 0:
            rate_from_previous = round((count / previous_count) * 100, 1)
        funnel.append(
            {
                "stage": stage,
                "label": label,
                "count": count,
                "rate_from_previous": rate_from_previous,
            }
        )
        previous_count = count

    return funnel


def build_drop_off_leakage(drop_offs_qs) -> Dict:
    """Aggregate drop-off leakage metrics."""
    total = drop_offs_qs.count()
    recovered = drop_offs_qs.filter(recovered=True).count()
    recovery_rate = round((recovered / total * 100), 2) if total > 0 else 0.0

    by_stage = []
    for stage, label in Prospect.PipelineStage.choices:
        count = drop_offs_qs.filter(drop_off_stage=stage).count()
        if count > 0:
            by_stage.append({"stage": stage, "label": label, "count": count})

    by_reason = []
    for reason, label in DropOff.DropOffReason.choices:
        count = drop_offs_qs.filter(reason=reason).count()
        if count > 0:
            by_reason.append({"reason": reason, "label": label, "count": count})

    return {
        "total_drop_offs": total,
        "recovered": recovered,
        "recovery_rate": recovery_rate,
        "by_stage": by_stage,
        "by_reason": by_reason,
    }


def calculate_yearly_monthly_trend(
    *,
    branch_id: Optional[int] = None,
    year: Optional[int] = None,
) -> List[Dict]:
    """Monthly stage statistics for each month in a calendar year."""
    if year is None:
        year = timezone.now().year

    trend = []
    for month in range(1, 13):
        trend.append(
            calculate_monthly_statistics(
                branch_id=branch_id,
                year=year,
                month=month,
            )[0]
        )
    return trend


def _count_completed_conversions(*, branch_id: Optional[int], year: int) -> int:
    conversions = Conversion.objects.filter(
        is_complete=True,
        conversion_date__year=year,
    )
    if branch_id is not None:
        conversions = conversions.filter(cluster__branch_id=branch_id)
    return conversions.count()


def _count_total_reached(*, branch_id: Optional[int], year: int) -> int:
    people = Person.objects.exclude(role="ADMIN").filter(
        water_baptism_date__isnull=False,
        spirit_baptism_date__isnull=False,
        water_baptism_date__year=year,
        spirit_baptism_date__year=year,
    )
    if branch_id is not None:
        people = people.filter(branch_id=branch_id)
    return people.values("id").distinct().count()


def _build_v2b_by_cluster(*, branch_id: Optional[int], year: int) -> List[Dict]:
    clusters = Cluster.objects.all()
    if branch_id is not None:
        clusters = clusters.filter(branch_id=branch_id)

    rows = []
    for cluster in clusters.order_by("name"):
        prospects = get_cluster_visitors(cluster)
        active_prospects = prospects.count()
        completed = Conversion.objects.filter(
            cluster=cluster,
            is_complete=True,
            conversion_date__year=year,
        ).count()
        drop_offs = DropOff.objects.filter(
            prospect__in=prospects,
            drop_off_date__year=year,
        ).count()
        if active_prospects == 0 and completed == 0 and drop_offs == 0:
            continue
        rows.append(
            {
                "cluster_id": cluster.id,
                "cluster_name": cluster.name or cluster.code or f"Cluster {cluster.id}",
                "active_prospects": active_prospects,
                "completed_conversions": completed,
                "drop_offs": drop_offs,
            }
        )
    return rows


def generate_branch_scoped_v2b_summary(
    *,
    branch_id: Optional[int] = None,
    year: Optional[int] = None,
    single_branch_view: bool = False,
) -> Dict:
    """Build Visitor-to-Brethren analytics for optional branch and year scope."""
    if year is None:
        year = timezone.now().year

    prospects = Prospect.objects.all()
    if branch_id is not None:
        prospects = prospects.filter(_prospect_branch_q(branch_id))

    drop_offs = DropOff.objects.filter(drop_off_date__year=year)
    if branch_id is not None:
        drop_offs = drop_offs.filter(_drop_off_branch_q(branch_id))

    leakage = build_drop_off_leakage(drop_offs)

    return {
        "year": year,
        "summary": {
            "active_prospects": prospects.filter(is_dropped_off=False).count(),
            "completed_conversions": _count_completed_conversions(
                branch_id=branch_id, year=year
            ),
            "total_reached": _count_total_reached(branch_id=branch_id, year=year),
            "drop_offs": leakage["total_drop_offs"],
            "recovery_rate": leakage["recovery_rate"],
        },
        "funnel": build_pipeline_funnel(prospects),
        "monthly_trend": calculate_yearly_monthly_trend(branch_id=branch_id, year=year),
        "leakage": leakage,
        "by_cluster": []
        if single_branch_view
        else _build_v2b_by_cluster(branch_id=branch_id, year=year),
    }


def get_evangelism_dashboard_stats(year: int) -> Dict:
    """
    Aggregate counts for evangelism dashboard stat cards.

    - total_visitors: distinct VISITOR people who have already attended — listed on
      evangelism or cluster weekly reports as visitors_attended, or a linked
      non-dropped prospect at pipeline stage ATTENDED or beyond (not INVITED).
    - total_reached: distinct non-admin people with both baptism dates in `year`.
    - completed_conversions: Conversion records with is_complete for `year`.
    """
    total_groups = EvangelismGroup.objects.count()
    active_groups = EvangelismGroup.objects.filter(is_active=True).count()

    attended_prospect_person_ids = set(
        Prospect.objects.filter(
            is_dropped_off=False,
            person_id__isnull=False,
            pipeline_stage__in=[
                Prospect.PipelineStage.ATTENDED,
                Prospect.PipelineStage.BAPTIZED,
                Prospect.PipelineStage.RECEIVED_HG,
                Prospect.PipelineStage.CONVERTED,
            ],
        ).values_list("person_id", flat=True)
    )

    ev_visitor_ids = set(
        Person.objects.filter(
            role="VISITOR",
            evangelism_reports_as_visitor__isnull=False,
        )
        .values_list("id", flat=True)
        .distinct()
    )

    cluster_visitor_ids = set(
        Person.objects.filter(
            role="VISITOR",
            cluster_reports_as_visitor__isnull=False,
        )
        .values_list("id", flat=True)
        .distinct()
    )

    total_visitors = len(
        attended_prospect_person_ids | ev_visitor_ids | cluster_visitor_ids
    )

    v2b = generate_branch_scoped_v2b_summary(branch_id=None, year=year)

    return {
        "total_groups": total_groups,
        "active_groups": active_groups,
        "total_visitors": total_visitors,
        "total_reached": v2b["summary"]["total_reached"],
        "completed_conversions": v2b["summary"]["completed_conversions"],
        "year": year,
    }


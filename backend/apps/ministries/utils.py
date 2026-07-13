"""
Utility functions for the ministries app.
"""

from django.db.models import Q

from apps.people.models import ModuleCoordinator

from .models import MinistryMember, MinistryRole, MinistryScope


def user_can_set_national_ministry_scope(user) -> bool:
    """Admin, HQ pastor (all-branch), or Senior Ministries coordinator."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) == "ADMIN":
        return True
    if hasattr(user, "can_see_all_branches") and user.can_see_all_branches():
        return True
    if hasattr(user, "is_senior_coordinator") and user.is_senior_coordinator(
        ModuleCoordinator.ModuleType.MINISTRIES
    ):
        return True
    return False


def apply_ministry_branch_visibility(queryset, user):
    """
    Restrict to NATIONAL ministries plus the user's own branch.
    Callers who may see all branches should skip this helper.
    """
    if getattr(user, "branch_id", None):
        return queryset.filter(
            Q(scope=MinistryScope.NATIONAL) | Q(branch_id=user.branch_id)
        )
    return queryset.filter(scope=MinistryScope.NATIONAL)


def sync_coordinators_to_members(ministry):
    """
    Sync primary_coordinator and support_coordinators to MinistryMember entries.
    This ensures coordinator assignments automatically create/update MinistryMember records.

    This function is shared between serializers and signals to avoid code duplication.
    """
    # Track current coordinators
    current_primary = ministry.primary_coordinator
    current_support = set(ministry.support_coordinators.all())

    # Sync primary coordinator
    if current_primary:
        MinistryMember.objects.update_or_create(
            ministry=ministry,
            member=current_primary,
            defaults={
                "role": MinistryRole.PRIMARY_COORDINATOR,
                "is_active": True,
            },
        )

    # Sync support coordinators
    for support_coord in current_support:
        # Only set as COORDINATOR if they're not the primary coordinator
        if current_primary and support_coord.pk == current_primary.pk:
            continue
        MinistryMember.objects.update_or_create(
            ministry=ministry,
            member=support_coord,
            defaults={
                "role": MinistryRole.COORDINATOR,
                "is_active": True,
            },
        )

    # Handle removed coordinators: update their role to TEAM_MEMBER if they still have a membership
    all_memberships = MinistryMember.objects.filter(ministry=ministry)
    for membership in all_memberships:
        # If they were a coordinator but are no longer
        if membership.role in [
            MinistryRole.PRIMARY_COORDINATOR,
            MinistryRole.COORDINATOR,
        ]:
            is_still_primary = (
                current_primary and membership.member.pk == current_primary.pk
            )
            is_still_support = membership.member in current_support

            if not is_still_primary and not is_still_support:
                # They were removed from coordinator positions, update to TEAM_MEMBER
                membership.role = MinistryRole.TEAM_MEMBER
                membership.save(update_fields=["role"])

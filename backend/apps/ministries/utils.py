"""
Utility functions for the ministries app.
"""

from .models import Ministry, MinistryMember, MinistryRole


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







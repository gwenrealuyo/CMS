from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from apps.people.models import Journey

from .models import MinistryMember

# Store previous instance state to track field changes
_previous_instances = {}


def _build_joined_journey_defaults(ministry_member: MinistryMember) -> dict:
    """Build defaults for a 'Joined' journey entry."""
    role_display = ministry_member.get_role_display()
    description_parts = [
        f"Joined {ministry_member.ministry.name}",
        f"as {role_display}",
        f"on {ministry_member.join_date.isoformat()}",
    ]
    description = " ".join(description_parts)

    return {
        "title": f"Joined {ministry_member.ministry.name}",
        "date": ministry_member.join_date,
        "type": "MINISTRY",
        "description": description,
    }


def _build_inactive_journey_defaults(ministry_member: MinistryMember) -> dict:
    """Build defaults for a 'Became Inactive' journey entry."""
    role_display = ministry_member.get_role_display()
    description_parts = [
        f"Became inactive in {ministry_member.ministry.name}",
        f"as {role_display}",
        f"on {timezone.now().date().isoformat()}",
    ]
    description = " ".join(description_parts)

    return {
        "title": f"Became Inactive in {ministry_member.ministry.name}",
        "date": timezone.now().date(),
        "type": "MINISTRY",
        "description": description,
    }


def _build_left_journey_defaults(ministry_member: MinistryMember) -> dict:
    """Build defaults for a 'Left' journey entry."""
    role_display = ministry_member.get_role_display()
    description_parts = [
        f"Left {ministry_member.ministry.name}",
        f"as {role_display}",
        f"on {timezone.now().date().isoformat()}",
    ]
    description = " ".join(description_parts)

    return {
        "title": f"Left {ministry_member.ministry.name}",
        "date": timezone.now().date(),
        "type": "MINISTRY",
        "description": description,
    }


def _build_rejoined_journey_defaults(ministry_member: MinistryMember) -> dict:
    """Build defaults for a 'Rejoined' journey entry."""
    role_display = ministry_member.get_role_display()
    description_parts = [
        f"Rejoined {ministry_member.ministry.name}",
        f"as {role_display}",
        f"on {timezone.now().date().isoformat()}",
    ]
    description = " ".join(description_parts)

    return {
        "title": f"Rejoined {ministry_member.ministry.name}",
        "date": timezone.now().date(),
        "type": "MINISTRY",
        "description": description,
    }


def _find_joined_journey(ministry_member: MinistryMember):
    """Find the existing 'Joined' journey entry for this person+ministry combination."""
    return Journey.objects.filter(
        user=ministry_member.member,
        type="MINISTRY",
        title__startswith=f"Joined {ministry_member.ministry.name}",
    ).first()


@receiver(pre_save, sender=MinistryMember)
def store_previous_instance(sender, instance: MinistryMember, **kwargs):
    """Store the previous instance state to track field changes."""
    # Store the pk before save to track changes
    original_pk = instance.pk
    if original_pk:
        try:
            previous = sender.objects.get(pk=original_pk)
            # Use original_pk as key, which will match in post_save for updates
            _previous_instances[original_pk] = previous
        except sender.DoesNotExist:
            _previous_instances[original_pk] = None
    else:
        # For new instances, store with None key
        _previous_instances[None] = None


@receiver(post_save, sender=MinistryMember)
def manage_ministry_journey(sender, instance: MinistryMember, created: bool, **kwargs):
    """Create or update journey entries based on ministry membership changes."""
    # For new instances, use None as key; for updates, use instance.pk
    lookup_key = None if created else instance.pk
    previous = _previous_instances.pop(lookup_key, None)

    if created:
        # New membership: create "Joined" journey entry
        defaults = _build_joined_journey_defaults(instance)
        Journey.objects.create(user=instance.member, **defaults)
    else:
        # Existing membership updated: check for changes
        if previous:
            # Check if is_active changed
            if previous.is_active != instance.is_active:
                if previous.is_active and not instance.is_active:
                    # Changed from active to inactive: create "Became Inactive" entry
                    defaults = _build_inactive_journey_defaults(instance)
                    Journey.objects.create(user=instance.member, **defaults)
                elif not previous.is_active and instance.is_active:
                    # Changed from inactive to active: create "Rejoined" entry
                    defaults = _build_rejoined_journey_defaults(instance)
                    Journey.objects.create(user=instance.member, **defaults)

            # Check if role changed
            if previous.role != instance.role:
                # Update the existing "Joined" journey entry with new role
                joined_journey = _find_joined_journey(instance)
                if joined_journey:
                    role_display = instance.get_role_display()
                    joined_journey.description = (
                        f"Joined {instance.ministry.name} "
                        f"as {role_display} "
                        f"on {instance.join_date.isoformat()}"
                    )
                    joined_journey.save(update_fields=["description"])


@receiver(post_delete, sender=MinistryMember)
def create_left_journey(sender, instance: MinistryMember, **kwargs):
    """Create a 'Left' journey entry when a ministry membership is deleted."""
    try:
        # Access member and ministry before deletion completes
        member = instance.member
        ministry = instance.ministry
        defaults = _build_left_journey_defaults(instance)
        Journey.objects.create(user=member, **defaults)
    except (AttributeError, Journey.DoesNotExist):
        # Handle gracefully if there are any issues (e.g., member or ministry already deleted)
        pass

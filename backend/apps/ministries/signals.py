"""
Django signals for Ministry model to sync coordinators with MinistryMember entries.

These signals ensure that coordinator assignments are automatically synced to MinistryMember
records even when Ministry is updated outside the serializer (e.g., admin panel, direct model updates).
"""

from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver

from .models import Ministry
from .utils import sync_coordinators_to_members


@receiver(post_save, sender=Ministry)
def sync_ministry_coordinators(sender, instance, **kwargs):
    """
    Signal handler to sync coordinators when Ministry is saved.
    This handles changes to primary_coordinator field.
    """
    # Only sync if this is not a raw save (e.g., from fixtures)
    if not kwargs.get("raw", False):
        sync_coordinators_to_members(instance)


@receiver(m2m_changed, sender=Ministry.support_coordinators.through)
def sync_support_coordinators(sender, instance, action, **kwargs):
    """
    Signal handler to sync coordinators when support_coordinators ManyToMany is changed.
    This handles additions and removals from support_coordinators.
    """
    # Only sync on post_add, post_remove, and post_clear actions
    # (post_clear happens when all are removed)
    if action in ("post_add", "post_remove", "post_clear"):
        sync_coordinators_to_members(instance)

"""Evangelism group roster counts that stay correct under outer JOINs."""

from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

from apps.people.models import ModuleCoordinator

from .models import EvangelismGroup


def _count_subquery(annotation):
    return Coalesce(
        Subquery(
            EvangelismGroup.objects.filter(pk=OuterRef("pk"))
            .order_by()
            .annotate(_c=annotation)
            .values("_c")[:1],
            output_field=IntegerField(),
        ),
        0,
    )


def annotate_evangelism_group_counts(queryset):
    """Attach members/visitors/conversions counts and Bible Sharer presence."""
    members_count = _count_subquery(
        Count(
            "members",
            filter=~Q(members__role__in=["ADMIN", "VISITOR"]),
            distinct=True,
        )
    )
    visitor_members = _count_subquery(
        Count("members", filter=Q(members__role="VISITOR"), distinct=True)
    )
    invited_visitors = _count_subquery(
        Count(
            "prospects",
            filter=Q(prospects__is_dropped_off=False),
            distinct=True,
        )
    )
    conversions_count = _count_subquery(Count("conversions", distinct=True))
    has_bible_sharers = Exists(
        ModuleCoordinator.objects.filter(
            module=ModuleCoordinator.ModuleType.EVANGELISM,
            level=ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            resource_id=OuterRef("pk"),
        )
    )
    return queryset.annotate(
        members_count=members_count,
        visitors_count=visitor_members + invited_visitors,
        conversions_count=conversions_count,
        has_bible_sharers=has_bible_sharers,
    )

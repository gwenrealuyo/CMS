import django_filters
from django.db.models import Q

from .models import Conversion, EvangelismGroup, Prospect
from .services import _prospect_branch_q


class ProspectFilter(django_filters.FilterSet):
    """List filters for invited visitors / prospects."""

    invited_by = django_filters.NumberFilter(field_name="invited_by_id")
    inviter_cluster = django_filters.NumberFilter(field_name="inviter_cluster_id")
    evangelism_group = django_filters.NumberFilter(field_name="evangelism_group_id")
    endorsed_cluster = django_filters.NumberFilter(field_name="endorsed_cluster_id")
    pipeline_stage = django_filters.CharFilter(field_name="pipeline_stage")
    is_dropped_off = django_filters.BooleanFilter(field_name="is_dropped_off")
    person_isnull = django_filters.BooleanFilter(
        field_name="person", lookup_expr="isnull"
    )
    branch = django_filters.NumberFilter(method="filter_branch")
    cluster = django_filters.NumberFilter(method="filter_cluster")
    source = django_filters.CharFilter(method="filter_source")

    class Meta:
        model = Prospect
        fields = []

    def filter_branch(self, queryset, name, value):
        return queryset.filter(_prospect_branch_q(value)).distinct()

    def filter_cluster(self, queryset, name, value):
        return queryset.filter(
            Q(inviter_cluster_id=value) | Q(endorsed_cluster_id=value)
        ).distinct()

    def filter_source(self, queryset, name, value):
        """Cluster source is explicit attribution, not the inviter's own cluster."""
        has_cluster = Q(inviter_cluster_id__isnull=False) | Q(
            endorsed_cluster_id__isnull=False
        )
        if value == "evangelism":
            return queryset.filter(evangelism_group_id__isnull=False)
        if value == "cluster":
            return queryset.filter(evangelism_group_id__isnull=True).filter(has_cluster)
        if value == "both":
            return queryset.filter(evangelism_group_id__isnull=False).filter(has_cluster)
        return queryset


class EvangelismGroupFilter(django_filters.FilterSet):
    """Server-side filters for the evangelism groups directory."""

    cluster = django_filters.NumberFilter(field_name="cluster_id")
    branch = django_filters.NumberFilter(field_name="cluster__branch_id")
    is_active = django_filters.BooleanFilter(field_name="is_active")

    name = django_filters.CharFilter(field_name="name", lookup_expr="iexact")
    name__icontains = django_filters.CharFilter(
        field_name="name", lookup_expr="icontains"
    )
    name__istartswith = django_filters.CharFilter(
        field_name="name", lookup_expr="istartswith"
    )
    name__iendswith = django_filters.CharFilter(
        field_name="name", lookup_expr="iendswith"
    )
    name_ne = django_filters.CharFilter(
        field_name="name", lookup_expr="iexact", exclude=True
    )

    description = django_filters.CharFilter(
        field_name="description", lookup_expr="iexact"
    )
    description__icontains = django_filters.CharFilter(
        field_name="description", lookup_expr="icontains"
    )
    description__istartswith = django_filters.CharFilter(
        field_name="description", lookup_expr="istartswith"
    )
    description__iendswith = django_filters.CharFilter(
        field_name="description", lookup_expr="iendswith"
    )

    location = django_filters.CharFilter(field_name="location", lookup_expr="iexact")
    location__icontains = django_filters.CharFilter(
        field_name="location", lookup_expr="icontains"
    )

    meeting_schedule__icontains = django_filters.CharFilter(
        method="filter_meeting_schedule"
    )

    coordinator = django_filters.CharFilter(method="filter_coordinator")
    coordinator__icontains = django_filters.CharFilter(method="filter_coordinator")

    cluster_code = django_filters.CharFilter(
        field_name="cluster__code", lookup_expr="iexact"
    )
    cluster_code__icontains = django_filters.CharFilter(
        field_name="cluster__code", lookup_expr="icontains"
    )
    cluster_code__istartswith = django_filters.CharFilter(
        field_name="cluster__code", lookup_expr="istartswith"
    )

    members_count = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="exact"
    )
    members_count_min = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="gte"
    )
    members_count_max = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="lte"
    )
    member_count = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="exact"
    )
    member_count_min = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="gte"
    )
    member_count_max = django_filters.NumberFilter(
        field_name="members_count", lookup_expr="lte"
    )

    visitors_count = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="exact"
    )
    visitors_count_min = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="gte"
    )
    visitors_count_max = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="lte"
    )
    visitor_count = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="exact"
    )
    visitor_count_min = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="gte"
    )
    visitor_count_max = django_filters.NumberFilter(
        field_name="visitors_count", lookup_expr="lte"
    )

    has_bible_sharers = django_filters.BooleanFilter(field_name="has_bible_sharers")

    class Meta:
        model = EvangelismGroup
        fields = []

    def filter_meeting_schedule(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(meeting_day__icontains=value) | Q(location__icontains=value)
        )

    def filter_coordinator(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(coordinator__first_name__icontains=value)
            | Q(coordinator__last_name__icontains=value)
            | Q(coordinator__username__icontains=value)
        ).distinct()


class ConversionFilter(django_filters.FilterSet):
    converted_by = django_filters.NumberFilter(field_name="converted_by_id")
    cluster = django_filters.NumberFilter(field_name="cluster_id")
    evangelism_group = django_filters.NumberFilter(field_name="evangelism_group_id")
    year = django_filters.NumberFilter(field_name="conversion_date", lookup_expr="year")
    person = django_filters.NumberFilter(field_name="person_id")
    person_id__in = django_filters.BaseInFilter(field_name="person_id")

    class Meta:
        model = Conversion
        fields = []

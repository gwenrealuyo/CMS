import django_filters

from .models import Cluster


class ClusterFilter(django_filters.FilterSet):
    """Server-side filters for the clusters directory."""

    branch = django_filters.NumberFilter(field_name="branch_id")
    branch_id = django_filters.NumberFilter(field_name="branch_id")

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

    code = django_filters.CharFilter(field_name="code", lookup_expr="iexact")
    code__icontains = django_filters.CharFilter(
        field_name="code", lookup_expr="icontains"
    )
    code__istartswith = django_filters.CharFilter(
        field_name="code", lookup_expr="istartswith"
    )

    location = django_filters.CharFilter(field_name="location", lookup_expr="iexact")
    location__icontains = django_filters.CharFilter(
        field_name="location", lookup_expr="icontains"
    )

    meeting_schedule__icontains = django_filters.CharFilter(
        field_name="meeting_schedule", lookup_expr="icontains"
    )

    member_count = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="exact"
    )
    member_count_min = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="gte"
    )
    member_count_max = django_filters.NumberFilter(
        field_name="member_count", lookup_expr="lte"
    )

    visitor_count = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="exact"
    )
    visitor_count_min = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="gte"
    )
    visitor_count_max = django_filters.NumberFilter(
        field_name="visitor_count", lookup_expr="lte"
    )

    family_count = django_filters.NumberFilter(
        field_name="family_count", lookup_expr="exact"
    )
    family_count_min = django_filters.NumberFilter(
        field_name="family_count", lookup_expr="gte"
    )
    family_count_max = django_filters.NumberFilter(
        field_name="family_count", lookup_expr="lte"
    )

    class Meta:
        model = Cluster
        fields = []

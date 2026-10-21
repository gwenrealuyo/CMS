"""Serializers for 5x5 Cord APIs."""

from rest_framework import serializers

from apps.people.models import MemberCareCase, Person

from .cords import (
    default_cord_name,
    eligible_members_queryset,
    invited_visitor_summary,
    invited_visitors_queryset,
    person_summary,
    set_cord_members,
    size_warning_for_count,
    validate_cord_member_ids,
)
from .models import ClusterCord, ClusterCordMembership


OPEN_CARE_STATUSES = (
    MemberCareCase.CaseStatus.OPEN,
    MemberCareCase.CaseStatus.IN_PROGRESS,
    MemberCareCase.CaseStatus.NO_ACTION,
)


class ClusterCordSerializer(serializers.ModelSerializer):
    sub_coordinator_id = serializers.PrimaryKeyRelatedField(
        source="sub_coordinator",
        queryset=Person.objects.exclude(role="ADMIN"),
        required=False,
        allow_null=True,
    )
    sub_coordinator = serializers.SerializerMethodField()
    members = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
    )
    members_details = serializers.SerializerMethodField()
    invited_visitors = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    size_warning = serializers.SerializerMethodField()
    warnings = serializers.SerializerMethodField()
    care_summary = serializers.SerializerMethodField()
    cluster_id = serializers.IntegerField(source="cluster.id", read_only=True)

    class Meta:
        model = ClusterCord
        fields = [
            "id",
            "cluster_id",
            "name",
            "sub_coordinator",
            "sub_coordinator_id",
            "members",
            "members_details",
            "invited_visitors",
            "member_count",
            "size_warning",
            "warnings",
            "care_summary",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "cluster_id",
            "sub_coordinator",
            "members_details",
            "invited_visitors",
            "member_count",
            "size_warning",
            "warnings",
            "care_summary",
            "created_at",
            "updated_at",
        ]
    def get_sub_coordinator(self, obj):
        return person_summary(obj.sub_coordinator)

    def _member_people(self, obj):
        memberships = getattr(obj, "_prefetched_objects_cache", {}).get("memberships")
        if memberships is not None:
            return [m.person for m in memberships]
        return [m.person for m in obj.memberships.select_related("person").all()]

    def get_members_details(self, obj):
        return [person_summary(p) for p in self._member_people(obj)]

    def get_invited_visitors(self, obj):
        """Visitors whose inviter is a member of this cord (display-only on card)."""
        by_cord = self.context.get("invited_visitors_by_cord")
        if by_cord is not None:
            return by_cord.get(obj.id, [])
        member_ids = [p.id for p in self._member_people(obj)]
        return [
            invited_visitor_summary(v)
            for v in invited_visitors_queryset(member_ids)
        ]

    def get_member_count(self, obj):
        if hasattr(obj, "annotated_member_count"):
            return obj.annotated_member_count
        return obj.memberships.count()

    def get_size_warning(self, obj):
        return size_warning_for_count(self.get_member_count(obj))

    def get_warnings(self, obj):
        warning = self.get_size_warning(obj)
        return [warning] if warning else []

    def get_care_summary(self, obj):
        """Open Member Care cases for cord members (existing cluster care feature)."""
        from core.datetime_utils import church_today

        care_by_person = self.context.get("care_by_person")
        member_ids = [p.id for p in self._member_people(obj)]
        if care_by_person is not None:
            cases = [care_by_person[pid] for pid in member_ids if pid in care_by_person]
        else:
            cases = list(
                MemberCareCase.objects.filter(
                    person_id__in=member_ids,
                    case_status__in=OPEN_CARE_STATUSES,
                )
            )
        open_count = len(cases)
        today = church_today()
        needs_attention = 0
        for case in cases:
            if case.case_status not in (
                MemberCareCase.CaseStatus.OPEN,
                MemberCareCase.CaseStatus.IN_PROGRESS,
            ):
                continue
            if not (case.recommended_action or "").strip():
                needs_attention += 1
            elif case.due_date and case.due_date < today:
                needs_attention += 1
        return {
            "open_count": open_count,
            "needs_attention_count": needs_attention,
        }

    def validate_name(self, value):
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Name is required.")
        return name

    def validate(self, attrs):
        cluster = self.context["cluster"]
        instance = self.instance
        name = attrs.get("name")
        if name is None and instance is not None:
            name = instance.name
        if name:
            qs = ClusterCord.objects.filter(
                cluster=cluster, name=name, is_active=True
            )
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"name": "An active cord with this name already exists in the cluster."}
                )

        member_ids = attrs.get("members", serializers.empty)
        if member_ids is serializers.empty:
            if instance is None:
                member_ids = []
            else:
                member_ids = list(
                    instance.memberships.values_list("person_id", flat=True)
                )
        else:
            try:
                member_ids = validate_cord_member_ids(
                    cluster,
                    member_ids,
                    exclude_cord_id=instance.id if instance else None,
                )
            except ValueError as exc:
                raise serializers.ValidationError({"members": str(exc)}) from exc
        attrs["_validated_member_ids"] = member_ids

        sub = attrs.get("sub_coordinator", serializers.empty)
        if sub is serializers.empty:
            sub = instance.sub_coordinator if instance else None
        if sub is not None:
            if sub.id not in member_ids:
                raise serializers.ValidationError(
                    {
                        "sub_coordinator_id": (
                            "Sub-coordinator must be a member of this cord."
                        )
                    }
                )
        elif member_ids:
            raise serializers.ValidationError(
                {
                    "sub_coordinator_id": (
                        "Sub-coordinator is required when the cord has members."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        from apps.clusters.coordinator_assignments import (
            sync_cord_sub_coordinator_reporters,
        )

        member_ids = validated_data.pop("_validated_member_ids", [])
        validated_data.pop("members", None)
        cluster = self.context["cluster"]
        name = validated_data.get("name") or default_cord_name(cluster)
        cord = ClusterCord.objects.create(
            cluster=cluster,
            name=name,
            sub_coordinator=validated_data.get("sub_coordinator"),
            is_active=True,
        )
        set_cord_members(cord, member_ids)
        sync_cord_sub_coordinator_reporters(cluster)
        return cord

    def update(self, instance, validated_data):
        from apps.clusters.coordinator_assignments import (
            sync_cord_sub_coordinator_reporters,
        )

        member_ids = validated_data.pop("_validated_member_ids", None)
        validated_data.pop("members", None)
        for field in ("name", "sub_coordinator", "is_active"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        if member_ids is not None:
            set_cord_members(instance, member_ids)
            if (
                instance.sub_coordinator_id
                and instance.sub_coordinator_id not in member_ids
            ):
                instance.sub_coordinator = None
                instance.save(update_fields=["sub_coordinator", "updated_at"])
        sync_cord_sub_coordinator_reporters(instance.cluster)
        return instance


def build_eligible_members_payload(cluster) -> list[dict]:
    assigned = {
        m.person_id: (m.cord_id, m.cord.name)
        for m in ClusterCordMembership.objects.filter(
            cord__cluster=cluster, cord__is_active=True
        ).select_related("cord")
    }
    rows = []
    for person in eligible_members_queryset(cluster).order_by(
        "last_name", "first_name", "id"
    ):
        cord_id, cord_name = assigned.get(person.id, (None, None))
        summary = person_summary(person)
        summary["assigned_cord_id"] = cord_id
        summary["assigned_cord_name"] = cord_name
        rows.append(summary)
    return rows


def build_care_by_person_for_cluster(cluster) -> dict[int, MemberCareCase]:
    """Map person_id → open care case for people on this cluster's cords."""
    person_ids = ClusterCordMembership.objects.filter(
        cord__cluster=cluster, cord__is_active=True
    ).values_list("person_id", flat=True)
    cases = MemberCareCase.objects.filter(
        person_id__in=person_ids,
        case_status__in=OPEN_CARE_STATUSES,
    )
    return {c.person_id: c for c in cases}

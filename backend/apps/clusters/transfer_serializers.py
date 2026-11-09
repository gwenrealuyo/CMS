"""Serializers for cluster transfer requests."""

from rest_framework import serializers

from apps.people.models import Person
from apps.people.name_formatting import format_person_display_name

from .models import Cluster, ClusterTransferRequest
from .transfer import submit_cluster_transfer_request


class _ClusterBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cluster
        fields = ["id", "code", "name"]


class _PersonBriefSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "username",
            "role",
            "status",
        ]

    def get_full_name(self, obj):
        return format_person_display_name(obj) or obj.username


class ClusterTransferRequestSerializer(serializers.ModelSerializer):
    person = _PersonBriefSerializer(read_only=True)
    from_cluster = _ClusterBriefSerializer(read_only=True)
    to_cluster = _ClusterBriefSerializer(read_only=True)
    requested_by = _PersonBriefSerializer(read_only=True)
    reviewed_by = _PersonBriefSerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(),
        source="person",
        write_only=True,
    )
    from_cluster_id = serializers.PrimaryKeyRelatedField(
        queryset=Cluster.objects.filter(is_active=True),
        source="from_cluster",
        write_only=True,
    )
    to_cluster_id = serializers.PrimaryKeyRelatedField(
        queryset=Cluster.objects.filter(is_active=True),
        source="to_cluster",
        write_only=True,
    )

    class Meta:
        model = ClusterTransferRequest
        fields = [
            "id",
            "person",
            "person_id",
            "from_cluster",
            "from_cluster_id",
            "to_cluster",
            "to_cluster_id",
            "requested_by",
            "status",
            "reason",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "person",
            "from_cluster",
            "to_cluster",
            "requested_by",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "reason": {"required": True, "allow_blank": False},
        }

    def validate_reason(self, value: str) -> str:
        trimmed = (value or "").strip()
        if not trimmed:
            raise serializers.ValidationError("Reason is required.")
        return trimmed

    def create(self, validated_data):
        request = self.context.get("request")
        requested_by = (
            request.user
            if request and getattr(request, "user", None) and request.user.is_authenticated
            else None
        )
        return submit_cluster_transfer_request(
            person=validated_data["person"],
            from_cluster=validated_data["from_cluster"],
            to_cluster=validated_data["to_cluster"],
            requested_by=requested_by,
            reason=validated_data["reason"],
        )


class ClusterTransferReviewSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")

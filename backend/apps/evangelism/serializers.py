from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.people.models import Person
from apps.clusters.models import Cluster

from .models import (
    EvangelismGroup,
    EvangelismGroupMember,
    EvangelismSession,
    EvangelismWeeklyReport,
    Prospect,
    FollowUpTask,
    DropOff,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
)

User = get_user_model()


class PersonSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "nickname",
            "full_name",
            "date_of_birth",
            "status",
            "role",
        )

    def get_full_name(self, obj):
        """Format name with middle initial, nickname, and suffix."""
        parts = []
        
        if obj.first_name:
            parts.append(obj.first_name.strip())
        
        if obj.nickname:
            parts.append(f'"{obj.nickname.strip()}"')
        
        if obj.middle_name:
            middle_initial = obj.middle_name.strip()[0].upper() if obj.middle_name.strip() else ""
            if middle_initial:
                parts.append(f"{middle_initial}.")
        
        if obj.last_name:
            parts.append(obj.last_name.strip())
        
        if obj.suffix:
            parts.append(obj.suffix.strip())
        
        name = " ".join(parts).strip()
        return name or obj.username


class ClusterSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Cluster
        fields = ("id", "name", "code")


class EvangelismGroupMemberSerializer(serializers.ModelSerializer):
    person = PersonSummarySerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.all(),
        write_only=True,
    )
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = EvangelismGroupMember
        fields = (
            "id",
            "evangelism_group",
            "person",
            "person_id",
            "role",
            "role_display",
            "joined_date",
            "is_active",
            "notes",
        )
        read_only_fields = ("joined_date",)


class EvangelismGroupSerializer(serializers.ModelSerializer):
    coordinator = PersonSummarySerializer(read_only=True)
    coordinator_id = serializers.PrimaryKeyRelatedField(
        source="coordinator",
        queryset=Person.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    cluster = ClusterSummarySerializer(read_only=True)
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="cluster",
        queryset=Cluster.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    members = EvangelismGroupMemberSerializer(many=True, read_only=True)
    members_count = serializers.SerializerMethodField()
    conversions_count = serializers.SerializerMethodField()

    class Meta:
        model = EvangelismGroup
        fields = (
            "id",
            "name",
            "description",
            "coordinator",
            "coordinator_id",
            "cluster",
            "cluster_id",
            "location",
            "meeting_time",
            "meeting_day",
            "is_active",
            "is_bible_sharers_group",
            "created_at",
            "updated_at",
            "members",
            "members_count",
            "conversions_count",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_members_count(self, obj):
        return obj.members.filter(is_active=True).count()

    def get_conversions_count(self, obj):
        return obj.conversions.count()


class EvangelismBulkEnrollSerializer(serializers.Serializer):
    person_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
    role = serializers.ChoiceField(choices=EvangelismGroupMember.Role.choices)


class EvangelismSessionSerializer(serializers.ModelSerializer):
    evangelism_group = EvangelismGroupSerializer(read_only=True)
    evangelism_group_id = serializers.PrimaryKeyRelatedField(
        source="evangelism_group",
        queryset=EvangelismGroup.objects.all(),
        write_only=True,
    )
    event_id = serializers.IntegerField(source="event.id", read_only=True, allow_null=True)
    create_event = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = EvangelismSession
        fields = (
            "id",
            "evangelism_group",
            "evangelism_group_id",
            "event",
            "event_id",
            "session_date",
            "session_time",
            "topic",
            "notes",
            "is_recurring_instance",
            "recurring_group_id",
            "create_event",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("event", "created_at", "updated_at")


class EvangelismRecurringSessionSerializer(serializers.Serializer):
    evangelism_group_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    num_occurrences = serializers.IntegerField(required=False, min_value=1, max_value=52)
    recurrence_pattern = serializers.ChoiceField(
        choices=[
            ("weekly", "Weekly"),
            ("bi_weekly", "Bi-weekly"),
            ("monthly", "Monthly"),
        ]
    )
    day_of_week = serializers.IntegerField(
        required=False, min_value=0, max_value=6, help_text="0=Monday, 6=Sunday"
    )
    default_topic = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate(self, attrs):
        if not attrs.get("end_date") and not attrs.get("num_occurrences"):
            raise serializers.ValidationError(
                "Either end_date or num_occurrences must be provided."
            )
        if attrs.get("recurrence_pattern") == "weekly" and attrs.get("day_of_week") is None:
            raise serializers.ValidationError("day_of_week is required for weekly recurrence.")
        return attrs


class EvangelismWeeklyReportSerializer(serializers.ModelSerializer):
    evangelism_group = EvangelismGroupSerializer(read_only=True)
    members_attended_details = serializers.SerializerMethodField()
    visitors_attended_details = serializers.SerializerMethodField()
    submitted_by_details = PersonSummarySerializer(source="submitted_by", read_only=True)

    class Meta:
        model = EvangelismWeeklyReport
        fields = (
            "id",
            "evangelism_group",
            "year",
            "week_number",
            "meeting_date",
            "members_attended",
            "visitors_attended",
            "members_attended_details",
            "visitors_attended_details",
            "gathering_type",
            "topic",
            "activities_held",
            "prayer_requests",
            "testimonies",
            "new_prospects",
            "conversions_this_week",
            "notes",
            "submitted_by",
            "submitted_by_details",
            "submitted_at",
            "updated_at",
        )
        read_only_fields = ("submitted_at", "updated_at")

    def get_members_attended_details(self, obj):
        return PersonSummarySerializer(obj.members_attended.all(), many=True).data

    def get_visitors_attended_details(self, obj):
        return PersonSummarySerializer(obj.visitors_attended.all(), many=True).data


class ProspectSerializer(serializers.ModelSerializer):
    invited_by = PersonSummarySerializer(read_only=True)
    invited_by_id = serializers.PrimaryKeyRelatedField(
        source="invited_by",
        queryset=Person.objects.all(),
        write_only=True,
    )
    inviter_cluster = ClusterSummarySerializer(read_only=True)
    evangelism_group = EvangelismGroupSerializer(read_only=True)
    evangelism_group_id = serializers.PrimaryKeyRelatedField(
        source="evangelism_group",
        queryset=EvangelismGroup.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    endorsed_cluster = ClusterSummarySerializer(read_only=True)
    endorsed_cluster_id = serializers.PrimaryKeyRelatedField(
        source="endorsed_cluster",
        queryset=Cluster.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    person = PersonSummarySerializer(read_only=True)
    pipeline_stage_display = serializers.CharField(source="get_pipeline_stage_display", read_only=True)
    days_since_last_activity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Prospect
        fields = (
            "id",
            "name",
            "contact_info",
            "invited_by",
            "invited_by_id",
            "inviter_cluster",
            "evangelism_group",
            "evangelism_group_id",
            "endorsed_cluster",
            "endorsed_cluster_id",
            "person",
            "pipeline_stage",
            "pipeline_stage_display",
            "first_contact_date",
            "last_activity_date",
            "is_attending_cluster",
            "is_dropped_off",
            "drop_off_date",
            "drop_off_stage",
            "drop_off_reason",
            "has_finished_lessons",
            "commitment_form_signed",
            "fast_track_reason",
            "notes",
            "days_since_last_activity",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "days_since_last_activity")


class FollowUpTaskSerializer(serializers.ModelSerializer):
    prospect = ProspectSerializer(read_only=True)
    prospect_id = serializers.PrimaryKeyRelatedField(
        source="prospect",
        queryset=Prospect.objects.all(),
        write_only=True,
    )
    assigned_to = PersonSummarySerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=Person.objects.all(),
        write_only=True,
    )
    created_by = PersonSummarySerializer(read_only=True)
    created_by_id = serializers.PrimaryKeyRelatedField(
        source="created_by",
        queryset=Person.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    task_type_display = serializers.CharField(source="get_task_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = FollowUpTask
        fields = (
            "id",
            "prospect",
            "prospect_id",
            "assigned_to",
            "assigned_to_id",
            "task_type",
            "task_type_display",
            "due_date",
            "completed_date",
            "status",
            "status_display",
            "notes",
            "priority",
            "priority_display",
            "created_by",
            "created_by_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class DropOffSerializer(serializers.ModelSerializer):
    prospect = ProspectSerializer(read_only=True)
    drop_off_stage_display = serializers.CharField(source="get_drop_off_stage_display", read_only=True)
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = DropOff
        fields = (
            "id",
            "prospect",
            "drop_off_date",
            "drop_off_stage",
            "drop_off_stage_display",
            "days_inactive",
            "reason",
            "reason_display",
            "reason_details",
            "recovery_attempted",
            "recovery_date",
            "recovered",
            "recovered_date",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class ConversionSerializer(serializers.ModelSerializer):
    person = PersonSummarySerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.all(),
        write_only=True,
    )
    prospect = ProspectSerializer(read_only=True)
    prospect_id = serializers.PrimaryKeyRelatedField(
        source="prospect",
        queryset=Prospect.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    converted_by = PersonSummarySerializer(read_only=True)
    converted_by_id = serializers.PrimaryKeyRelatedField(
        source="converted_by",
        queryset=Person.objects.all(),
        write_only=True,
    )
    evangelism_group = EvangelismGroupSerializer(read_only=True)
    evangelism_group_id = serializers.PrimaryKeyRelatedField(
        source="evangelism_group",
        queryset=EvangelismGroup.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    cluster = ClusterSummarySerializer(read_only=True)
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="cluster",
        queryset=Cluster.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    verified_by = PersonSummarySerializer(read_only=True)
    verified_by_id = serializers.PrimaryKeyRelatedField(
        source="verified_by",
        queryset=Person.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Conversion
        fields = (
            "id",
            "person",
            "person_id",
            "prospect",
            "prospect_id",
            "converted_by",
            "converted_by_id",
            "evangelism_group",
            "evangelism_group_id",
            "cluster",
            "cluster_id",
            "conversion_date",
            "water_baptism_date",
            "spirit_baptism_date",
            "is_complete",
            "notes",
            "verified_by",
            "verified_by_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class MonthlyConversionTrackingSerializer(serializers.ModelSerializer):
    cluster = ClusterSummarySerializer(read_only=True)
    prospect = ProspectSerializer(read_only=True)
    person = PersonSummarySerializer(read_only=True)
    stage_display = serializers.CharField(source="get_stage_display", read_only=True)

    class Meta:
        model = MonthlyConversionTracking
        fields = (
            "id",
            "cluster",
            "prospect",
            "person",
            "year",
            "month",
            "stage",
            "stage_display",
            "count",
            "first_date_in_stage",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class MonthlyStatisticsSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    cluster_id = serializers.IntegerField()
    cluster_name = serializers.CharField()
    invited_count = serializers.IntegerField()
    attended_count = serializers.IntegerField()
    baptized_count = serializers.IntegerField()
    received_hg_count = serializers.IntegerField()
    converted_count = serializers.IntegerField()


class Each1Reach1GoalSerializer(serializers.ModelSerializer):
    cluster = ClusterSummarySerializer(read_only=True)
    cluster_id = serializers.PrimaryKeyRelatedField(
        source="cluster",
        queryset=Cluster.objects.all(),
        write_only=True,
    )
    progress_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = Each1Reach1Goal
        fields = (
            "id",
            "cluster",
            "cluster_id",
            "year",
            "target_conversions",
            "achieved_conversions",
            "status",
            "progress_percentage",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "progress_percentage")


class EvangelismSummarySerializer(serializers.Serializer):
    total_groups = serializers.IntegerField()
    active_groups = serializers.IntegerField()
    total_prospects = serializers.IntegerField()
    total_conversions = serializers.IntegerField()
    monthly_statistics = MonthlyStatisticsSerializer(many=True, required=False)


class VisitorProgressSerializer(serializers.Serializer):
    prospect_id = serializers.IntegerField()
    prospect_name = serializers.CharField()
    current_stage = serializers.CharField()
    stage_history = serializers.ListField()
    days_in_current_stage = serializers.IntegerField()


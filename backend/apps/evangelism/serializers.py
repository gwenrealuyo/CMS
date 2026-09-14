from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.people.models import ModuleCoordinator, Person
from apps.people.baptism_verifiers import (
    BAPTISM_JOURNEY_TYPE,
    SPIRIT_JOURNEY_TYPE,
    UNSET as BAPTISM_VERIFIER_UNSET,
    baptism_verifier_queryset,
    historical_verifier_names,
    journey_verified_by,
    person_verifier_display_name,
    validate_historical_name_pair,
)
from apps.people.name_formatting import (
    PROSPECT_NAME_FIELDS,
    apply_title_case_name_fields,
)
from apps.clusters.models import Cluster

from core.datetime_utils import church_today

from .coordinator_assignments import (
    prune_evangelism_role_assignments_to_members,
    sync_evangelism_bible_sharer_assignments,
    sync_evangelism_coordinator_module_assignment,
    sync_evangelism_reporter_assignments,
)
from .models import (
    EvangelismGroup,
    EvangelismSession,
    EvangelismWeeklyReport,
    Prospect,
    FollowUpTask,
    DropOff,
    Conversion,
    MonthlyConversionTracking,
    Each1Reach1Goal,
)
from .services import (
    create_invited_prospect_for_evangelism_group,
    find_duplicate_invited_prospects_for_group,
    get_default_each1reach1_target,
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


class PersonConversionNestedSerializer(PersonSummarySerializer):
    """Person fields needed on Conversion responses without widening all PersonSummary uses."""

    lesson_teacher_display_name = serializers.SerializerMethodField()

    class Meta(PersonSummarySerializer.Meta):
        fields = tuple(PersonSummarySerializer.Meta.fields) + (
            "date_first_invited",
            "date_first_attended",
            "lesson_teacher_display_name",
        )

    def get_lesson_teacher_display_name(self, obj):
        enrollment = getattr(obj, "lesson_enrollment", None)
        if not enrollment:
            return None
        return enrollment.teacher_display_name()


class ClusterSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Cluster
        fields = ("id", "name", "code")


class EvangelismGroupSerializer(serializers.ModelSerializer):
    coordinator = PersonSummarySerializer(read_only=True)
    coordinator_id = serializers.PrimaryKeyRelatedField(
        source="coordinator",
        queryset=Person.objects.exclude(role="ADMIN"),
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
    members = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Person.objects.exclude(role__in=["ADMIN", "VISITOR"]),
        required=False,
        allow_empty=True,
    )
    members_count = serializers.SerializerMethodField()
    visitors_count = serializers.SerializerMethodField()
    conversions_count = serializers.SerializerMethodField()
    reporter_ids = serializers.SerializerMethodField()
    bible_sharer_ids = serializers.SerializerMethodField()

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
            "visitors_count",
            "conversions_count",
            "reporter_ids",
            "bible_sharer_ids",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "reporter_ids",
            "bible_sharer_ids",
        )

    def validate_meeting_time(self, value):
        if value in ("", None):
            return None
        return value

    def _assignment_ids_from_map(self, context_key, level, obj):
        assignment_map = self.context.get(context_key)
        if assignment_map is not None:
            return assignment_map.get(obj.id, [])
        return list(
            ModuleCoordinator.objects.filter(
                module=ModuleCoordinator.ModuleType.EVANGELISM,
                level=level,
                resource_id=obj.id,
            ).values_list("person_id", flat=True)
        )

    def get_reporter_ids(self, obj):
        return self._assignment_ids_from_map(
            "evangelism_reporter_ids_map",
            ModuleCoordinator.CoordinatorLevel.REPORTER,
            obj,
        )

    def get_bible_sharer_ids(self, obj):
        return self._assignment_ids_from_map(
            "evangelism_bible_sharer_ids_map",
            ModuleCoordinator.CoordinatorLevel.BIBLE_SHARER,
            obj,
        )

    def _parse_person_id_list(self, field_name: str):
        if field_name not in self.initial_data:
            return None
        raw = self.initial_data.get(field_name)
        if raw is None:
            raw = []
        if not isinstance(raw, list):
            raise serializers.ValidationError(
                {field_name: "Expected a list of person IDs."}
            )
        parsed: list[int] = []
        for item in raw:
            try:
                parsed.append(int(item))
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {field_name: "Each ID must be an integer."}
                )
        if len(parsed) != len(set(parsed)):
            raise serializers.ValidationError(
                {field_name: "Duplicate IDs are not allowed."}
            )
        return parsed

    def _resolved_coordinator_id(self, attrs):
        coordinator = attrs.get("coordinator", serializers.empty)
        if coordinator is serializers.empty:
            return self.instance.coordinator_id if self.instance else None
        return coordinator.id if coordinator else None

    def _resolved_member_ids(self, attrs, coordinator_id):
        members = attrs.get("members", serializers.empty)
        if members is serializers.empty:
            member_ids = (
                set(self.instance.members.values_list("id", flat=True))
                if self.instance
                else set()
            )
        else:
            member_ids = {m.id for m in members}
        if coordinator_id is not None:
            member_ids.add(coordinator_id)
        return member_ids

    def _validate_role_ids(self, field_name, role_ids, coordinator_id, member_ids, role_label):
        if coordinator_id is not None and coordinator_id in role_ids:
            raise serializers.ValidationError(
                {
                    field_name: (
                        f"The group coordinator cannot also be a {role_label}."
                    )
                }
            )
        invalid = [rid for rid in role_ids if rid not in member_ids]
        if invalid:
            raise serializers.ValidationError(
                {
                    field_name: (
                        f"{role_label.title()}s must be group members. "
                        f"Invalid IDs: {invalid}"
                    )
                }
            )
        existing_ids = set(
            Person.objects.filter(id__in=role_ids)
            .exclude(role__in=["ADMIN", "VISITOR"])
            .values_list("id", flat=True)
        )
        missing = [rid for rid in role_ids if rid not in existing_ids]
        if missing:
            raise serializers.ValidationError(
                {field_name: f"Unknown person IDs: {missing}"}
            )

    def _group_cluster_is_headquarters(self, attrs) -> bool:
        cluster = attrs.get("cluster", serializers.empty)
        if cluster is serializers.empty:
            cluster = self.instance.cluster if self.instance else None
        if cluster is None:
            return False
        branch = getattr(cluster, "branch", None)
        if branch is None:
            return False
        return bool(getattr(branch, "is_headquarters", False))

    def validate(self, attrs):
        attrs = super().validate(attrs)
        coordinator_id = self._resolved_coordinator_id(attrs)
        member_ids = self._resolved_member_ids(attrs, coordinator_id)

        reporter_ids = self._parse_person_id_list("reporter_ids")
        if reporter_ids is not None:
            self._validate_role_ids(
                "reporter_ids",
                reporter_ids,
                coordinator_id,
                member_ids,
                "reporter",
            )
            attrs["_reporter_ids"] = reporter_ids

        bible_sharer_ids = self._parse_person_id_list("bible_sharer_ids")
        if bible_sharer_ids is not None:
            self._validate_role_ids(
                "bible_sharer_ids",
                bible_sharer_ids,
                coordinator_id,
                member_ids,
                "Bible Sharer",
            )
            if self._group_cluster_is_headquarters(attrs) and bible_sharer_ids:
                from apps.ministries.bible_sharers import (
                    bible_sharers_roster_person_ids,
                    ensure_bible_sharers_ministry,
                )

                ensure_bible_sharers_ministry()
                roster_ids = bible_sharers_roster_person_ids()
                not_on_roster = [
                    rid for rid in bible_sharer_ids if rid not in roster_ids
                ]
                if not_on_roster:
                    raise serializers.ValidationError(
                        {
                            "bible_sharer_ids": (
                                "Select a Bible Sharer from the headquarters "
                                "Bible Sharers roster (Ministries). Inactive "
                                "roster members remain selectable."
                            )
                        }
                    )
            attrs["_bible_sharer_ids"] = bible_sharer_ids

        return attrs

    def _sync_group_assignments(
        self,
        instance,
        previous_coordinator_id,
        members,
        reporter_ids,
        bible_sharer_ids,
    ):
        if members is not None:
            instance.members.set(members)
        if instance.coordinator_id:
            instance.members.add(instance.coordinator_id)
        sync_evangelism_coordinator_module_assignment(
            instance, previous_coordinator_id
        )
        if bible_sharer_ids is not serializers.empty:
            sync_evangelism_bible_sharer_assignments(instance, bible_sharer_ids)
        if reporter_ids is not serializers.empty:
            sync_evangelism_reporter_assignments(instance, reporter_ids)
        final_member_ids = instance.members.values_list("id", flat=True)
        prune_evangelism_role_assignments_to_members(instance, final_member_ids)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        members_qs = instance.members.exclude(role__in=["ADMIN", "VISITOR"])
        data["members"] = PersonSummarySerializer(members_qs, many=True).data
        return data

    def create(self, validated_data):
        members = validated_data.pop("members", None)
        reporter_ids = validated_data.pop("_reporter_ids", serializers.empty)
        bible_sharer_ids = validated_data.pop("_bible_sharer_ids", serializers.empty)
        instance = EvangelismGroup.objects.create(**validated_data)
        return self._sync_group_assignments(
            instance, None, members, reporter_ids, bible_sharer_ids
        )

    def update(self, instance, validated_data):
        previous_coordinator_id = instance.coordinator_id
        members = validated_data.pop("members", None)
        reporter_ids = validated_data.pop("_reporter_ids", serializers.empty)
        bible_sharer_ids = validated_data.pop("_bible_sharer_ids", serializers.empty)
        instance = super().update(instance, validated_data)
        return self._sync_group_assignments(
            instance,
            previous_coordinator_id,
            members,
            reporter_ids,
            bible_sharer_ids,
        )

    def get_members_count(self, obj):
        return obj.members.exclude(role__in=["ADMIN", "VISITOR"]).count()

    def get_visitors_count(self, obj):
        return (
            obj.prospects.filter(is_dropped_off=False).count()
            + obj.members.filter(role="VISITOR").count()
        )

    def get_conversions_count(self, obj):
        return obj.conversions.count()


class EvangelismBulkEnrollSerializer(serializers.Serializer):
    person_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )

    def validate_person_ids(self, person_ids):
        if Person.objects.filter(id__in=person_ids, role="VISITOR").exists():
            raise serializers.ValidationError(
                "Visitors cannot be added as evangelism group members."
            )
        return person_ids


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


class EvangelismReportNewInvitedProspectSerializer(serializers.Serializer):
    """Write-only payload for creating an INVITED prospect on an evangelism weekly report."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    invited_by_id = serializers.PrimaryKeyRelatedField(
        source="invited_by",
        queryset=Person.objects.exclude(role="ADMIN"),
    )
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    suffix = serializers.CharField(max_length=150, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=[("MALE", "Male"), ("FEMALE", "Female"), ("", "")],
        required=False,
        allow_blank=True,
    )
    contact_info = serializers.CharField(max_length=200, required=False, allow_blank=True)
    facebook_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    date_first_invited = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        apply_title_case_name_fields(attrs, PROSPECT_NAME_FIELDS)
        return attrs


class EvangelismWeeklyReportSerializer(serializers.ModelSerializer):
    evangelism_group = EvangelismGroupSerializer(read_only=True)
    evangelism_group_id = serializers.PrimaryKeyRelatedField(
        source="evangelism_group",
        queryset=EvangelismGroup.objects.all(),
        write_only=True,
    )
    members_attended_details = serializers.SerializerMethodField()
    visitors_attended_details = serializers.SerializerMethodField()
    prospects_invited = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Prospect.objects.all(),
        required=False,
    )
    new_invited_prospects = EvangelismReportNewInvitedProspectSerializer(
        many=True, required=False, write_only=True
    )
    prospects_invited_details = serializers.SerializerMethodField()
    submitted_by_details = PersonSummarySerializer(source="submitted_by", read_only=True)

    class Meta:
        model = EvangelismWeeklyReport
        fields = (
            "id",
            "evangelism_group",
            "evangelism_group_id",
            "year",
            "week_number",
            "meeting_date",
            "members_attended",
            "visitors_attended",
            "prospects_invited",
            "new_invited_prospects",
            "members_attended_details",
            "visitors_attended_details",
            "prospects_invited_details",
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
        read_only_fields = ("submitted_at", "updated_at", "new_prospects")

    def validate(self, attrs):
        group = attrs.get("evangelism_group")
        if group is None and self.instance:
            group = self.instance.evangelism_group
        members = attrs.get("members_attended")
        if group is not None and members is not None:
            allowed_ids = set(group.members.values_list("id", flat=True))
            if group.coordinator_id:
                allowed_ids.add(group.coordinator_id)

            invalid = [p.pk for p in members if p.pk not in allowed_ids]
            if invalid:
                raise serializers.ValidationError(
                    {
                        "members_attended": (
                            "Members attended must be active group members or the group coordinator. "
                            f"Invalid IDs: {invalid}"
                        )
                    }
                )

        new_invited = attrs.get("new_invited_prospects") or []
        prospects_invited = attrs.get("prospects_invited", serializers.empty)
        visitors_attended = attrs.get("visitors_attended", serializers.empty)

        if prospects_invited is serializers.empty and self.instance is not None:
            invited_ids = set(
                self.instance.prospects_invited.values_list("id", flat=True)
            )
        elif prospects_invited is serializers.empty:
            invited_ids = set()
        else:
            invited_ids = {p.pk for p in prospects_invited}

        if visitors_attended is serializers.empty and self.instance is not None:
            visitor_person_ids = set(
                self.instance.visitors_attended.values_list("id", flat=True)
            )
        elif visitors_attended is serializers.empty:
            visitor_person_ids = set()
        else:
            visitor_person_ids = {p.pk for p in visitors_attended}

        if invited_ids:
            overlap_qs = Prospect.objects.filter(
                pk__in=invited_ids, person_id__in=visitor_person_ids
            ).values_list("id", flat=True)
            overlap = list(overlap_qs)
            if overlap:
                raise serializers.ValidationError(
                    {
                        "prospects_invited": (
                            "A prospect cannot be both invited and attended on the same report. "
                            f"Conflicting prospect ids: {sorted(overlap)}"
                        )
                    }
                )

        if group and prospects_invited is not serializers.empty:
            for prospect in prospects_invited:
                if prospect.evangelism_group_id != group.pk:
                    raise serializers.ValidationError(
                        {
                            "prospects_invited": (
                                f"Prospect {prospect.pk} is not attributed to this evangelism group."
                            )
                        }
                    )
                if prospect.is_dropped_off:
                    raise serializers.ValidationError(
                        {
                            "prospects_invited": (
                                f"Prospect {prospect.pk} is dropped off and cannot be invited."
                            )
                        }
                    )
                person = prospect.person
                is_invited = prospect.pipeline_stage == Prospect.PipelineStage.INVITED
                is_linked_visitor = bool(person and person.role == "VISITOR")
                if not is_invited and not is_linked_visitor:
                    raise serializers.ValidationError(
                        {
                            "prospects_invited": (
                                f"Prospect {prospect.pk} cannot be recorded as invited "
                                "(must be INVITED or a linked visitor)."
                            )
                        }
                    )

        if group and new_invited:
            for idx, payload in enumerate(new_invited):
                duplicates = find_duplicate_invited_prospects_for_group(
                    group,
                    payload.get("first_name", ""),
                    payload.get("last_name", ""),
                    contact_info=payload.get("contact_info", ""),
                    facebook_name=payload.get("facebook_name", ""),
                )
                if duplicates:
                    raise serializers.ValidationError(
                        {
                            "new_invited_prospects": {
                                idx: {
                                    "non_field_errors": [
                                        "A similar invited prospect already exists for this group. "
                                        "Select the existing prospect instead of creating a duplicate."
                                    ],
                                    "matches": [
                                        {
                                            "id": d.id,
                                            "display_name": d.display_name,
                                            "first_name": d.first_name,
                                            "last_name": d.last_name,
                                        }
                                        for d in duplicates
                                    ],
                                }
                            }
                        }
                    )

        return attrs

    def get_members_attended_details(self, obj):
        return PersonSummarySerializer(obj.members_attended.all(), many=True).data

    def get_visitors_attended_details(self, obj):
        return PersonSummarySerializer(obj.visitors_attended.all(), many=True).data

    def get_prospects_invited_details(self, obj):
        details = []
        for prospect in obj.prospects_invited.select_related("invited_by").all():
            inviter = prospect.invited_by
            details.append(
                {
                    "id": prospect.id,
                    "first_name": prospect.first_name,
                    "last_name": prospect.last_name,
                    "middle_name": prospect.middle_name,
                    "suffix": prospect.suffix,
                    "display_name": prospect.display_name,
                    "pipeline_stage": prospect.pipeline_stage,
                    "pipeline_stage_display": prospect.get_pipeline_stage_display(),
                    "invited_by": (
                        {
                            "id": inviter.id,
                            "first_name": inviter.first_name,
                            "last_name": inviter.last_name,
                            "username": inviter.username,
                        }
                        if inviter
                        else None
                    ),
                    "person_id": prospect.person_id,
                }
            )
        return details

    def _create_new_invited_prospects(self, group, meeting_date, payloads):
        created = []
        for payload in payloads:
            invite_date = payload.get("date_first_invited") or meeting_date or church_today()
            created.append(
                create_invited_prospect_for_evangelism_group(
                    group,
                    first_name=payload["first_name"],
                    last_name=payload["last_name"],
                    invited_by=payload["invited_by"],
                    middle_name=payload.get("middle_name", ""),
                    suffix=payload.get("suffix", ""),
                    gender=payload.get("gender", "") or "",
                    contact_info=payload.get("contact_info", ""),
                    facebook_name=payload.get("facebook_name", ""),
                    notes=payload.get("notes", ""),
                    date_first_invited=invite_date,
                )
            )
        return created

    def _sync_derived_new_prospects(self, report):
        count = report.prospects_invited.count()
        if report.new_prospects != count:
            report.new_prospects = count
            report.save(update_fields=["new_prospects"])

    @transaction.atomic
    def create(self, validated_data):
        new_invited_data = validated_data.pop("new_invited_prospects", [])
        prospects_invited = validated_data.pop("prospects_invited", [])
        members_attended = validated_data.pop("members_attended", [])
        visitors_attended = validated_data.pop("visitors_attended", [])
        group = validated_data["evangelism_group"]
        meeting_date = validated_data.get("meeting_date")

        created_prospects = self._create_new_invited_prospects(
            group, meeting_date, new_invited_data
        )

        report = EvangelismWeeklyReport.objects.create(**validated_data)
        if members_attended:
            report.members_attended.set(members_attended)
        if visitors_attended:
            report.visitors_attended.set(visitors_attended)

        invited_set = list(prospects_invited) + created_prospects
        if invited_set:
            report.prospects_invited.set(invited_set)
        self._sync_derived_new_prospects(report)
        return report

    @transaction.atomic
    def update(self, instance, validated_data):
        new_invited_data = validated_data.pop("new_invited_prospects", None)
        prospects_invited = validated_data.pop("prospects_invited", serializers.empty)
        members_attended = validated_data.pop("members_attended", serializers.empty)
        visitors_attended = validated_data.pop("visitors_attended", serializers.empty)
        group = validated_data.get("evangelism_group", instance.evangelism_group)
        meeting_date = validated_data.get("meeting_date", instance.meeting_date)

        created_prospects = []
        if new_invited_data:
            created_prospects = self._create_new_invited_prospects(
                group, meeting_date, new_invited_data
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if members_attended is not serializers.empty:
            instance.members_attended.set(members_attended)
        if visitors_attended is not serializers.empty:
            instance.visitors_attended.set(visitors_attended)

        if prospects_invited is not serializers.empty or created_prospects:
            if prospects_invited is serializers.empty:
                current_invited = list(instance.prospects_invited.all())
            else:
                current_invited = list(prospects_invited)
            invited_set = current_invited + created_prospects
            instance.prospects_invited.set(invited_set)

        self._sync_derived_new_prospects(instance)
        return instance


class EvangelismTallySerializer(serializers.Serializer):
    cluster_id = serializers.IntegerField(allow_null=True, required=False)
    cluster_name = serializers.CharField(allow_blank=True, required=False)
    cluster_code = serializers.CharField(allow_blank=True, required=False)
    year = serializers.IntegerField()
    week_number = serializers.IntegerField()
    meeting_date = serializers.DateField(required=False, allow_null=True)
    gathering_type = serializers.CharField()
    members_count = serializers.IntegerField()
    visitors_count = serializers.IntegerField()
    evangelism_reports_count = serializers.IntegerField()
    cluster_reports_count = serializers.IntegerField()
    new_prospects = serializers.IntegerField()
    conversions_this_week = serializers.IntegerField()


class EvangelismPeopleTallySerializer(serializers.Serializer):
    month = serializers.IntegerField(required=False, allow_null=True)
    year = serializers.IntegerField()
    invited_count = serializers.IntegerField()
    attended_count = serializers.IntegerField()
    students_count = serializers.IntegerField()
    baptized_count = serializers.IntegerField()
    received_hg_count = serializers.IntegerField()
    reached_count = serializers.IntegerField()
    unique_hc_count = serializers.IntegerField()
    cluster_id = serializers.IntegerField(required=False, allow_null=True)
    cluster_name = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    cluster_code = serializers.CharField(
        required=False, allow_null=True, allow_blank=True
    )
    row_kind = serializers.ChoiceField(
        choices=["cluster", "unassigned", "total"],
        required=False,
        allow_null=True,
    )


class EvangelismTallyDrilldownSerializer(serializers.Serializer):
    entity_type = serializers.ChoiceField(choices=["person", "prospect"])
    id = serializers.IntegerField()
    display_name = serializers.CharField()
    first_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    middle_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    last_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    suffix = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nickname = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    member_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    role = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pipeline_stage = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    person_id = serializers.IntegerField(required=False, allow_null=True)
    event_date = serializers.DateField(required=False, allow_null=True)
    date_first_invited = serializers.DateField(required=False, allow_null=True)
    date_first_attended = serializers.DateField(required=False, allow_null=True)
    lessons_finished_at = serializers.DateField(required=False, allow_null=True)
    water_baptism_date = serializers.DateField(required=False, allow_null=True)
    spirit_baptism_date = serializers.DateField(required=False, allow_null=True)
    reached_date = serializers.DateField(required=False, allow_null=True)
    metric = serializers.CharField()


class ProspectSerializer(serializers.ModelSerializer):
    invited_by = PersonSummarySerializer(read_only=True)
    invited_by_id = serializers.PrimaryKeyRelatedField(
        source="invited_by",
        queryset=Person.objects.exclude(role="ADMIN"),
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
    pipeline_stage_display = serializers.CharField(
        source="get_pipeline_stage_display", read_only=True
    )
    days_since_last_activity = serializers.IntegerField(read_only=True)
    display_name = serializers.ReadOnlyField()
    date_first_attended = serializers.SerializerMethodField()
    lessons_finished_at = serializers.SerializerMethodField()
    water_baptism_date = serializers.SerializerMethodField()
    spirit_baptism_date = serializers.SerializerMethodField()
    reached_date = serializers.SerializerMethodField()

    class Meta:
        model = Prospect
        fields = (
            "id",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "gender",
            "display_name",
            "contact_info",
            "facebook_name",
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
            "date_first_invited",
            "date_first_attended",
            "lessons_finished_at",
            "water_baptism_date",
            "spirit_baptism_date",
            "reached_date",
            "last_activity_date",
            "is_attending_cluster",
            "is_dropped_off",
            "drop_off_date",
            "drop_off_stage",
            "drop_off_reason",
            "has_finished_lessons",
            "commitment_form_signed",
            "notes",
            "days_since_last_activity",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "created_at",
            "updated_at",
            "days_since_last_activity",
            "display_name",
            "date_first_attended",
            "lessons_finished_at",
            "water_baptism_date",
            "spirit_baptism_date",
            "reached_date",
        )

    def _person_date(self, obj, attr):
        person = obj.person
        if not person:
            return None
        return getattr(person, attr, None)

    def get_date_first_attended(self, obj):
        return self._person_date(obj, "date_first_attended")

    def get_lessons_finished_at(self, obj):
        return self._person_date(obj, "lessons_finished_at")

    def get_water_baptism_date(self, obj):
        return self._person_date(obj, "water_baptism_date")

    def get_spirit_baptism_date(self, obj):
        return self._person_date(obj, "spirit_baptism_date")

    def get_reached_date(self, obj):
        person = obj.person
        if not person:
            return None
        if person.water_baptism_date and person.spirit_baptism_date:
            return max(person.water_baptism_date, person.spirit_baptism_date)
        return None

    def validate(self, attrs):
        apply_title_case_name_fields(attrs, PROSPECT_NAME_FIELDS)
        return attrs


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
        queryset=Person.objects.exclude(role="ADMIN"),
        write_only=True,
    )
    created_by = PersonSummarySerializer(read_only=True)
    created_by_id = serializers.PrimaryKeyRelatedField(
        source="created_by",
        queryset=Person.objects.exclude(role="ADMIN"),
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
    person = PersonConversionNestedSerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.exclude(role="ADMIN"),
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
        queryset=Person.objects.exclude(role="ADMIN"),
        write_only=True,
        required=False,
        allow_null=True,
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
        queryset=Person.objects.exclude(role="ADMIN"),
        write_only=True,
        required=False,
        allow_null=True,
    )
    date_first_invited = serializers.DateField(
        required=False, allow_null=True, write_only=True
    )
    date_first_attended = serializers.DateField(
        required=False, allow_null=True, write_only=True
    )
    baptized_by = serializers.SerializerMethodField()
    baptized_by_id = serializers.PrimaryKeyRelatedField(
        queryset=baptism_verifier_queryset(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    baptized_by_first_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, write_only=True
    )
    baptized_by_last_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, write_only=True
    )
    baptized_by_display_name = serializers.SerializerMethodField()
    hg_witnessed_by = serializers.SerializerMethodField()
    hg_witnessed_by_id = serializers.PrimaryKeyRelatedField(
        queryset=baptism_verifier_queryset(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    hg_witnessed_by_first_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, write_only=True
    )
    hg_witnessed_by_last_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, write_only=True
    )
    hg_witnessed_by_display_name = serializers.SerializerMethodField()

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
            "date_first_invited",
            "date_first_attended",
            "lesson_start_date",
            "water_baptism_date",
            "spirit_baptism_date",
            "is_complete",
            "notes",
            "verified_by",
            "verified_by_id",
            "baptized_by",
            "baptized_by_id",
            "baptized_by_first_name",
            "baptized_by_last_name",
            "baptized_by_display_name",
            "hg_witnessed_by",
            "hg_witnessed_by_id",
            "hg_witnessed_by_first_name",
            "hg_witnessed_by_last_name",
            "hg_witnessed_by_display_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "is_complete")
        extra_kwargs = {
            "conversion_date": {"required": False, "allow_null": True}
        }

    def get_baptized_by(self, obj: Conversion):
        person = journey_verified_by(obj.person, BAPTISM_JOURNEY_TYPE)
        if not person:
            return None
        return PersonSummarySerializer(person).data

    def get_hg_witnessed_by(self, obj: Conversion):
        person = journey_verified_by(obj.person, SPIRIT_JOURNEY_TYPE)
        if not person:
            return None
        return PersonSummarySerializer(person).data

    def get_baptized_by_display_name(self, obj: Conversion):
        return person_verifier_display_name(obj.person, BAPTISM_JOURNEY_TYPE)

    def get_hg_witnessed_by_display_name(self, obj: Conversion):
        return person_verifier_display_name(obj.person, SPIRIT_JOURNEY_TYPE)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        b_first, b_last = historical_verifier_names(
            instance.person, BAPTISM_JOURNEY_TYPE
        )
        h_first, h_last = historical_verifier_names(
            instance.person, SPIRIT_JOURNEY_TYPE
        )
        data["baptized_by_first_name"] = b_first
        data["baptized_by_last_name"] = b_last
        data["hg_witnessed_by_first_name"] = h_first
        data["hg_witnessed_by_last_name"] = h_last
        return data

    def validate(self, attrs):
        apply_title_case_name_fields(
            attrs,
            (
                "baptized_by_first_name",
                "baptized_by_last_name",
                "hg_witnessed_by_first_name",
                "hg_witnessed_by_last_name",
            ),
        )
        if "baptized_by_first_name" in attrs or "baptized_by_last_name" in attrs:
            validate_historical_name_pair(
                attrs.get("baptized_by_first_name"),
                attrs.get("baptized_by_last_name"),
                first_field="baptized_by_first_name",
            )
        if "hg_witnessed_by_first_name" in attrs or "hg_witnessed_by_last_name" in attrs:
            validate_historical_name_pair(
                attrs.get("hg_witnessed_by_first_name"),
                attrs.get("hg_witnessed_by_last_name"),
                first_field="hg_witnessed_by_first_name",
            )
        return attrs

    def create(self, validated_data):
        validated_data = self._pop_verifier_write(validated_data)
        conversion = super().create(validated_data)
        self._apply_pending_verifier_write(conversion)
        return conversion

    def update(self, instance, validated_data):
        validated_data = self._pop_verifier_write(validated_data)
        conversion = super().update(instance, validated_data)
        self._apply_pending_verifier_write(conversion)
        return conversion

    def _pop_verifier_write(self, validated_data):
        self._pending_verifier_write = {
            "baptized_by": validated_data.pop("baptized_by_id", BAPTISM_VERIFIER_UNSET),
            "hg_witnessed_by": validated_data.pop(
                "hg_witnessed_by_id", BAPTISM_VERIFIER_UNSET
            ),
            "baptized_by_first_name": validated_data.pop(
                "baptized_by_first_name", BAPTISM_VERIFIER_UNSET
            ),
            "baptized_by_last_name": validated_data.pop(
                "baptized_by_last_name", BAPTISM_VERIFIER_UNSET
            ),
            "hg_witnessed_by_first_name": validated_data.pop(
                "hg_witnessed_by_first_name", BAPTISM_VERIFIER_UNSET
            ),
            "hg_witnessed_by_last_name": validated_data.pop(
                "hg_witnessed_by_last_name", BAPTISM_VERIFIER_UNSET
            ),
        }
        return validated_data

    def _apply_pending_verifier_write(self, conversion: Conversion):
        write = getattr(self, "_pending_verifier_write", None) or {}
        conversion._baptism_verified_by = write.get(
            "baptized_by", BAPTISM_VERIFIER_UNSET
        )
        conversion._spirit_verified_by = write.get(
            "hg_witnessed_by", BAPTISM_VERIFIER_UNSET
        )
        conversion._baptism_hist_first = write.get(
            "baptized_by_first_name", BAPTISM_VERIFIER_UNSET
        )
        conversion._baptism_hist_last = write.get(
            "baptized_by_last_name", BAPTISM_VERIFIER_UNSET
        )
        conversion._spirit_hist_first = write.get(
            "hg_witnessed_by_first_name", BAPTISM_VERIFIER_UNSET
        )
        conversion._spirit_hist_last = write.get(
            "hg_witnessed_by_last_name", BAPTISM_VERIFIER_UNSET
        )


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
    taken_ncc_count = serializers.IntegerField()
    baptized_count = serializers.IntegerField()
    received_hg_count = serializers.IntegerField()
    converted_count = serializers.IntegerField()


class Each1Reach1GoalSerializer(serializers.ModelSerializer):
    DUPLICATE_GOAL_ERROR = "A goal already exists for this cluster and year."

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
        validators = []
        extra_kwargs = {
            "target_conversions": {"required": False},
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cluster = attrs.get("cluster", getattr(self.instance, "cluster", None))
        year = attrs.get("year", getattr(self.instance, "year", None))

        if cluster is not None and year is not None:
            duplicate_qs = Each1Reach1Goal.objects.filter(cluster=cluster, year=year)
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError(self.DUPLICATE_GOAL_ERROR)

        if attrs.get("target_conversions") is None and attrs.get("cluster"):
            attrs["target_conversions"] = get_default_each1reach1_target(attrs["cluster"])
        return attrs


class EvangelismSummarySerializer(serializers.Serializer):
    total_groups = serializers.IntegerField()
    active_groups = serializers.IntegerField()
    total_prospects = serializers.IntegerField()
    total_conversions = serializers.IntegerField()
    monthly_statistics = MonthlyStatisticsSerializer(many=True, required=False)


class EvangelismDashboardStatsSerializer(serializers.Serializer):
    total_groups = serializers.IntegerField()
    active_groups = serializers.IntegerField()
    total_visitors = serializers.IntegerField()
    total_reached = serializers.IntegerField()
    completed_conversions = serializers.IntegerField()
    year = serializers.IntegerField()


class VisitorProgressSerializer(serializers.Serializer):
    prospect_id = serializers.IntegerField()
    prospect_name = serializers.CharField()
    current_stage = serializers.CharField()
    stage_history = serializers.ListField()
    days_in_current_stage = serializers.IntegerField()


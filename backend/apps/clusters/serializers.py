from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
import logging

from apps.people.models import Person, Family, Journey, ModuleCoordinator
from apps.people.name_formatting import (
    PERSON_NAME_FIELDS,
    PROSPECT_NAME_FIELDS,
    apply_title_case_name_fields,
)
from apps.people.serializers import PersonSerializer
from apps.events.models import EventType
from apps.evangelism.models import Prospect
from apps.evangelism.services import (
    create_invited_prospect_for_cluster,
    find_duplicate_invited_prospects,
    mark_prospect_attended,
    prospect_belongs_to_cluster,
)
from apps.clusters.branch_membership import (
    clear_coordinator_if_invalid,
    ensure_coordinator_in_members,
    merge_cluster_member_ids,
    prune_members_not_matching_cluster_branch,
    sync_member_branches_to_cluster,
)
from apps.clusters.coordinator_assignments import (
    prune_cluster_reporter_assignments_to_members,
    sync_cluster_reporter_assignments,
)
from .models import Cluster, ClusterWeeklyReport, ClusterComplianceNote

logger = logging.getLogger(__name__)


class ClusterListSerializer(serializers.ModelSerializer):
    """Slim read-only serializer for paginated clusters directory."""

    coordinator = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True, default=0)
    visitor_count = serializers.IntegerField(read_only=True, default=0)
    family_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Cluster
        fields = [
            "id",
            "code",
            "name",
            "coordinator",
            "branch",
            "location",
            "meeting_schedule",
            "description",
            "is_active",
            "created_at",
            "member_count",
            "visitor_count",
            "family_count",
        ]

    def get_coordinator(self, obj):
        if obj.coordinator:
            return {
                "id": obj.coordinator.id,
                "first_name": obj.coordinator.first_name,
                "last_name": obj.coordinator.last_name,
                "username": obj.coordinator.username,
            }
        return None


class ClusterReportNewProspectSerializer(serializers.Serializer):
    """Write-only payload for creating an INVITED prospect on a cluster weekly report."""

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


class ClusterReportNewVisitorSerializer(serializers.Serializer):
    """Write-only payload for creating a VISITOR person on a cluster weekly report."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    inviter_id = serializers.PrimaryKeyRelatedField(
        source="inviter",
        queryset=Person.objects.exclude(role="ADMIN"),
        required=False,
        allow_null=True,
    )
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    suffix = serializers.CharField(max_length=150, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=[("MALE", "Male"), ("FEMALE", "Female"), ("", "")],
        required=False,
        allow_blank=True,
    )
    facebook_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True)
    date_first_attended = serializers.DateField(required=False, allow_null=True)
    first_activity_attended = serializers.SlugRelatedField(
        slug_field="code",
        queryset=EventType.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        apply_title_case_name_fields(attrs, PERSON_NAME_FIELDS)
        return attrs


class ClusterSerializer(serializers.ModelSerializer):
    coordinator = serializers.SerializerMethodField()
    coordinator_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"),
        source="coordinator",
        write_only=True,
        allow_null=True,
        required=False,
    )
    families = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Family.objects.all()
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.exclude(role="ADMIN")
    )
    members_details = serializers.SerializerMethodField()
    families_details = serializers.SerializerMethodField()
    reporter_ids = serializers.SerializerMethodField()

    class Meta:
        model = Cluster
        fields = [
            "id",
            "code",
            "name",
            "coordinator",
            "coordinator_id",
            "families",
            "members",
            "members_details",
            "families_details",
            "reporter_ids",
            "branch",
            "location",
            "meeting_schedule",
            "description",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
            "members_details",
            "families_details",
            "reporter_ids",
        ]

    def _person_photo_url(self, person):
        if not getattr(person, "photo", None):
            return None
        try:
            url = person.photo.url
        except ValueError:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_coordinator(self, obj):
        if obj.coordinator:
            return {
                "id": obj.coordinator.id,
                "first_name": obj.coordinator.first_name,
                "last_name": obj.coordinator.last_name,
                "username": obj.coordinator.username,
            }
        return None

    def get_reporter_ids(self, obj):
        reporter_map = self.context.get("cluster_reporter_ids_map")
        if reporter_map is not None:
            return reporter_map.get(obj.id, [])
        return list(
            ModuleCoordinator.objects.filter(
                module=ModuleCoordinator.ModuleType.CLUSTER,
                level=ModuleCoordinator.CoordinatorLevel.REPORTER,
                resource_id=obj.id,
            ).values_list("person_id", flat=True)
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # Writable reporter_ids via initial_data (field is SerializerMethodField / read-only).
        if "reporter_ids" not in self.initial_data:
            return attrs

        raw = self.initial_data.get("reporter_ids")
        if raw is None:
            raw = []
        if not isinstance(raw, list):
            raise serializers.ValidationError(
                {"reporter_ids": "Expected a list of person IDs."}
            )

        reporter_ids: list[int] = []
        for item in raw:
            try:
                reporter_ids.append(int(item))
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {"reporter_ids": "Each reporter ID must be an integer."}
                )

        if len(reporter_ids) != len(set(reporter_ids)):
            raise serializers.ValidationError(
                {"reporter_ids": "Duplicate reporter IDs are not allowed."}
            )

        coordinator = attrs.get("coordinator", serializers.empty)
        if coordinator is serializers.empty:
            coordinator_id = (
                self.instance.coordinator_id if self.instance else None
            )
        else:
            coordinator_id = coordinator.id if coordinator else None

        if coordinator_id is not None and coordinator_id in reporter_ids:
            raise serializers.ValidationError(
                {
                    "reporter_ids": (
                        "The cluster coordinator cannot also be a reporter."
                    )
                }
            )

        members = attrs.get("members", serializers.empty)
        if members is serializers.empty:
            member_ids = (
                set(self.instance.members.values_list("id", flat=True))
                if self.instance
                else set()
            )
        else:
            member_ids = {m.id for m in members}

        # Coordinator is always treated as a member after save.
        if coordinator_id is not None:
            member_ids.add(coordinator_id)

        invalid = [rid for rid in reporter_ids if rid not in member_ids]
        if invalid:
            raise serializers.ValidationError(
                {
                    "reporter_ids": (
                        "Reporters must be cluster members. "
                        f"Invalid IDs: {invalid}"
                    )
                }
            )

        existing_ids = set(
            Person.objects.filter(id__in=reporter_ids)
            .exclude(role="ADMIN")
            .values_list("id", flat=True)
        )
        missing = [rid for rid in reporter_ids if rid not in existing_ids]
        if missing:
            raise serializers.ValidationError(
                {"reporter_ids": f"Unknown person IDs: {missing}"}
            )

        attrs["_reporter_ids"] = reporter_ids
        return attrs

    def get_members_details(self, obj):
        """Roster for cluster browse (no email/phone/address)."""
        return [
            {
                "id": person.id,
                "first_name": person.first_name,
                "last_name": person.last_name,
                "role": person.role,
                "status": person.status,
                "photo": self._person_photo_url(person),
            }
            for person in obj.members.exclude(role="ADMIN")
        ]

    def get_families_details(self, obj):
        """Privacy-safe family roster (name + count only; no address/member PII)."""
        return [
            {
                "id": family.id,
                "name": family.name,
                "member_count": len(family.members.all()),
            }
            for family in obj.families.all()
        ]

    def _get_cluster_display_name(self, cluster):
        """Get cluster code, name, or fallback identifier"""
        if cluster.code:
            return cluster.code
        if cluster.name:
            return cluster.name
        return f"Cluster {cluster.id}"

    def _remove_added_members_from_inactive_clusters(self, active_cluster, added_member_ids):
        """When joining an active cluster, drop inactive cluster memberships (journeys preserved)."""
        if not active_cluster.is_active or not added_member_ids:
            return
        inactive_clusters = Cluster.objects.filter(
            is_active=False, members__id__in=added_member_ids
        ).distinct()
        for inactive in inactive_clusters:
            inactive.members.remove(*added_member_ids)

    def _create_membership_journeys(
        self,
        cluster,
        new_member_ids,
        old_member_ids=None,
        verified_by=None,
        previous_cluster_map=None,
    ):
        """
        Create journey entries for cluster membership changes.

        Args:
            cluster: The Cluster instance
            new_member_ids: Set of member IDs that should be in the cluster
            old_member_ids: Set of previous member IDs (for transfer detection)
            verified_by: Person who made the change (from request context)
            previous_cluster_map: Dict mapping person_id to their previous cluster IDs (for transfer detection)
        """
        if old_member_ids is None:
            old_member_ids = set()
        if previous_cluster_map is None:
            previous_cluster_map = {}

        cluster_display = self._get_cluster_display_name(cluster)
        today = timezone.now().date()
        journeys_to_create = []

        # Find new members (added)
        added_member_ids = new_member_ids - old_member_ids

        if added_member_ids and cluster.is_active:
            self._remove_added_members_from_inactive_clusters(
                cluster, list(added_member_ids)
            )

        # Create journeys for new members (do not delete past "Added to cluster" rows when someone leaves)
        if added_member_ids:
            new_members = Person.objects.filter(id__in=added_member_ids)

            for person in new_members:
                # Check if this is a transfer
                # First check previous_cluster_map (from before update)
                prev_cluster_ids = previous_cluster_map.get(person.id, set())
                # Also check current clusters (excluding this one) in case they're still in another cluster
                current_other_clusters = person.clusters.exclude(id=cluster.id)

                is_transfer = bool(prev_cluster_ids) or current_other_clusters.exists()

                title = f"Added to cluster: {cluster_display}"
                if is_transfer:
                    prev_cluster = None
                    if prev_cluster_ids:
                        prev_cluster = Cluster.objects.filter(
                            id__in=prev_cluster_ids
                        ).first()
                    if not prev_cluster and current_other_clusters.exists():
                        prev_cluster = current_other_clusters.first()

                    if prev_cluster:
                        prev_cluster_display = self._get_cluster_display_name(
                            prev_cluster
                        )
                        description = f"Transferred from {prev_cluster_display}."
                    else:
                        description = "Transferred from another cluster."
                else:
                    description = "Added to this cluster."

                # Do not de-dupe by same title+date: past rows are kept when someone leaves, so
                # re-joining the same cluster the same day must still create a new journey.
                journeys_to_create.append(
                    Journey(
                        user=person,
                        title=title,
                        date=today,
                        type="CLUSTER",
                        description=description,
                        verified_by=verified_by,
                    )
                )

        if journeys_to_create:
            try:
                with transaction.atomic():
                    Journey.objects.bulk_create(journeys_to_create)
                logger.info(
                    f"Created {len(journeys_to_create)} membership journeys for cluster {cluster.id}"
                )
            except Exception as e:
                logger.error(
                    f"Error creating membership journeys for cluster {cluster.id}: {str(e)}",
                    exc_info=True,
                )
                # Don't raise - allow cluster update to succeed even if journey creation fails

    def _collect_family_member_ids(self, families) -> set[int]:
        family_member_ids: set[int] = set()
        for family in families:
            family_member_ids.update(family.members.values_list("id", flat=True))
        return family_member_ids

    def create(self, validated_data):
        families = validated_data.pop("families", [])
        members = validated_data.pop("members", [])
        reporter_ids = validated_data.pop("_reporter_ids", None)

        # Get request user for verified_by
        request = self.context.get("request")
        verified_by = request.user if request and hasattr(request, "user") else None

        # Create the cluster instance
        instance = super().create(validated_data)

        # Set families first
        instance.families.set(families)

        # Track old memberships (empty for create)
        old_member_ids = set()

        family_member_ids = self._collect_family_member_ids(families)
        user_member_ids = {member.id for member in members}
        all_member_ids = merge_cluster_member_ids(
            instance, user_member_ids, family_member_ids
        )
        instance.members.set(all_member_ids)

        instance.refresh_from_db()
        sync_member_branches_to_cluster(instance, all_member_ids)
        prune_members_not_matching_cluster_branch(instance)
        clear_coordinator_if_invalid(instance)
        instance.refresh_from_db()
        ensure_coordinator_in_members(instance)
        instance.refresh_from_db()

        # Create journeys for initial members
        final_member_ids = set(instance.members.values_list("id", flat=True))
        if final_member_ids:
            self._create_membership_journeys(
                instance, final_member_ids, old_member_ids, verified_by
            )

        if reporter_ids is not None:
            sync_cluster_reporter_assignments(instance, reporter_ids)
        prune_cluster_reporter_assignments_to_members(instance, final_member_ids)

        return instance

    def update(self, instance, validated_data):
        families = validated_data.pop("families", None)
        members = validated_data.pop("members", None)
        reporter_ids = validated_data.pop("_reporter_ids", serializers.empty)

        # Get request user for verified_by
        request = self.context.get("request")
        verified_by = request.user if request and hasattr(request, "user") else None

        # Capture previous memberships before any changes
        old_member_ids = set(instance.members.values_list("id", flat=True))

        # Capture previous cluster memberships for each person (for transfer detection)
        previous_cluster_map = {}
        if old_member_ids:
            old_members = Person.objects.filter(id__in=old_member_ids).prefetch_related(
                "clusters"
            )
            for person in old_members:
                previous_cluster_map[person.id] = set(
                    person.clusters.values_list("id", flat=True)
                )

        # Update other fields first
        instance = super().update(instance, validated_data)

        # Update families if provided
        if families is not None:
            instance.families.set(families)

        current_families = list(instance.families.all())
        family_member_ids = self._collect_family_member_ids(current_families)

        # Update members if provided
        all_member_ids: set[int] = set()
        if members is not None:
            user_member_ids = {member.id for member in members}
            all_member_ids = merge_cluster_member_ids(
                instance, user_member_ids, family_member_ids
            )
            instance.members.set(all_member_ids)
        else:
            # If members not provided, ensure eligible family members are included
            if family_member_ids:
                existing_member_ids = set(instance.members.values_list("id", flat=True))
                all_member_ids = merge_cluster_member_ids(
                    instance, existing_member_ids, family_member_ids
                )
                instance.members.set(all_member_ids)
            else:
                all_member_ids = set(instance.members.values_list("id", flat=True))

        # Refresh to get final member list
        instance.refresh_from_db()
        if members is not None:
            sync_member_branches_to_cluster(instance, all_member_ids)
        prune_members_not_matching_cluster_branch(instance)
        clear_coordinator_if_invalid(instance)
        instance.refresh_from_db()
        ensure_coordinator_in_members(instance)
        instance.refresh_from_db()
        new_member_ids = set(instance.members.values_list("id", flat=True))

        # Create journeys for membership changes
        if new_member_ids != old_member_ids:
            self._create_membership_journeys(
                instance,
                new_member_ids,
                old_member_ids,
                verified_by,
                previous_cluster_map,
            )

        if reporter_ids is not serializers.empty:
            sync_cluster_reporter_assignments(instance, reporter_ids)
        prune_cluster_reporter_assignments_to_members(instance, new_member_ids)

        return instance


class ClusterWeeklyReportSerializer(serializers.ModelSerializer):
    submitted_by_details = serializers.SerializerMethodField()
    cluster_name = serializers.CharField(source="cluster.name", read_only=True)
    cluster_code = serializers.CharField(
        source="cluster.code", read_only=True, allow_null=True
    )
    members_attended = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Person.objects.filter(role__in=["MEMBER"]).exclude(role="ADMIN"),
        required=False,
    )
    visitors_attended = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Person.objects.filter(role="VISITOR").exclude(role="ADMIN"),
        required=False,
    )
    prospects_invited = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Prospect.objects.all(),
        required=False,
    )
    new_prospects = ClusterReportNewProspectSerializer(
        many=True, required=False, write_only=True
    )
    new_visitors = ClusterReportNewVisitorSerializer(
        many=True, required=False, write_only=True
    )
    prospects_attended = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Prospect.objects.all(),
        required=False,
        write_only=True,
    )
    # Read-only fields with full person details
    members_attended_details = serializers.SerializerMethodField()
    visitors_attended_details = serializers.SerializerMethodField()
    prospects_invited_details = serializers.SerializerMethodField()
    # Computed properties for backward compatibility
    members_present = serializers.IntegerField(read_only=True)
    visitors_present = serializers.IntegerField(read_only=True)
    prospects_invited_count = serializers.IntegerField(read_only=True)
    member_attendance_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = ClusterWeeklyReport
        fields = [
            "id",
            "cluster",
            "cluster_name",
            "cluster_code",
            "year",
            "week_number",
            "meeting_date",
            "members_attended",
            "visitors_attended",
            "prospects_invited",
            "new_prospects",
            "new_visitors",
            "prospects_attended",
            "members_attended_details",
            "visitors_attended_details",
            "prospects_invited_details",
            "members_present",
            "visitors_present",
            "prospects_invited_count",
            "member_attendance_rate",
            "gathering_type",
            "activities_held",
            "prayer_requests",
            "testimonies",
            "offerings",
            "highlights",
            "lowlights",
            "submitted_by",
            "submitted_by_details",
            "submitted_at",
            "updated_at",
        ]
        read_only_fields = [
            "submitted_by",
            "submitted_at",
            "updated_at",
            "members_present",
            "visitors_present",
            "prospects_invited_count",
            "member_attendance_rate",
        ]

    def get_submitted_by_details(self, obj):
        if obj.submitted_by:
            return {
                "id": obj.submitted_by.id,
                "first_name": obj.submitted_by.first_name,
                "last_name": obj.submitted_by.last_name,
                "username": obj.submitted_by.username,
            }
        return None

    def get_members_attended_details(self, obj):
        return [
            {
                "id": person.id,
                "first_name": person.first_name,
                "last_name": person.last_name,
                "username": person.username,
                "role": person.role,
                "status": person.status,
            }
            for person in obj.members_attended.exclude(role="ADMIN")
        ]

    def get_visitors_attended_details(self, obj):
        return [
            {
                "id": person.id,
                "first_name": person.first_name,
                "last_name": person.last_name,
                "username": person.username,
                "role": person.role,
                "status": person.status,
            }
            for person in obj.visitors_attended.exclude(role="ADMIN")
        ]

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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cluster = attrs.get("cluster") or getattr(self.instance, "cluster", None)
        meeting_date = attrs.get("meeting_date") or getattr(
            self.instance, "meeting_date", None
        )
        new_prospects = attrs.get("new_prospects") or []
        prospects_attended = attrs.get("prospects_attended") or []
        prospects_invited = attrs.get("prospects_invited", serializers.empty)

        if prospects_invited is serializers.empty and self.instance is not None:
            invited_ids = set(
                self.instance.prospects_invited.values_list("id", flat=True)
            )
        elif prospects_invited is serializers.empty:
            invited_ids = set()
        else:
            invited_ids = {p.pk for p in prospects_invited}

        attended_ids = {p.pk for p in prospects_attended}
        overlap = invited_ids & attended_ids
        if overlap:
            raise serializers.ValidationError(
                {
                    "prospects_attended": (
                        "A prospect cannot be both invited and attended on the same report. "
                        f"Conflicting prospect ids: {sorted(overlap)}"
                    )
                }
            )

        if cluster and new_prospects:
            for idx, payload in enumerate(new_prospects):
                duplicates = find_duplicate_invited_prospects(
                    cluster,
                    payload.get("first_name", ""),
                    payload.get("last_name", ""),
                    contact_info=payload.get("contact_info", ""),
                    facebook_name=payload.get("facebook_name", ""),
                )
                if duplicates:
                    raise serializers.ValidationError(
                        {
                            "new_prospects": {
                                idx: {
                                    "non_field_errors": [
                                        "A similar invited prospect already exists for this cluster. "
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

        if cluster and prospects_attended:
            for prospect in prospects_attended:
                if not prospect_belongs_to_cluster(prospect, cluster):
                    raise serializers.ValidationError(
                        {
                            "prospects_attended": (
                                f"Prospect {prospect.pk} is not attributed to this cluster."
                            )
                        }
                    )
                if prospect.is_dropped_off:
                    raise serializers.ValidationError(
                        {
                            "prospects_attended": (
                                f"Prospect {prospect.pk} is dropped off and cannot be marked attended."
                            )
                        }
                    )
                person = prospect.person
                is_invited = prospect.pipeline_stage == Prospect.PipelineStage.INVITED
                is_linked_visitor = bool(
                    person and person.role == "VISITOR"
                )
                if not is_invited and not is_linked_visitor:
                    raise serializers.ValidationError(
                        {
                            "prospects_attended": (
                                f"Prospect {prospect.pk} cannot be marked attended "
                                "(must be INVITED or a linked visitor)."
                            )
                        }
                    )

        attrs["_meeting_date_for_prospects"] = meeting_date
        return attrs

    def _create_new_prospects(self, cluster, meeting_date, new_prospects_data):
        created = []
        for payload in new_prospects_data:
            invite_date = payload.get("date_first_invited") or meeting_date
            prospect = create_invited_prospect_for_cluster(
                cluster,
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
            created.append(prospect)
        return created

    def _create_new_visitors(self, cluster, meeting_date, new_visitors_data):
        created = []
        for payload in new_visitors_data:
            person_data = {
                "first_name": payload["first_name"],
                "last_name": payload["last_name"],
                "middle_name": payload.get("middle_name", ""),
                "suffix": payload.get("suffix", ""),
                "gender": payload.get("gender", "") or "",
                "facebook_name": payload.get("facebook_name", ""),
                "role": "VISITOR",
                "status": "ONGOING",
                "date_first_attended": payload.get("date_first_attended")
                or meeting_date,
                "note": (payload.get("note") or "").strip(),
                "generate_temporary_password": False,
            }
            if cluster.branch_id:
                person_data["branch"] = cluster.branch_id
            inviter = payload.get("inviter")
            if inviter is not None:
                person_data["inviter"] = inviter.pk
            activity = payload.get("first_activity_attended")
            if activity is not None:
                person_data["first_activity_attended"] = activity.code

            ser = PersonSerializer(data=person_data, context=self.context)
            ser.is_valid(raise_exception=True)
            created.append(ser.save())
        return created

    def _promote_prospects_attended(self, cluster, meeting_date, prospects_attended):
        promoted_people = []
        for prospect in prospects_attended:
            if not prospect_belongs_to_cluster(prospect, cluster):
                continue
            mark_prospect_attended(
                prospect,
                activity_date=meeting_date or timezone.now().date(),
            )
            prospect.refresh_from_db()
            if prospect.person_id:
                promoted_people.append(prospect.person)
        return promoted_people

    @transaction.atomic
    def create(self, validated_data):
        new_prospects_data = validated_data.pop("new_prospects", [])
        new_visitors_data = validated_data.pop("new_visitors", [])
        prospects_attended = validated_data.pop("prospects_attended", [])
        meeting_date = validated_data.pop(
            "_meeting_date_for_prospects", validated_data.get("meeting_date")
        )
        prospects_invited = validated_data.pop("prospects_invited", [])
        members_attended = validated_data.pop("members_attended", [])
        visitors_attended = validated_data.pop("visitors_attended", [])

        cluster = validated_data["cluster"]
        created_prospects = self._create_new_prospects(
            cluster, meeting_date, new_prospects_data
        )
        created_visitors = self._create_new_visitors(
            cluster, meeting_date, new_visitors_data
        )
        promoted_people = self._promote_prospects_attended(
            cluster, meeting_date, prospects_attended
        )

        report = ClusterWeeklyReport.objects.create(**validated_data)
        if members_attended:
            report.members_attended.set(members_attended)

        visitor_set = (
            list(visitors_attended) + created_visitors + promoted_people
        )
        # Deduplicate by pk while preserving order
        seen = set()
        unique_visitors = []
        for person in visitor_set:
            if person.pk not in seen:
                seen.add(person.pk)
                unique_visitors.append(person)
        if unique_visitors:
            report.visitors_attended.set(unique_visitors)

        invited_set = list(prospects_invited) + created_prospects
        # Remove any that were also promoted this submit
        promoted_prospect_ids = {p.pk for p in prospects_attended}
        invited_set = [p for p in invited_set if p.pk not in promoted_prospect_ids]
        if invited_set:
            report.prospects_invited.set(invited_set)

        return report

    @transaction.atomic
    def update(self, instance, validated_data):
        new_prospects_data = validated_data.pop("new_prospects", None)
        new_visitors_data = validated_data.pop("new_visitors", None)
        prospects_attended = validated_data.pop("prospects_attended", None)
        meeting_date = validated_data.pop(
            "_meeting_date_for_prospects",
            validated_data.get("meeting_date", instance.meeting_date),
        )
        prospects_invited = validated_data.pop("prospects_invited", serializers.empty)
        members_attended = validated_data.pop("members_attended", serializers.empty)
        visitors_attended = validated_data.pop("visitors_attended", serializers.empty)

        cluster = validated_data.get("cluster", instance.cluster)

        created_prospects = []
        if new_prospects_data:
            created_prospects = self._create_new_prospects(
                cluster, meeting_date, new_prospects_data
            )

        created_visitors = []
        if new_visitors_data:
            created_visitors = self._create_new_visitors(
                cluster, meeting_date, new_visitors_data
            )

        promoted_people = []
        if prospects_attended:
            promoted_people = self._promote_prospects_attended(
                cluster, meeting_date, prospects_attended
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if members_attended is not serializers.empty:
            instance.members_attended.set(members_attended)

        if (
            visitors_attended is not serializers.empty
            or created_visitors
            or promoted_people
        ):
            if visitors_attended is serializers.empty:
                current = list(instance.visitors_attended.all())
            else:
                current = list(visitors_attended)
            visitor_set = current + created_visitors + promoted_people
            seen = set()
            unique_visitors = []
            for person in visitor_set:
                if person.pk not in seen:
                    seen.add(person.pk)
                    unique_visitors.append(person)
            instance.visitors_attended.set(unique_visitors)

        if prospects_invited is not serializers.empty or created_prospects:
            if prospects_invited is serializers.empty:
                current_invited = list(instance.prospects_invited.all())
            else:
                current_invited = list(prospects_invited)
            invited_set = current_invited + created_prospects
            promoted_prospect_ids = (
                {p.pk for p in prospects_attended} if prospects_attended else set()
            )
            invited_set = [p for p in invited_set if p.pk not in promoted_prospect_ids]
            # Unlink only — never delete Prospect rows
            instance.prospects_invited.set(invited_set)

        return instance


class ClusterComplianceNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = ClusterComplianceNote
        fields = [
            "id",
            "cluster",
            "note",
            "created_by",
            "created_at",
            "updated_at",
            "period_start",
            "period_end",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_created_by(self, obj):
        if obj.created_by:
            return {
                "id": obj.created_by.id,
                "first_name": obj.created_by.first_name,
                "last_name": obj.created_by.last_name,
                "username": obj.created_by.username,
            }
        return None


class ClusterComplianceSerializer(serializers.Serializer):
    cluster = ClusterSerializer(read_only=True)
    status = serializers.CharField()
    reports_submitted = serializers.IntegerField()
    reports_expected = serializers.IntegerField()
    compliance_rate = serializers.FloatField()
    missing_weeks = serializers.ListField(child=serializers.IntegerField())
    last_report_date = serializers.DateField(allow_null=True)
    days_since_last_report = serializers.IntegerField(allow_null=True)
    consecutive_missing_weeks = serializers.IntegerField()
    trend = serializers.CharField()
    compliance_notes = ClusterComplianceNoteSerializer(many=True, read_only=True)


class ComplianceSummarySerializer(serializers.Serializer):
    total_clusters = serializers.IntegerField()
    compliant_clusters = serializers.IntegerField()
    non_compliant_clusters = serializers.IntegerField()
    partial_compliant_clusters = serializers.IntegerField()
    compliance_rate = serializers.FloatField()
    period = serializers.DictField()

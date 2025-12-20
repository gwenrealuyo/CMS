from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
import logging

from apps.people.models import Person, Family, Journey
from .models import Cluster, ClusterWeeklyReport

logger = logging.getLogger(__name__)


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
            "location",
            "meeting_schedule",
            "description",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_coordinator(self, obj):
        if obj.coordinator:
            return {
                "id": obj.coordinator.id,
                "first_name": obj.coordinator.first_name,
                "last_name": obj.coordinator.last_name,
                "username": obj.coordinator.username,
            }
        return None

    def _get_cluster_display_name(self, cluster):
        """Get cluster code, name, or fallback identifier"""
        if cluster.code:
            return cluster.code
        if cluster.name:
            return cluster.name
        return f"Cluster {cluster.id}"

    def _create_membership_journeys(self, cluster, new_member_ids, old_member_ids=None, verified_by=None, previous_cluster_map=None):
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
        
        # Find removed members
        removed_member_ids = old_member_ids - new_member_ids
        
        # Handle removed members - delete "Joined Cluster" journeys if they exist
        if removed_member_ids:
            removed_persons = Person.objects.filter(id__in=removed_member_ids)
            title_to_delete = f"Joined Cluster - {cluster_display}"
            
            for person in removed_persons:
                # Check if person is now in another cluster (transfer case)
                current_clusters = person.clusters.exclude(id=cluster.id)
                if not current_clusters.exists():
                    # Person was removed and not transferred - delete journey for this specific cluster
                    try:
                        Journey.objects.filter(
                            user=person,
                            type='CLUSTER',
                            title=title_to_delete,
                            date=today
                        ).delete()
                    except Exception as e:
                        logger.error(f"Error deleting journey for removed member {person.id}: {str(e)}")
        
        # Create journeys for new members
        if added_member_ids:
            new_members = Person.objects.filter(id__in=added_member_ids)
            
            for person in new_members:
                # Check if this is a transfer
                # First check previous_cluster_map (from before update)
                prev_cluster_ids = previous_cluster_map.get(person.id, set())
                # Also check current clusters (excluding this one) in case they're still in another cluster
                current_other_clusters = person.clusters.exclude(id=cluster.id)
                
                is_transfer = bool(prev_cluster_ids) or current_other_clusters.exists()
                
                # Determine title and description first
                if is_transfer:
                    # Get the previous cluster for description
                    prev_cluster = None
                    if prev_cluster_ids:
                        # Get the first previous cluster
                        prev_cluster = Cluster.objects.filter(id__in=prev_cluster_ids).first()
                    if not prev_cluster and current_other_clusters.exists():
                        # Fallback to current other clusters
                        prev_cluster = current_other_clusters.first()
                    
                    if prev_cluster:
                        prev_cluster_display = self._get_cluster_display_name(prev_cluster)
                        title = f"Transferred to Cluster - {cluster_display}"
                        description = f"Transferred from {prev_cluster_display}"
                    else:
                        # Transfer detected but can't find previous cluster - use generic message
                        title = f"Transferred to Cluster - {cluster_display}"
                        description = "Transferred from another cluster"
                else:
                    title = f"Joined Cluster - {cluster_display}"
                    description = "Assigned to cluster"
                
                # Check for duplicate journey (exact title match)
                existing = Journey.objects.filter(
                    user=person,
                    date=today,
                    type='CLUSTER',
                    title=title
                ).exists()
                
                if not existing:
                    journeys_to_create.append(Journey(
                        user=person,
                        title=title,
                        date=today,
                        type='CLUSTER',
                        description=description,
                        verified_by=verified_by
                    ))
        
        if journeys_to_create:
            try:
                with transaction.atomic():
                    Journey.objects.bulk_create(journeys_to_create)
                logger.info(f"Created {len(journeys_to_create)} membership journeys for cluster {cluster.id}")
            except Exception as e:
                logger.error(f"Error creating membership journeys for cluster {cluster.id}: {str(e)}", exc_info=True)
                # Don't raise - allow cluster update to succeed even if journey creation fails

    def _add_family_members_to_cluster(self, instance, families):
        """
        Automatically add all members from assigned families to the cluster.
        This ensures that when a family is added to a cluster, all family members
        are also added. Users can manually remove individual members if needed.
        """
        # Get all members from the assigned families
        family_member_ids = set()
        for family in families:
            # Get all members of this family
            family_members = family.members.all()
            family_member_ids.update(member.id for member in family_members)
        
        # Get existing cluster members
        existing_member_ids = set(instance.members.values_list('id', flat=True))
        
        # Add new family members to existing members (union)
        all_member_ids = existing_member_ids | family_member_ids
        
        # Update the cluster's members
        if family_member_ids:  # Only update if there are family members to add
            instance.members.set(all_member_ids)

    def create(self, validated_data):
        families = validated_data.pop('families', [])
        members = validated_data.pop('members', [])
        
        # Get request user for verified_by
        request = self.context.get('request')
        verified_by = request.user if request and hasattr(request, 'user') else None
        
        # Create the cluster instance
        instance = super().create(validated_data)
        
        # Set families first
        instance.families.set(families)
        
        # Track old memberships (empty for create)
        old_member_ids = set()
        
        # Automatically add all family members to the cluster
        if families:
            self._add_family_members_to_cluster(instance, families)
        
        # Then add any individually specified members (union with family members)
        if members:
            existing_member_ids = set(instance.members.values_list('id', flat=True))
            new_member_ids = set(member.id for member in members)
            all_member_ids = existing_member_ids | new_member_ids
            instance.members.set(all_member_ids)
        else:
            # Refresh to get final member list after family addition
            instance.refresh_from_db()
        
        # Create journeys for initial members
        final_member_ids = set(instance.members.values_list('id', flat=True))
        if final_member_ids:
            self._create_membership_journeys(instance, final_member_ids, old_member_ids, verified_by)
        
        return instance

    def update(self, instance, validated_data):
        families = validated_data.pop('families', None)
        members = validated_data.pop('members', None)
        
        # Get request user for verified_by
        request = self.context.get('request')
        verified_by = request.user if request and hasattr(request, 'user') else None
        
        # Capture previous memberships before any changes
        old_member_ids = set(instance.members.values_list('id', flat=True))
        
        # Capture previous cluster memberships for each person (for transfer detection)
        previous_cluster_map = {}
        if old_member_ids:
            old_members = Person.objects.filter(id__in=old_member_ids).prefetch_related('clusters')
            for person in old_members:
                previous_cluster_map[person.id] = set(person.clusters.values_list('id', flat=True))
        
        # Update other fields first
        instance = super().update(instance, validated_data)
        
        # Update families if provided
        if families is not None:
            instance.families.set(families)
            # Automatically add all family members from the newly assigned families
            if families:
                self._add_family_members_to_cluster(instance, families)
        
        # Get all family members from currently assigned families (after update)
        current_families = list(instance.families.all())
        family_member_ids = set()
        if current_families:
            for family in current_families:
                family_members = family.members.all()
                family_member_ids.update(member.id for member in family_members)
        
        # Update members if provided
        if members is not None:
            # Union: combine user-specified members with family members
            user_member_ids = set(member.id for member in members)
            all_member_ids = user_member_ids | family_member_ids
            instance.members.set(all_member_ids)
        else:
            # If members not provided, ensure family members are still included
            if family_member_ids:
                existing_member_ids = set(instance.members.values_list('id', flat=True))
                all_member_ids = existing_member_ids | family_member_ids
                instance.members.set(all_member_ids)
        
        # Refresh to get final member list
        instance.refresh_from_db()
        new_member_ids = set(instance.members.values_list('id', flat=True))
        
        # Create journeys for membership changes
        if new_member_ids != old_member_ids:
            self._create_membership_journeys(instance, new_member_ids, old_member_ids, verified_by, previous_cluster_map)
        
        return instance


class ClusterWeeklyReportSerializer(serializers.ModelSerializer):
    submitted_by_details = serializers.SerializerMethodField()
    cluster_name = serializers.CharField(source="cluster.name", read_only=True)
    cluster_code = serializers.CharField(
        source="cluster.code", read_only=True, allow_null=True
    )
    members_attended = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.filter(role="MEMBER").exclude(role="ADMIN"), required=False
    )
    visitors_attended = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.filter(role="VISITOR").exclude(role="ADMIN"), required=False
    )
    # Read-only fields with full person details
    members_attended_details = serializers.SerializerMethodField()
    visitors_attended_details = serializers.SerializerMethodField()
    # Computed properties for backward compatibility
    members_present = serializers.IntegerField(read_only=True)
    visitors_present = serializers.IntegerField(read_only=True)
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
            "members_attended_details",
            "visitors_attended_details",
            "members_present",
            "visitors_present",
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
            "submitted_at",
            "updated_at",
            "members_present",
            "visitors_present",
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

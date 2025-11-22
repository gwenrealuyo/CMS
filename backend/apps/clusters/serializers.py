from rest_framework import serializers
from apps.people.models import Person, Family
from .models import Cluster, ClusterWeeklyReport


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
        
        # Create the cluster instance
        instance = super().create(validated_data)
        
        # Set families first
        instance.families.set(families)
        
        # Automatically add all family members to the cluster
        if families:
            self._add_family_members_to_cluster(instance, families)
        
        # Then add any individually specified members (union with family members)
        if members:
            existing_member_ids = set(instance.members.values_list('id', flat=True))
            new_member_ids = set(member.id for member in members)
            all_member_ids = existing_member_ids | new_member_ids
            instance.members.set(all_member_ids)
        
        return instance

    def update(self, instance, validated_data):
        families = validated_data.pop('families', None)
        members = validated_data.pop('members', None)
        
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

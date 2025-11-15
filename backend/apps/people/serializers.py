from rest_framework import serializers
from .models import Family, Cluster, Milestone, Person, ClusterWeeklyReport


class MilestoneSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    verified_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Milestone
        fields = [
            "id",
            "user",
            "title",
            "date",
            "type",
            "description",
            "type_display",
            "verified_by",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PersonSerializer(serializers.ModelSerializer):
    inviter = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True, required=False
    )
    photo = serializers.ImageField(required=False, allow_null=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    cluster_codes = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "middle_name",
            "suffix",
            "nickname",
            "gender",
            "facebook_name",
            "photo",
            "role",
            "phone",
            "address",
            "country",
            "date_of_birth",
            "date_first_attended",
            "water_baptism_date",
            "spirit_baptism_date",
            "has_finished_lessons",
            "inviter",
            "member_id",
            "status",
            "milestones",
            "cluster_codes",
            "family_names",
        ]
        read_only_fields = ["username"]

    def create(self, validated_data):
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")

        if first_name and last_name:
            # Get first two letters of first_name (or the whole first_name if shorter)
            first_two_letters = first_name[:2].lower()
            username = f"{first_two_letters}{last_name.lower()}"
        else:
            raise serializers.ValidationError(
                "Both first name and last name are required to generate username."
            )

        # Ensure username is unique
        original_username = username
        counter = 1
        while Person.objects.filter(username=username).exists():
            username = f"{original_username}{counter}"
            counter += 1

        validated_data["username"] = username
        return super().create(validated_data)

    def get_cluster_codes(self, obj: Person):
        return [code for code in obj.clusters.values_list("code", flat=True) if code]

    def get_family_names(self, obj: Person):
        return list(obj.families.values_list("name", flat=True))


class FamilySerializer(serializers.ModelSerializer):
    leader = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.all()
    )

    class Meta:
        model = Family
        fields = ["id", "name", "leader", "members", "address", "notes", "created_at"]
        read_only_fields = ["created_at"]


class ClusterSerializer(serializers.ModelSerializer):
    coordinator = PersonSerializer(read_only=True)
    coordinator_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(),
        source="coordinator",
        write_only=True,
        allow_null=True,
        required=False,
    )
    families = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Family.objects.all()
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.all()
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


class ClusterWeeklyReportSerializer(serializers.ModelSerializer):
    submitted_by_details = PersonSerializer(source="submitted_by", read_only=True)
    cluster_name = serializers.CharField(source="cluster.name", read_only=True)
    cluster_code = serializers.CharField(
        source="cluster.code", read_only=True, allow_null=True
    )
    members_attended = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.filter(role="MEMBER"), required=False
    )
    visitors_attended = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.filter(role="VISITOR"), required=False
    )
    # Read-only fields with full person details
    members_attended_details = PersonSerializer(
        source="members_attended", many=True, read_only=True
    )
    visitors_attended_details = PersonSerializer(
        source="visitors_attended", many=True, read_only=True
    )
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

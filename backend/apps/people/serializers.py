from rest_framework import serializers
from .models import Family, Journey, Person, ModuleCoordinator


class ModuleCoordinatorSerializer(serializers.ModelSerializer):
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    person_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ModuleCoordinator
        fields = [
            "id",
            "person",
            "person_name",
            "module",
            "module_display",
            "level",
            "level_display",
            "resource_id",
            "resource_type",
            "created_at",
        ]
        read_only_fields = ["created_at"]
    
    def get_person_name(self, obj):
        return obj.person.get_full_name() or obj.person.username


class JourneySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    verified_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Journey
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
    journeys = JourneySerializer(many=True, read_only=True)
    cluster_codes = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()
    module_coordinator_assignments = ModuleCoordinatorSerializer(many=True, read_only=True)

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
            "journeys",
            "cluster_codes",
            "family_names",
            "module_coordinator_assignments",
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
        from apps.clusters.models import Cluster
        return [code for code in obj.clusters.values_list("code", flat=True) if code]

    def get_family_names(self, obj: Person):
        return list(obj.families.values_list("name", flat=True))


class FamilySerializer(serializers.ModelSerializer):
    leader = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"), allow_null=True
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.exclude(role="ADMIN")
    )

    class Meta:
        model = Family
        fields = ["id", "name", "leader", "members", "address", "notes", "created_at"]
        read_only_fields = ["created_at"]


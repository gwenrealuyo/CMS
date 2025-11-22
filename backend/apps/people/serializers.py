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
    can_view_journey_timeline = serializers.SerializerMethodField()

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
            "can_view_journey_timeline",
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

    def get_can_view_journey_timeline(self, obj: Person):
        """
        Check if the current user can view the journey timeline for this person.
        Permission rules:
        1. Always allowed if viewing own profile
        2. ADMIN and PASTOR roles have full access
        3. Senior Coordinators in CLUSTER, EVANGELISM, SUNDAY_SCHOOL, or LESSONS modules
        4. Cluster Coordinators can see journey timelines for members of their assigned cluster(s)
        """
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        
        user = request.user
        
        # 1. Own profile - always allowed
        if user.id == obj.id:
            return True
        
        # 2. ADMIN and PASTOR roles - full access
        if user.role in ['ADMIN', 'PASTOR']:
            return True
        
        # 3. Senior Coordinators in allowed modules
        allowed_modules = [
            ModuleCoordinator.ModuleType.CLUSTER,
            ModuleCoordinator.ModuleType.EVANGELISM,
            ModuleCoordinator.ModuleType.SUNDAY_SCHOOL,
            ModuleCoordinator.ModuleType.LESSONS,
        ]
        for module in allowed_modules:
            if user.is_senior_coordinator(module):
                return True
        
        # 4. Cluster Coordinator - check if person is in their cluster(s)
        if user.is_module_coordinator(
            ModuleCoordinator.ModuleType.CLUSTER,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR
        ):
            # Get clusters where user is coordinator
            from apps.clusters.models import Cluster
            user_clusters = Cluster.objects.filter(coordinator=user)
            # Check if person is a direct member of any of these clusters
            return obj.clusters.filter(id__in=user_clusters.values_list('id', flat=True)).exists()
        
        return False


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


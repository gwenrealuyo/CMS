from rest_framework import serializers
from django.utils import timezone
from .models import Branch, Family, Journey, Person, ModuleCoordinator


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


class ModuleCoordinatorBulkCreateSerializer(serializers.Serializer):
    """
    Serializer for bulk creating multiple module coordinator assignments.
    Validates all assignments before creating any (atomic operation).
    """

    assignments = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text="List of assignment objects to create",
    )

    def validate_assignments(self, value):
        """
        Validate all assignments before creating any.
        """
        if not value:
            raise serializers.ValidationError("At least one assignment is required.")

        validated_assignments = []
        seen_combinations = set()

        for idx, assignment in enumerate(value):
            # Validate required fields
            if "person" not in assignment:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: 'person' field is required."
                )
            if "module" not in assignment:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: 'module' field is required."
                )
            if "level" not in assignment:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: 'level' field is required."
                )

            person_id = assignment["person"]
            module = assignment["module"]
            level = assignment["level"]
            resource_id = assignment.get("resource_id")
            resource_type = assignment.get("resource_type", "")

            # Validate person exists
            try:
                person = Person.objects.get(id=person_id)
            except Person.DoesNotExist:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: Person with ID {person_id} does not exist."
                )

            # Validate module and level choices
            if module not in [
                choice[0] for choice in ModuleCoordinator.ModuleType.choices
            ]:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: Invalid module '{module}'."
                )
            if level not in [
                choice[0] for choice in ModuleCoordinator.CoordinatorLevel.choices
            ]:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: Invalid level '{level}'."
                )

            # Check for duplicates within the request
            combination_key = (person_id, module, resource_id)
            if combination_key in seen_combinations:
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: Duplicate assignment (person={person_id}, module={module}, resource_id={resource_id})."
                )
            seen_combinations.add(combination_key)

            # Check for existing assignments (respect unique_together constraint)
            existing = ModuleCoordinator.objects.filter(
                person_id=person_id, module=module, resource_id=resource_id
            )
            if existing.exists():
                raise serializers.ValidationError(
                    f"Assignment {idx + 1}: Assignment already exists for person {person_id}, module {module}, resource_id {resource_id}."
                )

            validated_assignments.append(
                {
                    "person": person,
                    "module": module,
                    "level": level,
                    "resource_id": resource_id if resource_id else None,
                    "resource_type": resource_type,
                }
            )

        return validated_assignments

    def create(self, validated_data):
        """
        Create all assignments atomically.
        """
        assignments_data = validated_data["assignments"]
        created_assignments = []

        for assignment_data in assignments_data:
            assignment = ModuleCoordinator.objects.create(**assignment_data)
            created_assignments.append(assignment)

        return {"created": created_assignments}


class JourneySerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    user = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    verified_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"), allow_null=True, required=False
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


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            "id",
            "name",
            "code",
            "address",
            "phone",
            "email",
            "is_headquarters",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PersonSerializer(serializers.ModelSerializer):
    inviter = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True, required=False
    )
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(), allow_null=True, required=False
    )
    photo = serializers.ImageField(required=False, allow_null=True)
    journeys = JourneySerializer(many=True, read_only=True)
    cluster_codes = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()
    module_coordinator_assignments = ModuleCoordinatorSerializer(
        many=True, read_only=True
    )
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
            "branch",
            "member_id",
            "status",
            "journeys",
            "cluster_codes",
            "family_names",
            "module_coordinator_assignments",
            "can_view_journey_timeline",
        ]
        read_only_fields = ["username"]

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user and request.user.role == "MEMBER":
            role = attrs.get("role")
            if role != "VISITOR":
                raise serializers.ValidationError(
                    {"role": "Members can only create visitors."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.role == "MEMBER":
            validated_data["role"] = "VISITOR"
            validated_data["inviter"] = request.user
            validated_data["branch"] = request.user.branch

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

    def update(self, instance, validated_data):
        """Update person and track branch transfers"""
        # Store old branch value before update
        old_branch = instance.branch

        # Perform the update
        updated_instance = super().update(instance, validated_data)

        # Check if branch changed
        new_branch = updated_instance.branch
        if (
            old_branch != new_branch
            and old_branch is not None
            and new_branch is not None
        ):
            # Create Journey entry for branch transfer
            Journey.objects.create(
                user=updated_instance,
                type="BRANCH_TRANSFER",
                title="Branch Transfer",
                description=f"Transferred from {old_branch.name} to {new_branch.name}",
                date=timezone.now().date(),
                verified_by=None,
            )

        return updated_instance

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
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False

        user = request.user

        # 1. Own profile - always allowed
        if user.id == obj.id:
            return True

        # 2. ADMIN and PASTOR roles - full access
        if user.role in ["ADMIN", "PASTOR"]:
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
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR,
        ):
            # Get clusters where user is coordinator
            from apps.clusters.models import Cluster

            user_clusters = Cluster.objects.filter(coordinator=user)
            # Check if person is a direct member of any of these clusters
            return obj.clusters.filter(
                id__in=user_clusters.values_list("id", flat=True)
            ).exists()

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

    def _get_person_label(self, person: Person) -> str:
        return person.get_full_name() or person.username

    def _create_family_journeys(self, people, title: str, description: str) -> None:
        if not people:
            return
        journey_date = timezone.now().date()
        Journey.objects.bulk_create(
            [
                Journey(
                    user=person,
                    title=title,
                    description=description,
                    date=journey_date,
                    type="NOTE",
                )
                for person in people
            ]
        )

    def _build_family_created_description(self, family: Family) -> str:
        leader_name = (
            self._get_person_label(family.leader) if family.leader else "Unassigned"
        )
        member_count = family.members.count()
        return f"Leader: {leader_name}. Members: {member_count}."

    def _build_member_added_description(self, family: Family) -> str:
        leader_name = self._get_person_label(family.leader) if family.leader else None
        if leader_name:
            return f"Added to family led by {leader_name}."
        return "Added to family."

    def _build_address_updated_description(
        self, old_address: str, new_address: str
    ) -> str:
        old_value = old_address or "Not set"
        new_value = new_address or "Not set"
        return f'Address updated from "{old_value}" to "{new_value}".'

    def create(self, validated_data):
        members = validated_data.pop("members", [])
        family = super().create(validated_data)
        family._suppress_member_journeys = True
        if members:
            family.members.set(members)
        family._suppress_member_journeys = False
        people = list(family.members.all())
        if family.leader and family.leader not in people:
            people.append(family.leader)
        title = f"Family created: {family.name}"
        description = self._build_family_created_description(family)
        self._create_family_journeys(people, title, description)
        return family

    def update(self, instance, validated_data):
        previous_address = instance.address
        family = super().update(instance, validated_data)

        if previous_address != family.address:
            people = list(family.members.all())
            if family.leader and family.leader not in people:
                people.append(family.leader)
            title = f"Family address updated: {family.name}"
            description = self._build_address_updated_description(
                previous_address, family.address
            )
            self._create_family_journeys(people, title, description)

        return family

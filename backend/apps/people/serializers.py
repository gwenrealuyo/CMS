import secrets

from rest_framework import serializers
from django.utils import timezone
from .models import Branch, Family, Journey, Person, ModuleCoordinator, ModuleSetting
from apps.clusters.branch_membership import prune_person_from_mismatched_branch_clusters
from apps.clusters.models import Cluster
from apps.authentication.password_validators import PasswordStrengthValidator
from apps.events.models import EventType
from apps.people.coordinator_assignment_validation import (
    user_has_people_write_coordinator_assignment,
    validate_module_coordinator_assignment,
)
from apps.people.vital_dates import (
    strip_vital_date_attrs,
    user_can_edit_vital_dates,
)
from apps.people.name_formatting import (
    PERSON_NAME_FIELDS,
    apply_title_case_name_fields,
)
from apps.people.photo_validators import validate_person_photo


def delete_person_photo_if_cleared(instance, validated_data):
    if (
        "photo" in validated_data
        and validated_data["photo"] is None
        and instance.photo
    ):
        instance.photo.delete(save=False)


class ModuleCoordinatorSerializer(serializers.ModelSerializer):
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    person_name = serializers.SerializerMethodField()
    resource_scope_label = serializers.SerializerMethodField()

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
            "resource_scope_label",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_person_name(self, obj):
        return obj.person.get_full_name() or obj.person.username

    def get_resource_scope_label(self, obj):
        """Human-readable scope: senior module-wide oversight, cluster code, or None."""
        person = obj.person

        if (
            obj.level == ModuleCoordinator.CoordinatorLevel.SENIOR_COORDINATOR
            and obj.resource_id is None
        ):
            base = f"All {obj.get_module_display()} (oversight)"
            if person.branch_id and not person.can_see_all_branches():
                try:
                    branch_name = Branch.objects.only("name").get(
                        pk=person.branch_id
                    ).name
                    if branch_name:
                        return f"{base} — {branch_name.strip()}"
                except Branch.DoesNotExist:
                    pass
            return base

        if obj.resource_id is None:
            return None
        if obj.module != ModuleCoordinator.ModuleType.CLUSTER:
            return None
        try:
            from apps.clusters.models import Cluster

            c = Cluster.objects.only("code", "name").get(pk=obj.resource_id)
            if c.code:
                return c.code.strip()
            if c.name:
                return c.name.strip()
            return f"Cluster {c.id}"
        except Cluster.DoesNotExist:
            return None

    def validate(self, attrs):
        person = attrs.get("person") or getattr(self.instance, "person", None)
        module = attrs.get("module") or getattr(self.instance, "module", None)
        level = attrs.get("level") or getattr(self.instance, "level", None)
        resource_id = attrs.get("resource_id")
        if resource_id is None and "resource_id" not in attrs and self.instance:
            resource_id = self.instance.resource_id
        resource_type = attrs.get("resource_type")
        if resource_type is None and self.instance:
            resource_type = self.instance.resource_type

        if person and module and level:
            normalized = validate_module_coordinator_assignment(
                person=person,
                module=module,
                level=level,
                resource_id=resource_id,
                resource_type=resource_type or "",
            )
            attrs["resource_id"] = normalized["resource_id"]
            attrs["resource_type"] = normalized["resource_type"]
        return attrs


class ModuleSettingSerializer(serializers.ModelSerializer):
    module_display = serializers.CharField(source="get_module_display", read_only=True)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ModuleSetting
        fields = [
            "id",
            "module",
            "module_display",
            "is_enabled",
            "updated_at",
            "updated_by",
            "updated_by_name",
        ]
        read_only_fields = ["id", "module", "updated_at", "updated_by", "updated_by_name"]

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return None
        return obj.updated_by.get_full_name() or obj.updated_by.username


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

            normalized = validate_module_coordinator_assignment(
                person=person,
                module=module,
                level=level,
                resource_id=resource_id,
                resource_type=resource_type,
            )

            validated_assignments.append(
                {
                    "person": person,
                    "module": module,
                    "level": level,
                    "resource_id": normalized["resource_id"],
                    "resource_type": normalized["resource_type"],
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
        queryset=Branch.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    photo = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[validate_person_photo],
    )
    note = serializers.CharField(write_only=True, required=False, allow_blank=True)
    journeys = JourneySerializer(many=True, read_only=True)
    cluster_codes = serializers.SerializerMethodField()
    branch_code = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()
    family_ids = serializers.PrimaryKeyRelatedField(
        source="families",
        many=True,
        queryset=Family.objects.all(),
        required=False,
    )
    cluster_ids = serializers.PrimaryKeyRelatedField(
        source="clusters",
        many=True,
        queryset=Cluster.objects.all(),
        required=False,
    )
    module_coordinator_assignments = ModuleCoordinatorSerializer(
        many=True, read_only=True
    )
    can_view_journey_timeline = serializers.SerializerMethodField()
    can_view_profile = serializers.SerializerMethodField()
    initial_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    generate_temporary_password = serializers.BooleanField(
        write_only=True, required=False, default=True
    )
    temporary_password = serializers.CharField(read_only=True, required=False)
    first_activity_attended = serializers.SlugRelatedField(
        slug_field="code",
        queryset=EventType.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Person
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "middle_name",
            "suffix",
            "nickname",
            "maiden_name",
            "gender",
            "facebook_name",
            "photo",
            "role",
            "phone",
            "address",
            "country",
            "date_of_birth",
            "date_first_invited",
            "date_first_attended",
            "first_activity_attended",
            "water_baptism_date",
            "spirit_baptism_date",
            "has_finished_lessons",
            "lessons_finished_at",
            "inviter",
            "branch",
            "branch_code",
            "member_id",
            "status",
            "note",
            "journeys",
            "cluster_codes",
            "family_names",
            "family_ids",
            "cluster_ids",
            "module_coordinator_assignments",
            "can_view_journey_timeline",
            "can_view_profile",
            "initial_password",
            "generate_temporary_password",
            "temporary_password",
        ]
        read_only_fields = ["username"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._temporary_password = None

    def _apply_memberships(self, person, families=None, clusters=None):
        # Apply from the forward M2M side so family/cluster member signals
        # receive Family/Cluster as instance (not Person).
        if families is not None:
            desired_ids = {f.pk for f in families}
            for family in list(person.families.all()):
                if family.pk not in desired_ids:
                    family.members.remove(person)
            for family in families:
                family.members.add(person)
        if clusters is not None:
            desired_ids = {c.pk for c in clusters}
            for cluster in list(person.clusters.all()):
                if cluster.pk not in desired_ids:
                    cluster.members.remove(person)
            for cluster in clusters:
                cluster.members.add(person)

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)

        # A "plain member" is a MEMBER with no ModuleCoordinator assignments. Members
        # who coordinate a module write like coordinators; only plain members are
        # restricted to creating visitors.
        is_plain_member = bool(
            request
            and request.user
            and request.user.is_authenticated
            and request.user.role == "MEMBER"
            and not user_has_people_write_coordinator_assignment(request.user)
        )

        # Plain members editing themselves may not change staff-controlled fields.
        if (
            is_plain_member
            and instance
            and request
            and instance.pk == request.user.pk
        ):
            for field in (
                "role",
                "status",
                "branch",
                "families",
                "clusters",
                "member_id",
                "username",
                "inviter",
            ):
                attrs.pop(field, None)

        # Vital dates: cluster coordinator+ only (strip for everyone else on update).
        if (
            instance
            and request
            and request.user
            and request.user.is_authenticated
            and not user_can_edit_vital_dates(request.user, instance)
        ):
            strip_vital_date_attrs(attrs)

        # Member-created visitors get branch from inviter in create(); inviter must have a branch
        if is_plain_member and not instance:
            role = attrs.get("role")
            if role != "VISITOR":
                raise serializers.ValidationError(
                    {"role": "Members can only create visitors."}
                )
            if not request.user.branch:
                raise serializers.ValidationError(
                    {
                        "branch": (
                            "Your account must have a branch assigned before adding visitors."
                        )
                    }
                )

        requested_role = attrs.get("role")
        if requested_role is not None and request and request.user.is_authenticated:
            user = request.user
            if requested_role == "ADMIN" and user.role != "ADMIN":
                raise serializers.ValidationError(
                    {"role": "Only admins can assign the Admin role."}
                )
            if requested_role == "PASTOR" and user.role not in ("ADMIN", "PASTOR"):
                raise serializers.ValidationError(
                    {"role": "You cannot assign the Pastor role."}
                )
            if (
                user.role == "MEMBER"
                and user_has_people_write_coordinator_assignment(user)
                and requested_role not in ("MEMBER", "VISITOR")
            ):
                raise serializers.ValidationError(
                    {"role": "Module coordinators can only assign Member or Visitor roles."}
                )

        # App-layer required branch (DB column may still be null for legacy rows)
        branch_in_attrs = "branch" in attrs

        if not instance:
            if not is_plain_member:
                if not attrs.get("branch"):
                    raise serializers.ValidationError(
                        {"branch": "Branch is required."}
                    )
        else:
            if branch_in_attrs and attrs.get("branch") is None:
                raise serializers.ValidationError(
                    {"branch": "Branch cannot be cleared."}
                )
            merged_branch = attrs.get("branch") if branch_in_attrs else instance.branch
            if merged_branch is None:
                raise serializers.ValidationError(
                    {"branch": "Branch is required."}
                )

        has_finished_lessons = attrs.get(
            "has_finished_lessons",
            instance.has_finished_lessons if instance else False,
        )
        lessons_finished_at = attrs.get(
            "lessons_finished_at",
            instance.lessons_finished_at if instance else None,
        )
        toggling_lessons_complete_on = (
            bool(instance)
            and attrs.get("has_finished_lessons") is True
            and not instance.has_finished_lessons
        )

        if (not instance and has_finished_lessons) or toggling_lessons_complete_on:
            if not lessons_finished_at:
                raise serializers.ValidationError(
                    {
                        "lessons_finished_at": (
                            "Set lessons finished date when marking lessons as finished."
                        )
                    }
                )

        if not instance and request and request.user.role == "ADMIN":
            role = attrs.get("role", "MEMBER")
            if role != "VISITOR":
                initial_password = (attrs.get("initial_password") or "").strip()
                generate_temp = attrs.get("generate_temporary_password", True)
                if initial_password:
                    PasswordStrengthValidator()(initial_password)
                elif not generate_temp:
                    raise serializers.ValidationError(
                        {
                            "initial_password": (
                                "Login-capable roles require a password. "
                                "Enable auto-generate or provide initial_password."
                            )
                        }
                    )
        elif not instance:
            attrs.pop("initial_password", None)
            attrs.pop("generate_temporary_password", None)

        if attrs.get("first_activity_attended") == "":
            attrs["first_activity_attended"] = None

        today = timezone.localdate()
        person_date_fields = (
            "date_of_birth",
            "date_first_invited",
            "date_first_attended",
            "water_baptism_date",
            "spirit_baptism_date",
            "lessons_finished_at",
        )
        future_date_errors = {}
        for field_name in person_date_fields:
            if field_name not in attrs:
                continue
            value = attrs.get(field_name)
            if value is not None and value > today:
                future_date_errors[field_name] = "Cannot be in the future."
        if future_date_errors:
            raise serializers.ValidationError(future_date_errors)

        apply_title_case_name_fields(attrs, PERSON_NAME_FIELDS)

        gender = attrs.get(
            "gender",
            getattr(instance, "gender", None) if instance else None,
        )
        if gender == "MALE":
            attrs["maiden_name"] = ""

        return attrs

    def _trigger_legacy_lessons_backfill(
        self,
        *,
        person: Person,
        previous_has_finished_lessons: bool,
        previous_lessons_finished_at,
    ) -> None:
        if not person.has_finished_lessons or not person.lessons_finished_at:
            return

        should_backfill = (
            not previous_has_finished_lessons
            or previous_lessons_finished_at != person.lessons_finished_at
        )
        if not should_backfill:
            return

        request = self.context.get("request")
        completed_by = request.user if request and isinstance(request.user, Person) else None

        from apps.lessons.services import backfill_missing_completed_lessons_for_person

        backfill_missing_completed_lessons_for_person(
            person,
            lessons_finished_at=person.lessons_finished_at,
            completed_by=completed_by,
        )

    def create(self, validated_data):
        request = self.context.get("request")
        is_plain_member = bool(
            request
            and request.user
            and request.user.role == "MEMBER"
            and not user_has_people_write_coordinator_assignment(request.user)
        )
        if is_plain_member:
            validated_data["role"] = "VISITOR"
            validated_data["inviter"] = request.user
            validated_data["branch"] = request.user.branch

        note = validated_data.pop("note", "").strip() if "note" in validated_data else ""
        initial_password = (validated_data.pop("initial_password", None) or "").strip()
        generate_temporary_password = validated_data.pop(
            "generate_temporary_password", True
        )
        families = (
            validated_data.pop("families") if "families" in validated_data else None
        )
        clusters = (
            validated_data.pop("clusters") if "clusters" in validated_data else None
        )

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
        person = super().create(validated_data)
        self._apply_memberships(person, families=families, clusters=clusters)

        if (
            request
            and request.user.role == "ADMIN"
            and person.role != "VISITOR"
        ):
            password = None
            if initial_password:
                password = initial_password
            elif generate_temporary_password:
                password = secrets.token_urlsafe(10)
                self._temporary_password = password

            if password:
                person.set_password(password)
                person.must_change_password = True
                person.first_login = True
                person.save(
                    update_fields=["password", "must_change_password", "first_login"]
                )

        self._trigger_legacy_lessons_backfill(
            person=person,
            previous_has_finished_lessons=False,
            previous_lessons_finished_at=None,
        )

        if note:
            Journey.objects.create(
                user=person,
                type="NOTE",
                title="Visitor note",
                description=note,
                date=person.date_first_attended or timezone.now().date(),
                verified_by=None,
            )

        return person

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self._temporary_password:
            data["temporary_password"] = self._temporary_password
        return data

    def update(self, instance, validated_data):
        """Update person and track branch transfers"""
        previous_has_finished_lessons = instance.has_finished_lessons
        previous_lessons_finished_at = instance.lessons_finished_at
        # Store old branch value before update
        old_branch = instance.branch

        families = (
            validated_data.pop("families") if "families" in validated_data else None
        )
        clusters = (
            validated_data.pop("clusters") if "clusters" in validated_data else None
        )

        delete_person_photo_if_cleared(instance, validated_data)

        # Perform the update
        updated_instance = super().update(instance, validated_data)
        self._apply_memberships(
            updated_instance, families=families, clusters=clusters
        )
        self._trigger_legacy_lessons_backfill(
            person=updated_instance,
            previous_has_finished_lessons=previous_has_finished_lessons,
            previous_lessons_finished_at=previous_lessons_finished_at,
        )

        new_branch = updated_instance.branch
        if old_branch != new_branch:
            prune_person_from_mismatched_branch_clusters(updated_instance)

        # Check if branch changed (named transfers logged as journeys)
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
        # Use .all() so prefetched clusters are reused (avoids N+1 on list).
        return [c.code for c in obj.clusters.all() if c.code]

    def get_branch_code(self, obj: Person):
        branch = getattr(obj, "branch", None)
        if branch and branch.code:
            return branch.code
        return None

    def get_family_names(self, obj: Person):
        return [f.name for f in obj.families.all()]

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
            from apps.clusters.permissions import managed_cluster_ids_for_coordinator

            cluster_ids = managed_cluster_ids_for_coordinator(user)
            if not cluster_ids:
                return False
            return obj.clusters.filter(id__in=cluster_ids).exists()

        return False

    def get_can_view_profile(self, obj: Person):
        """
        Whether the requester may open this person's profile (retrieve).

        Cluster coordinators can list/search same-branch people, but profile
        access stays limited to managed-cluster scope (and other module scopes).
        """
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False

        user = request.user
        if user.id == obj.id:
            return True

        if self.context.get("profile_all_visible"):
            return True

        profile_visible_ids = self.context.get("profile_visible_ids")
        if profile_visible_ids is not None:
            return obj.pk in profile_visible_ids

        # retrieve/create/update responses: if the object was returned, allow.
        view = self.context.get("view")
        if view is not None and hasattr(view, "_scoped_people_queryset"):
            return (
                view._scoped_people_queryset(for_profile=True)
                .filter(pk=obj.pk)
                .exists()
            )

        return True


class PersonListSerializer(serializers.ModelSerializer):
    """Slim read-only serializer for paginated directory / search list responses."""

    cluster_codes = serializers.SerializerMethodField()
    branch_code = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()
    can_view_profile = serializers.SerializerMethodField()
    cluster_ids = serializers.PrimaryKeyRelatedField(
        source="clusters", many=True, read_only=True
    )
    first_activity_attended = serializers.SlugRelatedField(
        slug_field="code", read_only=True
    )

    class Meta:
        model = Person
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "middle_name",
            "suffix",
            "nickname",
            "maiden_name",
            "gender",
            "facebook_name",
            "photo",
            "role",
            "phone",
            "address",
            "country",
            "status",
            "branch",
            "branch_code",
            "member_id",
            "date_of_birth",
            "date_first_attended",
            "water_baptism_date",
            "spirit_baptism_date",
            "first_activity_attended",
            "cluster_codes",
            "cluster_ids",
            "family_names",
            "can_view_profile",
        ]

    def get_cluster_codes(self, obj: Person):
        return [c.code for c in obj.clusters.all() if c.code]

    def get_branch_code(self, obj: Person):
        branch = getattr(obj, "branch", None)
        if branch and branch.code:
            return branch.code
        return None

    def get_family_names(self, obj: Person):
        return [f.name for f in obj.families.all()]

    def get_can_view_profile(self, obj: Person):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return False

        user = request.user
        if user.id == obj.id:
            return True

        if self.context.get("profile_all_visible"):
            return True

        profile_visible_ids = self.context.get("profile_visible_ids")
        if profile_visible_ids is not None:
            return obj.pk in profile_visible_ids

        view = self.context.get("view")
        if view is not None and hasattr(view, "_scoped_people_queryset"):
            return (
                view._scoped_people_queryset(for_profile=True)
                .filter(pk=obj.pk)
                .exists()
            )

        return True


class FamilySerializer(serializers.ModelSerializer):
    leader = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"), allow_null=True
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.exclude(role="ADMIN")
    )

    class Meta:
        model = Family
        fields = [
            "id",
            "name",
            "leader",
            "members",
            "branch",
            "address",
            "notes",
            "is_active",
            "created_at",
        ]
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

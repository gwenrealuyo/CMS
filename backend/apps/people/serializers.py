from rest_framework import serializers
from .models import Family, Cluster, Milestone, Person


class PersonSerializer(serializers.ModelSerializer):
    inviter = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True, required=False
    )
    photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Person
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "middle_name",
            "suffix",
            "gender",
            "facebook_name",
            "photo",
            "role",
            "phone",
            "address",
            "country",
            "date_of_birth",
            "date_first_attended",
            "inviter",
            "member_id",
            "status",
            "username",
        ]
        read_only_fields = ["username"]

    def create(self, validated_data):
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")

        if first_name and last_name:
            username = f"{first_name[0].lower()}{last_name.lower()}"
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


class MilestoneSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    verified_by = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True
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
            "verified_by",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class FamilySerializer(serializers.ModelSerializer):
    leader = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True
    )
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Person.objects.all()
    )

    class Meta:
        model = Family
        fields = ["id", "name", "leader", "members", "address", "created_at"]
        read_only_fields = ["created_at"]


class ClusterSerializer(serializers.ModelSerializer):
    coordinator = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.all(), allow_null=True
    )
    families = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Family.objects.all()
    )

    class Meta:
        model = Cluster
        fields = [
            "id",
            "code",
            "name",
            "coordinator",
            "families",
            "description",
            "created_at",
        ]
        read_only_fields = ["created_at"]

from rest_framework import serializers
from .models import Family, Cluster, Milestone, Person

class PersonSerializer(serializers.ModelSerializer):
    inviter = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), allow_null=True)
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
            "status"
        ]

class MilestoneSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all())
    verified_by = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), allow_null=True)

    class Meta:
        model = Milestone
        fields = [
            "id", "user", "title", "date", "type", "description", "verified_by", "created_at"
        ]
        read_only_fields = ["created_at"]

class FamilySerializer(serializers.ModelSerializer):
    leader = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), allow_null=True)
    members = serializers.PrimaryKeyRelatedField(many=True, queryset=Person.objects.all())

    class Meta:
        model = Family
        fields = [
            "id", "name", "leader", "members", "address", "created_at"
        ]
        read_only_fields = ["created_at"]

class ClusterSerializer(serializers.ModelSerializer):
    coordinator = serializers.PrimaryKeyRelatedField(queryset=Person.objects.all(), allow_null=True)
    families = serializers.PrimaryKeyRelatedField(many=True, queryset=Family.objects.all())

    class Meta:
        model = Cluster
        fields = [
            "id", "code", "name", "coordinator", "families", "description", "created_at"
        ]
        read_only_fields = ["created_at"]

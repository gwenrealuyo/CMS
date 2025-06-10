from rest_framework import serializers
from .models import Ministry, MinistryMember

class MinistryMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = MinistryMember
        fields = ['id', 'member', 'ministry', 'role', 'join_date', 'is_active']

class MinistrySerializer(serializers.ModelSerializer):
    members = MinistryMemberSerializer(many=True, read_only=True, source='ministrymember_set')

    class Meta:
        model = Ministry
        fields = ['id', 'name', 'description', 'leader', 'members']

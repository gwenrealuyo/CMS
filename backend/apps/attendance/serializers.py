from rest_framework import serializers

from apps.events.models import Event
from apps.people.models import Person
from core.datetime_utils import church_calendar_date

from .models import AttendanceRecord


class AttendancePersonSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    cluster_codes = serializers.SerializerMethodField()
    family_names = serializers.SerializerMethodField()
    first_family_name = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "first_name",
            "middle_name",
            "last_name",
            "suffix",
            "nickname",
            "role",
            "status",
            "member_id",
            "full_name",
            "phone",
            "cluster_codes",
            "family_names",
            "first_family_name",
        ]
        read_only_fields = fields

    def get_full_name(self, obj: Person) -> str:
        parts = [obj.first_name]
        if obj.nickname:
            parts.append(f'"{obj.nickname}"')
        parts.extend([obj.middle_name, obj.last_name, obj.suffix])
        return " ".join(filter(None, parts)).strip()

    def get_cluster_codes(self, obj: Person):
        return [code for code in obj.clusters.values_list("code", flat=True) if code]

    def get_family_names(self, obj: Person):
        return list(obj.families.values_list("name", flat=True))

    def get_first_family_name(self, obj: Person):
        return obj.families.values_list("name", flat=True).first()


class AttendanceRecordSerializer(serializers.ModelSerializer):
    person = AttendancePersonSerializer(read_only=True)
    person_id = serializers.PrimaryKeyRelatedField(
        queryset=Person.objects.exclude(role="ADMIN"),
        source="person",
        write_only=True,
    )
    event_id = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(),
        source="event",
        write_only=True,
    )
    journey_id = serializers.IntegerField(source="journey.id", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "event",
            "event_id",
            "person",
            "person_id",
            "occurrence_date",
            "status",
            "notes",
            "journey_id",
            "recorded_at",
            "updated_at",
        ]
        read_only_fields = ["event", "journey_id", "recorded_at", "updated_at"]
        validators = []

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Remove write-only identifiers in responses
        representation.pop("event_id", None)
        representation.pop("person_id", None)
        return representation

    def create(self, validated_data):
        defaults = {
            "status": validated_data.get(
                "status", AttendanceRecord.AttendanceStatus.PRESENT
            ),
            "notes": validated_data.get("notes", ""),
        }
        event = validated_data["event"]
        person = validated_data["person"]

        if not event.is_recurring:
            target_date = (
                church_calendar_date(event.start_date)
                or validated_data["occurrence_date"]
            )
            existing = list(
                AttendanceRecord.objects.filter(event=event, person=person).order_by(
                    "-recorded_at", "id"
                )
            )
            if existing:
                record = existing[0]
                AttendanceRecord.objects.filter(event=event, person=person).exclude(
                    pk=record.pk
                ).delete()
                record.occurrence_date = target_date
                record.status = defaults["status"]
                record.notes = defaults["notes"]
                record.save()
                self._was_created = False
                return record
            record = AttendanceRecord.objects.create(
                event=event,
                person=person,
                occurrence_date=target_date,
                **defaults,
            )
            self._was_created = True
            return record

        record, created = AttendanceRecord.objects.update_or_create(
            event=event,
            person=person,
            occurrence_date=validated_data["occurrence_date"],
            defaults=defaults,
        )
        self._was_created = created
        return record

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            if attr in {"event", "person"}:
                continue
            setattr(instance, attr, value)
        instance.save()
        self._was_created = False
        return instance

    @property
    def was_created(self) -> bool:
        return getattr(self, "_was_created", False)

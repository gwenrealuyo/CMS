from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.events.models import AttendanceVenue, Event
from apps.events.services.registration import require_registration_for_checkin
from apps.people.models import Person
from apps.people.name_formatting import format_person_display_name
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
        return format_person_display_name(obj) or obj.username

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
    attendance_venue = serializers.PrimaryKeyRelatedField(
        queryset=AttendanceVenue.objects.all(),
        allow_null=True,
        required=False,
    )
    attendance_venue_label = serializers.CharField(
        source="attendance_venue.label", read_only=True, allow_null=True
    )
    attendance_venue_color = serializers.CharField(
        source="attendance_venue.color", read_only=True, allow_null=True
    )

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
            "attendance_mode",
            "attendance_venue",
            "attendance_venue_label",
            "attendance_venue_color",
            "notes",
            "journey_id",
            "recorded_at",
            "updated_at",
        ]
        read_only_fields = [
            "event",
            "journey_id",
            "recorded_at",
            "updated_at",
            "attendance_venue_label",
            "attendance_venue_color",
        ]
        validators = []

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation.pop("event_id", None)
        representation.pop("person_id", None)
        venue = representation.get("attendance_venue")
        if venue is not None and hasattr(venue, "code"):
            representation["attendance_venue"] = venue.code
        elif instance.attendance_venue_id:
            representation["attendance_venue"] = instance.attendance_venue_id
        return representation

    def validate(self, attrs):
        attrs = super().validate(attrs)
        mode = attrs.get(
            "attendance_mode",
            getattr(self.instance, "attendance_mode", None)
            or AttendanceRecord.AttendanceMode.ONSITE,
        )
        venue = attrs.get(
            "attendance_venue",
            getattr(self.instance, "attendance_venue", None)
            if self.instance
            else None,
        )
        # Distinguish omitted vs explicitly null for create
        if self.instance is None and "attendance_venue" not in attrs:
            venue = None
        if "attendance_mode" not in attrs and self.instance is None:
            mode = AttendanceRecord.AttendanceMode.ONSITE

        event = attrs.get("event") or getattr(self.instance, "event", None)
        attendance_format = (
            getattr(event, "attendance_format", None) if event is not None else None
        )
        online_only = attendance_format == "online_only"
        onsite_only = attendance_format == "onsite_only"

        if mode == AttendanceRecord.AttendanceMode.ONSITE:
            if online_only:
                raise ValidationError(
                    {
                        "attendance_mode": (
                            "This event is online only; use online attendance."
                        )
                    }
                )
            # Explicit non-null venue with Onsite is invalid; otherwise clear venue
            # (including when switching Online → Onsite without sending venue).
            if "attendance_venue" in attrs and attrs.get("attendance_venue") is not None:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Onsite attendance cannot have an online venue."
                        )
                    }
                )
            attrs["attendance_venue"] = None
        elif mode == AttendanceRecord.AttendanceMode.ONLINE:
            if onsite_only:
                raise ValidationError(
                    {
                        "attendance_mode": (
                            "This event is onsite only; use onsite attendance."
                        )
                    }
                )
            if online_only:
                if venue is not None:
                    raise ValidationError(
                        {
                            "attendance_venue": (
                                "Online-only events do not use an online venue."
                            )
                        }
                    )
                attrs["attendance_venue"] = None
            elif venue is None:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Online attendance requires an online venue."
                        )
                    }
                )
            elif not venue.is_active:
                raise ValidationError(
                    {
                        "attendance_venue": (
                            "Selected online venue is not active."
                        )
                    }
                )
        attrs["attendance_mode"] = mode

        status_value = attrs.get(
            "status",
            getattr(self.instance, "status", None)
            or AttendanceRecord.AttendanceStatus.PRESENT,
        )
        if (
            self.instance is None
            and status_value == AttendanceRecord.AttendanceStatus.PRESENT
        ):
            event = attrs.get("event") or getattr(self.instance, "event", None)
            person = attrs.get("person") or getattr(self.instance, "person", None)
            occurrence_date = attrs.get("occurrence_date")
            if event is not None and person is not None:
                request = self.context.get("request") if self.context else None
                user = getattr(request, "user", None) if request else None
                is_admin_override = (
                    getattr(user, "role", None) == "ADMIN"
                    if user and getattr(user, "is_authenticated", False)
                    else False
                )
                if not event.is_recurring and occurrence_date is None:
                    occurrence_date = church_calendar_date(event.start_date)
                require_registration_for_checkin(
                    event,
                    person,
                    mode,
                    occurrence_date,
                    is_admin_override=is_admin_override,
                )
        return attrs

    def create(self, validated_data):
        defaults = {
            "status": validated_data.get(
                "status", AttendanceRecord.AttendanceStatus.PRESENT
            ),
            "notes": validated_data.get("notes", ""),
            "attendance_mode": validated_data.get(
                "attendance_mode", AttendanceRecord.AttendanceMode.ONSITE
            ),
            "attendance_venue": validated_data.get("attendance_venue"),
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
                # First check-in is final for mode/venue; keep existing row.
                record = existing[0]
                AttendanceRecord.objects.filter(event=event, person=person).exclude(
                    pk=record.pk
                ).delete()
                if record.occurrence_date != target_date:
                    record.occurrence_date = target_date
                    record.save(update_fields=["occurrence_date", "updated_at"])
                self._was_created = False
                self._already_checked_in = True
                return record
            record = AttendanceRecord.objects.create(
                event=event,
                person=person,
                occurrence_date=target_date,
                **defaults,
            )
            self._was_created = True
            self._already_checked_in = False
            return record

        existing = AttendanceRecord.objects.filter(
            event=event,
            person=person,
            occurrence_date=validated_data["occurrence_date"],
        ).first()
        if existing:
            self._was_created = False
            self._already_checked_in = True
            return existing

        record = AttendanceRecord.objects.create(
            event=event,
            person=person,
            occurrence_date=validated_data["occurrence_date"],
            **defaults,
        )
        self._was_created = True
        self._already_checked_in = False
        return record

    def update(self, instance, validated_data):
        # Explicit staff PATCH may correct mode/venue; create/POST still
        # keeps first check-in final via create().
        for attr, value in validated_data.items():
            if attr in {"event", "person"}:
                continue
            setattr(instance, attr, value)
        instance.save()
        self._was_created = False
        self._already_checked_in = False
        return instance

    @property
    def was_created(self) -> bool:
        return getattr(self, "_was_created", False)

    @property
    def already_checked_in(self) -> bool:
        return getattr(self, "_already_checked_in", False)

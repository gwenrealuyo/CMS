from datetime import date
from typing import Optional

from django.utils import dateparse, timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.attendance.serializers import AttendanceRecordSerializer
from .models import Event, EventType
from .services.recurrence import clean_weekly_pattern, generate_occurrences

import re

EVENT_TYPE_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_/]*$")


class EventTypeSerializer(serializers.ModelSerializer):
    event_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = EventType
        fields = [
            "code",
            "label",
            "color",
            "sort_order",
            "is_system",
            "event_count",
        ]
        read_only_fields = ["is_system", "event_count"]

    def validate_code(self, value):
        if not EVENT_TYPE_CODE_PATTERN.match(value):
            raise ValidationError(
                "Code must start with a letter and contain only uppercase letters, numbers, underscores, or slashes."
            )
        if self.instance and value != self.instance.code:
            raise ValidationError("Event type code cannot be changed.")
        return value

    def validate_color(self, value):
        normalized = value.strip().upper()
        if not re.fullmatch(r"#[0-9A-F]{6}", normalized):
            raise ValidationError("Color must be a hex value like #RRGGBB.")
        return normalized

    def validate(self, attrs):
        if self.instance:
            attrs.pop("code", None)
        return super().validate(attrs)


class EventSerializer(serializers.ModelSerializer):
    type = serializers.SlugRelatedField(
        slug_field="code",
        queryset=EventType.objects.all(),
        source="event_type",
    )
    type_display = serializers.CharField(source="event_type.label", read_only=True)
    branch_name = serializers.CharField(
        source="branch.name", read_only=True, allow_null=True
    )
    occurrences = serializers.SerializerMethodField()
    next_occurrence = serializers.SerializerMethodField()
    attendance_count = serializers.SerializerMethodField()
    attendance_records = serializers.SerializerMethodField()
    attendee_badges = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "start_date",
            "end_date",
            "type",
            "type_display",
            "location",
            "branch",
            "branch_name",
            "is_recurring",
            "recurrence_pattern",
            "occurrences",
            "next_occurrence",
            "attendee_badges",
            "attendance_count",
            "attendance_records",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_by",
            "updated_by_name",
            "updated_at",
        ]
        read_only_fields = [
            "attendee_badges",
            "attendance_count",
            "attendance_records",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_by",
            "updated_by_name",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return None
        return obj.updated_by.get_full_name() or obj.updated_by.username

    def _parse_dt(self, value: Optional[str]):
        if not value:
            return None
        parsed = dateparse.parse_datetime(value)
        if not parsed:
            return None
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def _get_occurrence_payload(self, obj):
        cached = getattr(obj, "_occurrence_cache", None)
        if cached is not None:
            return cached

        request = self.context.get("request") if self.context else None
        start_param = request.query_params.get("start") if request else None
        end_param = request.query_params.get("end") if request else None

        start_dt = self._parse_dt(start_param)
        end_dt = self._parse_dt(end_param)

        pattern = {}
        if obj.is_recurring:
            pattern = clean_weekly_pattern(obj.recurrence_pattern, obj.start_date)

        occurrences = generate_occurrences(obj, pattern, start_dt, end_dt)
        payload = [occ.as_dict() for occ in occurrences]
        obj._occurrence_cache = payload
        return payload

    def get_occurrences(self, obj):
        return self._get_occurrence_payload(obj)

    def get_next_occurrence(self, obj):
        occurrences = self._get_occurrence_payload(obj)
        if not occurrences:
            return None

        now = timezone.now()
        for occurrence in occurrences:
            start_value = self._parse_dt(occurrence.get("start_date"))
            if start_value and start_value >= now:
                return occurrence
        return occurrences[0]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        start_date = attrs.get("start_date") or getattr(instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(instance, "end_date", None)
        if start_date and end_date and end_date <= start_date:
            raise ValidationError({"end_date": "End date must be after start date."})

        raw_pattern = attrs.get("recurrence_pattern")
        is_recurring = attrs.get(
            "is_recurring",
            getattr(instance, "is_recurring", False),
        )
        if raw_pattern and not is_recurring:
            is_recurring = True
            attrs["is_recurring"] = True

        if is_recurring:
            if not start_date or not end_date:
                raise ValidationError(
                    "Recurring events require both start_date and end_date."
                )
            cleaned_pattern = clean_weekly_pattern(raw_pattern, start_date)
            attrs["recurrence_pattern"] = cleaned_pattern
        else:
            attrs["recurrence_pattern"] = None

        return super().validate(attrs)

    def _should_include_attendance_records(self) -> bool:
        request = self.context.get("request") if self.context else None
        if not request:
            return True
        flag = request.query_params.get("include_attendance", "")
        return flag.lower() in {"1", "true", "yes", "on"}

    def _filter_attendance_queryset(self, obj):
        queryset = obj.attendance_records.all()
        request = self.context.get("request") if self.context else None
        if not request:
            return queryset

        occurrence_date = request.query_params.get("attendance_date")
        if occurrence_date:
            try:
                target_date = date.fromisoformat(occurrence_date)
                queryset = queryset.filter(occurrence_date=target_date)
            except ValueError:
                # Invalid date filters yield empty results
                queryset = queryset.none()
        return queryset

    def get_attendance_count(self, obj):
        return self._filter_attendance_queryset(obj).count()

    def get_attendance_records(self, obj):
        queryset = self._filter_attendance_queryset(obj)
        if not self._should_include_attendance_records():
            return []
        serializer = AttendanceRecordSerializer(
            queryset, many=True, context=self.context
        )
        return serializer.data

    def get_attendee_badges(self, obj):
        queryset = self._filter_attendance_queryset(obj)
        badges = []
        for record in queryset.select_related("person"):
            person = record.person
            cluster_code = (
                person.clusters.values_list("code", flat=True)
                .exclude(code__isnull=True)
                .exclude(code__exact="")
                .first()
            )
            family_name = person.families.values_list("name", flat=True).first()
            badges.append(
                {
                    "id": str(person.pk),
                    "full_name": " ".join(
                        filter(
                            None,
                            [
                                person.first_name,
                                person.middle_name,
                                person.last_name,
                                person.suffix,
                            ],
                        )
                    ),
                    "cluster_code": cluster_code,
                    "family_name": family_name,
                }
            )
        return badges

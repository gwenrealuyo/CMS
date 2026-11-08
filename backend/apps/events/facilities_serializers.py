from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from apps.events.models import (
    EquipmentBooking,
    EquipmentBookingItem,
    EquipmentType,
    Event,
    Vehicle,
    VehicleBooking,
    VehicleDriver,
    VehicleTripLog,
)
from apps.events.services.booking import initial_booking_status
from apps.events.services.equipment_conflicts import validate_equipment_quantities
from apps.events.services.vehicle_conflicts import validate_vehicle_booking

User = get_user_model()


class EquipmentTypeSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(
        source="branch.name", read_only=True, allow_null=True
    )

    class Meta:
        model = EquipmentType
        fields = [
            "id",
            "branch",
            "branch_name",
            "name",
            "quantity_available",
            "notes",
            "is_active",
            "sort_order",
        ]

    def validate_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValidationError("Name is required.")
        return cleaned

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        name = attrs.get("name") or getattr(instance, "name", None)
        branch = attrs.get("branch") if "branch" in attrs else getattr(
            instance, "branch", None
        )
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and user.is_authenticated and not user.can_see_all_branches():
            if not user.branch_id:
                raise ValidationError(
                    {"branch": "Your account has no branch assigned."}
                )
            branch = user.branch
            attrs["branch"] = branch
        if not branch:
            raise ValidationError({"branch": "Branch is required."})
        if name:
            qs = EquipmentType.objects.filter(branch=branch, name__iexact=name)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise ValidationError(
                    {"name": "An equipment type with this name already exists."}
                )
        return attrs


class EquipmentBookingItemSerializer(serializers.ModelSerializer):
    equipment_type_name = serializers.CharField(
        source="equipment_type.name", read_only=True
    )

    class Meta:
        model = EquipmentBookingItem
        fields = [
            "id",
            "equipment_type",
            "equipment_type_name",
            "quantity",
            "requester_remarks",
            "received_at",
            "received_condition",
            "received_notes",
            "returned_at",
            "returned_condition",
            "returned_notes",
            "handoff_by",
        ]
        read_only_fields = [
            "id",
            "received_at",
            "received_condition",
            "received_notes",
            "returned_at",
            "returned_condition",
            "returned_notes",
            "handoff_by",
        ]


class EquipmentBookingItemWriteSerializer(serializers.Serializer):
    equipment_type = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentType.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)
    requester_remarks = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


class EquipmentBookingSerializer(serializers.ModelSerializer):
    items = EquipmentBookingItemSerializer(many=True, read_only=True)
    items_write = EquipmentBookingItemWriteSerializer(
        many=True, write_only=True, required=False
    )
    event = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())
    event_title = serializers.CharField(source="event.title", read_only=True)
    event_room_name = serializers.CharField(
        source="event.room.name", read_only=True, allow_null=True
    )
    branch_name = serializers.CharField(
        source="branch.name", read_only=True, allow_null=True
    )
    created_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentBooking
        fields = [
            "id",
            "title",
            "event",
            "event_title",
            "event_room_name",
            "branch",
            "branch_name",
            "start_date",
            "end_date",
            "notes",
            "booking_status",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_note",
            "items",
            "items_write",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = [
            "branch",
            "booking_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_by",
            "created_at",
            "updated_by",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by_id:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        event = attrs.get("event", getattr(instance, "event", None))
        if event is None:
            raise ValidationError(
                {"event": "Equipment borrows must be linked to an event."}
            )
        if event.room_id is None:
            raise ValidationError(
                {
                    "event": (
                        "Choose an event that uses a church room. "
                        "Off-site events cannot borrow building equipment."
                    )
                }
            )
        if event.booking_status == Event.BookingStatus.REJECTED:
            raise ValidationError(
                {"event": "Cannot borrow equipment for a rejected event."}
            )

        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        branch = event.branch
        if not branch:
            raise ValidationError(
                {"event": "The selected event has no branch."}
            )
        if (
            user
            and user.is_authenticated
            and not user.can_see_all_branches()
            and user.branch_id
            and branch.pk != user.branch_id
        ):
            raise ValidationError(
                {"event": "You can only borrow equipment for your branch."}
            )

        attrs["branch"] = branch
        # Default borrow window to the event schedule when omitted.
        start = attrs.get("start_date", getattr(instance, "start_date", None))
        end = attrs.get("end_date", getattr(instance, "end_date", None))
        if start is None:
            start = event.start_date
            attrs["start_date"] = start
        if end is None:
            end = event.end_date
            attrs["end_date"] = end
        if start < event.start_date or end > event.end_date:
            raise ValidationError(
                {
                    "start_date": (
                        "Equipment borrow time must fall within the "
                        "linked event schedule."
                    )
                }
            )
        if not attrs.get("title") and not getattr(instance, "title", None):
            attrs["title"] = f"Equipment for {event.title}"

        items_data = attrs.get("items_write")
        if items_data is None:
            if instance is None:
                raise ValidationError({"items_write": "Items are required."})
            items_data = [
                {
                    "equipment_type": row.equipment_type,
                    "quantity": row.quantity,
                }
                for row in instance.items.all()
            ]
        validate_equipment_quantities(
            branch_id=branch.pk,
            start=start,
            end=end,
            items=items_data,
            exclude_booking_id=getattr(instance, "pk", None),
        )
        attrs["_items_data"] = items_data
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("_items_data", [])
        validated_data.pop("items_write", None)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        booking = EquipmentBooking.objects.create(
            **validated_data,
            booking_status=initial_booking_status(user),
            created_by=user,
            updated_by=user,
        )
        self._replace_items(booking, items_data)
        return booking

    @transaction.atomic
    def update(self, instance, validated_data):
        items_data = validated_data.pop("_items_data", None)
        validated_data.pop("items_write", None)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.updated_by = user
        if user and not initial_booking_status(user) == EquipmentBooking.BookingStatus.APPROVED:
            # Non-publishers who change schedule return to pending
            from apps.events.permissions import can_publish_events

            if not can_publish_events(user):
                schedule_changed = any(
                    k in validated_data
                    for k in ("start_date", "end_date", "branch")
                ) or items_data is not None
                if (
                    schedule_changed
                    and instance.booking_status
                    == EquipmentBooking.BookingStatus.APPROVED
                ):
                    instance.booking_status = EquipmentBooking.BookingStatus.PENDING
        instance.save()
        if items_data is not None:
            self._replace_items(instance, items_data)
        return instance

    def _replace_items(self, booking, items_data):
        booking.items.all().delete()
        for item in items_data:
            EquipmentBookingItem.objects.create(
                booking=booking,
                equipment_type=item["equipment_type"],
                quantity=item["quantity"],
                requester_remarks=(item.get("requester_remarks") or "").strip(),
            )


class EquipmentHandoffSerializer(serializers.Serializer):
    received_condition = serializers.ChoiceField(
        choices=EquipmentBookingItem.Condition.choices,
        required=False,
        allow_blank=True,
    )
    received_notes = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    returned_condition = serializers.ChoiceField(
        choices=EquipmentBookingItem.Condition.choices,
        required=False,
        allow_blank=True,
    )
    returned_notes = serializers.CharField(
        required=False, allow_blank=True, default=""
    )
    mark_received = serializers.BooleanField(required=False, default=False)
    mark_returned = serializers.BooleanField(required=False, default=False)


class VehicleDriverSerializer(serializers.ModelSerializer):
    person_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleDriver
        fields = ["id", "vehicle", "person", "person_name"]

    def get_person_name(self, obj):
        return obj.person.get_full_name() or obj.person.username


class VehicleSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(
        source="branch.name", read_only=True, allow_null=True
    )
    drivers = VehicleDriverSerializer(many=True, read_only=True)
    driver_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        source="driver_people",
    )

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "branch",
            "branch_name",
            "name",
            "is_active",
            "notes",
            "last_odometer",
            "last_rfid_balance",
            "sort_order",
            "drivers",
            "driver_ids",
        ]
        read_only_fields = ["last_odometer", "last_rfid_balance"]

    def validate_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValidationError("Name is required.")
        return cleaned

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        name = attrs.get("name") or getattr(instance, "name", None)
        branch = attrs.get("branch") if "branch" in attrs else getattr(
            instance, "branch", None
        )
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and user.is_authenticated and not user.can_see_all_branches():
            branch = user.branch
            attrs["branch"] = branch
        if not branch:
            raise ValidationError({"branch": "Branch is required."})
        if name:
            qs = Vehicle.objects.filter(branch=branch, name__iexact=name)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise ValidationError(
                    {"name": "A vehicle with this name already exists."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        people = validated_data.pop("driver_people", None)
        vehicle = Vehicle.objects.create(**validated_data)
        if people is not None:
            self._set_drivers(vehicle, people)
        return vehicle

    @transaction.atomic
    def update(self, instance, validated_data):
        people = validated_data.pop("driver_people", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if people is not None:
            self._set_drivers(instance, people)
        return instance

    def _set_drivers(self, vehicle, people):
        VehicleDriver.objects.filter(vehicle=vehicle).delete()
        VehicleDriver.objects.bulk_create(
            [VehicleDriver(vehicle=vehicle, person=person) for person in people]
        )


class VehicleTripLogSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    booking = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = VehicleTripLog
        fields = [
            "id",
            "booking",
            "leg",
            "odometer",
            "rfid_balance",
            "recorded_by",
            "recorded_by_name",
            "recorded_at",
            "notes",
        ]
        read_only_fields = ["id", "booking", "recorded_by", "recorded_at"]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by_id:
            return None
        return obj.recorded_by.get_full_name() or obj.recorded_by.username


class VehicleBookingSerializer(serializers.ModelSerializer):
    vehicle_name = serializers.CharField(source="vehicle.name", read_only=True)
    preferred_driver_name = serializers.SerializerMethodField()
    assigned_driver_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    trip_logs = VehicleTripLogSerializer(many=True, read_only=True)

    class Meta:
        model = VehicleBooking
        fields = [
            "id",
            "title",
            "vehicle",
            "vehicle_name",
            "start_date",
            "end_date",
            "notes",
            "preferred_driver",
            "preferred_driver_name",
            "assigned_driver",
            "assigned_driver_name",
            "booking_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "trip_logs",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = [
            "assigned_driver",
            "booking_status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_by",
            "created_at",
            "updated_by",
            "updated_at",
        ]

    def get_preferred_driver_name(self, obj):
        if not obj.preferred_driver_id:
            return None
        return (
            obj.preferred_driver.get_full_name() or obj.preferred_driver.username
        )

    def get_assigned_driver_name(self, obj):
        if not obj.assigned_driver_id:
            return None
        return obj.assigned_driver.get_full_name() or obj.assigned_driver.username

    def get_created_by_name(self, obj):
        if not obj.created_by_id:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        vehicle = attrs.get("vehicle", getattr(instance, "vehicle", None))
        start = attrs.get("start_date", getattr(instance, "start_date", None))
        end = attrs.get("end_date", getattr(instance, "end_date", None))
        preferred = attrs.get(
            "preferred_driver",
            getattr(instance, "preferred_driver", None) if instance else None,
        )
        if vehicle is None:
            raise ValidationError({"vehicle": "Vehicle is required."})
        validate_vehicle_booking(
            vehicle_id=vehicle.pk,
            start=start,
            end=end,
            exclude_booking_id=getattr(instance, "pk", None),
        )
        if preferred is not None:
            if not VehicleDriver.objects.filter(
                vehicle=vehicle, person=preferred
            ).exists():
                raise ValidationError(
                    {
                        "preferred_driver": (
                            "Preferred driver must be on this vehicle's allowlist."
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return VehicleBooking.objects.create(
            **validated_data,
            booking_status=initial_booking_status(user),
            created_by=user,
            updated_by=user,
        )

    def update(self, instance, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        from apps.events.permissions import can_publish_events

        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.updated_by = user
        if not can_publish_events(user):
            schedule_changed = any(
                k in validated_data
                for k in ("start_date", "end_date", "vehicle")
            )
            if (
                schedule_changed
                and instance.booking_status
                == VehicleBooking.BookingStatus.APPROVED
            ):
                instance.booking_status = VehicleBooking.BookingStatus.PENDING
        instance.save()
        return instance

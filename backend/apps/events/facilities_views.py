from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsAuthenticatedAndNotVisitor,
    IsMemberOrAbove,
)
from apps.events.facilities_serializers import (
    EquipmentBookingSerializer,
    EquipmentHandoffSerializer,
    EquipmentTypeSerializer,
    VehicleBookingSerializer,
    VehicleSerializer,
    VehicleTripLogSerializer,
)
from apps.events.models import (
    EquipmentBooking,
    EquipmentBookingItem,
    EquipmentType,
    Vehicle,
    VehicleBooking,
    VehicleDriver,
    VehicleTripLog,
)
from apps.events.permissions import (
    CanManageEventRooms,
    apply_event_room_branch_scope,
    can_approve_event_booking,
    can_create_event,
    can_publish_events,
)
from apps.events.services.equipment_conflicts import validate_equipment_quantities
from apps.events.services.vehicle_conflicts import validate_vehicle_booking


class EquipmentTypeViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentTypeSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]

    def get_queryset(self):
        qs = EquipmentType.objects.select_related("branch")
        return apply_event_room_branch_scope(
            qs, self.request.user, self.request.query_params.get("branch")
        )

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), CanManageEventRooms()]

    def perform_create(self, serializer):
        user = self.request.user
        if not user.can_see_all_branches():
            serializer.save(branch_id=user.branch_id)
        else:
            serializer.save()


class EquipmentBookingViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentBookingSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]

    def get_queryset(self):
        qs = EquipmentBooking.objects.select_related(
            "branch",
            "event",
            "event__room",
            "created_by",
            "reviewed_by",
        ).prefetch_related("items__equipment_type")
        qs = qs.exclude(booking_status=EquipmentBooking.BookingStatus.REJECTED)
        user = self.request.user
        if not can_approve_event_booking(user):
            qs = qs.filter(
                Q(booking_status=EquipmentBooking.BookingStatus.APPROVED)
                | Q(
                    booking_status=EquipmentBooking.BookingStatus.PENDING,
                    created_by=user,
                )
            )
        qs = apply_event_room_branch_scope(
            qs, user, self.request.query_params.get("branch")
        )
        status_param = self.request.query_params.get("booking_status")
        if status_param:
            qs = qs.filter(booking_status=status_param)
        return qs

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action in ["approve", "reject", "handoff"]:
            return [IsAuthenticatedAndNotVisitor(), CanManageEventRooms()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def create(self, request, *args, **kwargs):
        if not can_create_event(request.user):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        booking = self.get_object()
        user = request.user
        if not can_publish_events(user) and booking.created_by_id != user.id:
            return Response(
                {"detail": "You can only edit your own bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        user = request.user
        if not can_publish_events(user) and booking.created_by_id != user.id:
            return Response(
                {"detail": "You can only cancel your own bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        booking = self.get_object()
        items = [
            {
                "equipment_type": item.equipment_type,
                "quantity": item.quantity,
            }
            for item in booking.items.select_related("equipment_type")
        ]
        validate_equipment_quantities(
            branch_id=booking.branch_id,
            start=booking.start_date,
            end=booking.end_date,
            items=items,
            exclude_booking_id=booking.pk,
        )
        booking.booking_status = EquipmentBooking.BookingStatus.APPROVED
        booking.reviewed_by = request.user
        booking.reviewed_at = timezone.now()
        booking.review_note = (request.data.get("review_note") or "").strip()
        booking.updated_by = request.user
        booking.save()
        return Response(EquipmentBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        booking = self.get_object()
        booking.booking_status = EquipmentBooking.BookingStatus.REJECTED
        booking.reviewed_by = request.user
        booking.reviewed_at = timezone.now()
        booking.review_note = (request.data.get("review_note") or "").strip()
        booking.updated_by = request.user
        booking.save()
        return Response(EquipmentBookingSerializer(booking).data)

    @action(detail=True, methods=["post"], url_path=r"items/(?P<item_id>[^/.]+)/handoff")
    def handoff(self, request, pk=None, item_id=None):
        booking = self.get_object()
        if booking.booking_status != EquipmentBooking.BookingStatus.APPROVED:
            return Response(
                {"detail": "Handoff is only available for approved bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item = booking.items.get(pk=item_id)
        except EquipmentBookingItem.DoesNotExist:
            return Response(
                {"detail": "Item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = EquipmentHandoffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        now = timezone.now()
        if data.get("mark_received"):
            item.received_at = now
            item.received_condition = data.get("received_condition") or ""
            item.received_notes = (data.get("received_notes") or "").strip()
        if data.get("mark_returned"):
            item.returned_at = now
            item.returned_condition = data.get("returned_condition") or ""
            item.returned_notes = (data.get("returned_notes") or "").strip()
        item.handoff_by = request.user
        item.save()
        booking = (
            EquipmentBooking.objects.select_related(
                "branch",
                "event",
                "event__room",
                "created_by",
                "reviewed_by",
            )
            .prefetch_related("items__equipment_type")
            .get(pk=booking.pk)
        )
        return Response(EquipmentBookingSerializer(booking).data)


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]

    def get_queryset(self):
        qs = Vehicle.objects.select_related("branch").prefetch_related(
            "drivers__person"
        )
        return apply_event_room_branch_scope(
            qs, self.request.user, self.request.query_params.get("branch")
        )

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), CanManageEventRooms()]

    def perform_create(self, serializer):
        user = self.request.user
        if not user.can_see_all_branches():
            serializer.save(branch_id=user.branch_id)
        else:
            serializer.save()


class VehicleBookingViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleBookingSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor]

    def get_queryset(self):
        qs = VehicleBooking.objects.select_related(
            "vehicle",
            "preferred_driver",
            "assigned_driver",
            "created_by",
            "reviewed_by",
        ).prefetch_related("trip_logs")
        qs = qs.exclude(booking_status=VehicleBooking.BookingStatus.REJECTED)
        user = self.request.user
        if not can_approve_event_booking(user):
            qs = qs.filter(
                Q(booking_status=VehicleBooking.BookingStatus.APPROVED)
                | Q(
                    booking_status=VehicleBooking.BookingStatus.PENDING,
                    created_by=user,
                )
            )
        branch_param = self.request.query_params.get("branch")
        if branch_param:
            qs = qs.filter(vehicle__branch_id=branch_param)
        elif not user.can_see_all_branches() and user.branch_id:
            qs = qs.filter(vehicle__branch_id=user.branch_id)
        status_param = self.request.query_params.get("booking_status")
        if status_param:
            qs = qs.filter(booking_status=status_param)
        return qs

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action in [
            "approve",
            "reject",
            "assign_driver",
            "trip_logs",
        ]:
            return [IsAuthenticatedAndNotVisitor(), CanManageEventRooms()]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def create(self, request, *args, **kwargs):
        if not can_create_event(request.user):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        booking = self.get_object()
        user = request.user
        if not can_publish_events(user) and booking.created_by_id != user.id:
            return Response(
                {"detail": "You can only edit your own bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        user = request.user
        if not can_publish_events(user) and booking.created_by_id != user.id:
            return Response(
                {"detail": "You can only cancel your own bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        booking = self.get_object()
        validate_vehicle_booking(
            vehicle_id=booking.vehicle_id,
            start=booking.start_date,
            end=booking.end_date,
            exclude_booking_id=booking.pk,
        )
        booking.booking_status = VehicleBooking.BookingStatus.APPROVED
        booking.reviewed_by = request.user
        booking.reviewed_at = timezone.now()
        booking.review_note = (request.data.get("review_note") or "").strip()
        booking.updated_by = request.user
        booking.save()
        return Response(VehicleBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        booking = self.get_object()
        booking.booking_status = VehicleBooking.BookingStatus.REJECTED
        booking.reviewed_by = request.user
        booking.reviewed_at = timezone.now()
        booking.review_note = (request.data.get("review_note") or "").strip()
        booking.updated_by = request.user
        booking.save()
        return Response(VehicleBookingSerializer(booking).data)

    @action(detail=True, methods=["post"], url_path="assign-driver")
    def assign_driver(self, request, pk=None):
        booking = self.get_object()
        driver_id = request.data.get("assigned_driver")
        if driver_id in (None, ""):
            booking.assigned_driver = None
        else:
            try:
                driver = VehicleDriver.objects.select_related("person").get(
                    vehicle_id=booking.vehicle_id, person_id=driver_id
                )
            except VehicleDriver.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Assigned driver must be on this vehicle's allowlist."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            booking.assigned_driver = driver.person
        booking.updated_by = request.user
        booking.save(update_fields=["assigned_driver", "updated_by", "updated_at"])
        return Response(VehicleBookingSerializer(booking).data)

    @action(detail=True, methods=["get", "post"], url_path="trip-logs")
    def trip_logs(self, request, pk=None):
        booking = self.get_object()
        if request.method == "GET":
            logs = booking.trip_logs.select_related("recorded_by")
            return Response(VehicleTripLogSerializer(logs, many=True).data)

        serializer = VehicleTripLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leg = serializer.validated_data["leg"]
        odometer = serializer.validated_data["odometer"]
        rfid_balance = serializer.validated_data["rfid_balance"]
        notes = (serializer.validated_data.get("notes") or "").strip()
        existing = booking.trip_logs.filter(leg=leg).first()
        if existing:
            existing.odometer = odometer
            existing.rfid_balance = rfid_balance
            existing.notes = notes
            existing.recorded_by = request.user
            existing.recorded_at = timezone.now()
            existing.save(
                update_fields=[
                    "odometer",
                    "rfid_balance",
                    "notes",
                    "recorded_by",
                    "recorded_at",
                ]
            )
            log = existing
            created = False
        else:
            log = VehicleTripLog.objects.create(
                booking=booking,
                leg=leg,
                odometer=odometer,
                rfid_balance=rfid_balance,
                notes=notes,
                recorded_by=request.user,
            )
            created = True
        vehicle = booking.vehicle
        vehicle.last_odometer = log.odometer
        vehicle.last_rfid_balance = log.rfid_balance
        vehicle.save(update_fields=["last_odometer", "last_rfid_balance"])
        return Response(
            VehicleTripLogSerializer(log).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsAdmin, IsAuthenticatedAndNotVisitor
from apps.events.models import Event, EventRegistration, EventRegistrationTier
from apps.events.registration_serializers import (
    EventRegistrationPaymentSerializer,
    EventRegistrationRequestSerializer,
    EventRegistrationSerializer,
    EventRegistrationTierSerializer,
)
from apps.events.services.registration import create_registration, record_payment


class EventRegistrationTierViewSet(viewsets.ModelViewSet):
    serializer_class = EventRegistrationTierSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor, IsAdmin]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["event_pk"])

    def get_queryset(self):
        return EventRegistrationTier.objects.filter(
            event_id=self.kwargs["event_pk"]
        ).order_by("sort_order", "id")

    def perform_create(self, serializer):
        serializer.save(event=self.get_event())

    def perform_update(self, serializer):
        serializer.save(event=self.get_event())


class EventRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = EventRegistrationSerializer
    permission_classes = [IsAuthenticatedAndNotVisitor, IsAdmin]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["event_pk"])

    def get_queryset(self):
        qs = EventRegistration.objects.select_related(
            "person", "tier", "created_by", "event"
        ).prefetch_related("payments__recorded_by")
        event_pk = self.kwargs.get("event_pk")
        if event_pk is not None:
            qs = qs.filter(event_id=event_pk)
        return qs.order_by("-created_at", "id")

    def list(self, request, *args, **kwargs):
        self.get_event()
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="request")
    def request_registration(self, request, event_pk=None):
        event = self.get_event()
        serializer = EventRegistrationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tier = data.get("tier")
        if tier is not None and tier.event_id != event.pk:
            return Response(
                {"tier": ["Tier does not belong to this event."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registration = create_registration(
            event=event,
            person=data["person"],
            mode=data["mode"],
            tier=tier,
            occurrence_date=data.get("occurrence_date"),
            created_by=request.user,
            allow_capacity_override=bool(data.get("allow_capacity_override")),
            is_admin_caller=True,
        )
        out = EventRegistrationSerializer(
            registration, context={"request": request}
        )
        return Response(out.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None, event_pk=None):
        registration = self.get_object()
        registration.status = EventRegistration.Status.CANCELLED
        registration.save(update_fields=["status", "updated_at"])
        serializer = self.get_serializer(registration)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="refund")
    def refund(self, request, pk=None, event_pk=None):
        registration = self.get_object()
        registration.status = EventRegistration.Status.REFUNDED
        registration.save(update_fields=["status", "updated_at"])
        serializer = self.get_serializer(registration)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="payments")
    def payments(self, request, pk=None, event_pk=None):
        registration = self.get_object()
        if request.method.lower() == "get":
            serializer = EventRegistrationPaymentSerializer(
                registration.payments.select_related("recorded_by"),
                many=True,
                context={"request": request},
            )
            return Response(serializer.data)

        serializer = EventRegistrationPaymentSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        payment = record_payment(
            registration=registration,
            amount=serializer.validated_data["amount"],
            method=serializer.validated_data["method"],
            paid_at=serializer.validated_data.get("paid_at") or timezone.now(),
            recorded_by=request.user,
            note=serializer.validated_data.get("note") or "",
            provider=serializer.validated_data.get("provider") or "",
            provider_ref=serializer.validated_data.get("provider_ref") or "",
        )
        registration.refresh_from_db()
        return Response(
            {
                "payment": EventRegistrationPaymentSerializer(
                    payment, context={"request": request}
                ).data,
                "registration": EventRegistrationSerializer(
                    registration, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

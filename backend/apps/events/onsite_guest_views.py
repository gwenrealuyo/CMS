"""Staff onsite Sunday guest encode API (Events write)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance.models import AttendanceRecord
from apps.attendance.serializers import AttendanceRecordSerializer
from apps.authentication.permissions import IsAuthenticatedAndNotVisitor
from apps.evangelism.models import Prospect
from apps.evangelism.services import mark_prospect_attended
from apps.events.models import EventType
from apps.events.permissions import has_events_write
from apps.events.services.self_checkin import (
    SUNDAY_SERVICE_TYPE,
    checked_in_person_ids,
    create_visitor_guest_person,
    exact_name_matches,
    exact_prospect_name_matches,
    invited_prospect_scope_for_event,
    parse_event_id,
    parse_first_time_attending,
    parse_occurrence_date,
    people_scope_for_event,
    person_full_name,
    resolve_onsite_guest_session,
    resolve_optional_inviter,
    search_people_by_name,
    search_prospects_by_name,
    serialize_event_option,
    serialize_person_slim,
    serialize_prospect_match,
    serialize_session_event,
    validate_guest_encode_fields,
    visitor_scope_for_event,
)
from apps.people.models import Person


class HasEventsWrite(BasePermission):
    def has_permission(self, request, view):
        return bool(
            getattr(request, "user", None)
            and has_events_write(request.user)
        )


STAFF_PERMISSIONS = [IsAuthenticatedAndNotVisitor, HasEventsWrite]


def _event_id_from_request(request) -> int | None:
    raw = request.query_params.get("event")
    if raw in (None, ""):
        raw = request.data.get("event_id") if hasattr(request, "data") else None
    return parse_event_id(raw)


def _occurrence_date_from_request(request):
    raw = request.query_params.get("occurrence")
    if raw in (None, ""):
        raw = (
            request.data.get("occurrence_date") if hasattr(request, "data") else None
        )
    return parse_occurrence_date(raw)


def _unavailable_payload(resolved) -> dict:
    return {
        "available": False,
        "reason": resolved.reason or "no_service_today",
        "occurrence_date": (
            resolved.occurrence_date.isoformat()
            if resolved.occurrence_date
            else None
        ),
        "needs_selection": False,
        "can_encode_visitors": True,
        "session": None,
        "options": [],
    }


def _options_payload(resolved) -> dict:
    return {
        "available": True,
        "reason": None,
        "occurrence_date": (
            resolved.occurrence_date.isoformat()
            if resolved.occurrence_date
            else None
        ),
        "needs_selection": True,
        "can_encode_visitors": True,
        "session": None,
        "options": [
            serialize_event_option(event, occ) for event, occ in resolved.options
        ],
    }


def _session_payload(resolved, request) -> dict:
    event = resolved.event
    occ = resolved.occurrence
    occurrence_date = resolved.occurrence_date
    checked = checked_in_person_ids(event, occurrence_date)
    return {
        "available": True,
        "reason": None,
        "occurrence_date": occurrence_date.isoformat(),
        "needs_selection": False,
        "can_encode_visitors": True,
        "session": {
            "event": serialize_session_event(event, occ),
            "occurrence_date": occurrence_date.isoformat(),
            "start": occ.start.isoformat(),
            "end": occ.end.isoformat(),
            "already_checked_in_ids": sorted(checked),
        },
        "options": [serialize_event_option(event, occ)],
    }


def build_session_response(request, resolved):
    if not resolved.available:
        status_code = (
            status.HTTP_400_BAD_REQUEST
            if resolved.reason == "invalid_event"
            else status.HTTP_200_OK
        )
        return Response(_unavailable_payload(resolved), status=status_code)
    if resolved.needs_selection:
        return Response(_options_payload(resolved))
    return Response(_session_payload(resolved, request))


def _resolve_or_error(request):
    resolved = resolve_onsite_guest_session(
        request.user,
        event_id=_event_id_from_request(request),
        occurrence_date=_occurrence_date_from_request(request),
    )
    if not resolved.available or resolved.needs_selection or not resolved.event:
        if resolved.needs_selection:
            return None, Response(
                {
                    "detail": "Select a Sunday Service first.",
                    **_options_payload(resolved),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        status_code = (
            status.HTTP_400_BAD_REQUEST
            if resolved.reason == "invalid_event"
            else status.HTTP_400_BAD_REQUEST
        )
        return None, Response(
            {
                "detail": "Onsite guest check-in is not available right now.",
                **_unavailable_payload(resolved),
            },
            status=status_code,
        )
    return resolved, None


def _upsert_onsite_present(event, person, occurrence_date, request):
    serializer = AttendanceRecordSerializer(
        data={
            "event_id": event.pk,
            "person_id": person.pk,
            "occurrence_date": occurrence_date.isoformat(),
            "status": "PRESENT",
            "attendance_mode": AttendanceRecord.AttendanceMode.ONSITE,
            "attendance_venue": None,
        },
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    record = serializer.save()
    return record, serializer.was_created, serializer.already_checked_in


class OnsiteGuestSessionView(APIView):
    permission_classes = STAFF_PERMISSIONS

    def get(self, request):
        resolved = resolve_onsite_guest_session(
            request.user,
            event_id=_event_id_from_request(request),
            occurrence_date=_occurrence_date_from_request(request),
        )
        return build_session_response(request, resolved)


class OnsiteGuestVisitorsView(APIView):
    permission_classes = STAFF_PERMISSIONS

    def get(self, request):
        resolved, error = _resolve_or_error(request)
        if error:
            return error

        query = (request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response({"results": [], "query": query})

        checked = checked_in_person_ids(resolved.event, resolved.occurrence_date)
        people = search_people_by_name(
            visitor_scope_for_event(request.user, resolved.event), query
        )
        prospects = search_prospects_by_name(
            invited_prospect_scope_for_event(resolved.event), query
        )
        results = [
            serialize_person_slim(
                person,
                already_checked_in=person.pk in checked,
                is_self=person.pk == request.user.pk,
                request=request,
            )
            for person in people
        ]
        results.extend(serialize_prospect_match(prospect) for prospect in prospects)
        results.sort(
            key=lambda row: (
                (row.get("last_name") or "").lower(),
                (row.get("first_name") or "").lower(),
                row.get("kind") or "",
                row.get("id") or 0,
            )
        )
        return Response({"query": query, "results": results[:15]})

    def post(self, request):
        resolved, error = _resolve_or_error(request)
        if error:
            return error

        person_id = parse_event_id(request.data.get("person_id"))
        prospect_id = parse_event_id(request.data.get("prospect_id"))
        if prospect_id:
            return self._check_in_prospect(request, resolved, prospect_id)
        if person_id:
            return self._check_in_existing(request, resolved, person_id)
        return self._create_and_check_in(request, resolved)

    def _check_in_prospect(self, request, resolved, prospect_id: int):
        qs = invited_prospect_scope_for_event(resolved.event)
        try:
            prospect = qs.get(pk=prospect_id)
        except Prospect.DoesNotExist:
            return Response(
                {"detail": "Invited visitor not found for this service."},
                status=status.HTTP_404_NOT_FOUND,
            )
        event_type = EventType.objects.filter(code=SUNDAY_SERVICE_TYPE).first()
        try:
            prospect = mark_prospect_attended(
                prospect,
                activity_date=resolved.occurrence_date,
                first_activity_attended=event_type,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        prospect.refresh_from_db()
        person = prospect.person
        if person is None:
            return Response(
                {"detail": "Unable to create a visitor record for this invite."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        branch = resolved.event.branch or getattr(request.user, "branch", None)
        if branch and not person.branch_id:
            person.branch = branch
            person.save(update_fields=["branch"])

        inviter, inviter_errors = resolve_optional_inviter(
            request.user, resolved.event, request.data.get("inviter_id")
        )
        if inviter_errors:
            return Response(inviter_errors, status=status.HTTP_400_BAD_REQUEST)
        if inviter is not None and not person.inviter_id:
            person.inviter = inviter
            person.save(update_fields=["inviter"])

        record, created, already = _upsert_onsite_present(
            resolved.event, person, resolved.occurrence_date, request
        )
        return Response(
            {
                "created_person": True,
                "already_checked_in": already or not created,
                "person": serialize_person_slim(
                    person,
                    already_checked_in=True,
                    request=request,
                ),
                "attendance_record": AttendanceRecordSerializer(
                    record, context={"request": request}
                ).data,
            },
            status=status.HTTP_409_CONFLICT if already else status.HTTP_200_OK,
        )

    def _check_in_existing(self, request, resolved, person_id: int):
        qs = visitor_scope_for_event(request.user, resolved.event)
        try:
            person = qs.get(pk=person_id)
        except Person.DoesNotExist:
            return Response(
                {"detail": "Person not found for this service."},
                status=status.HTTP_404_NOT_FOUND,
            )
        inviter, inviter_errors = resolve_optional_inviter(
            request.user, resolved.event, request.data.get("inviter_id")
        )
        if inviter_errors:
            return Response(inviter_errors, status=status.HTTP_400_BAD_REQUEST)
        if inviter is not None and not person.inviter_id:
            person.inviter = inviter
            person.save(update_fields=["inviter"])

        record, created, already = _upsert_onsite_present(
            resolved.event, person, resolved.occurrence_date, request
        )
        return Response(
            {
                "created_person": False,
                "already_checked_in": already or not created,
                "person": serialize_person_slim(
                    person,
                    already_checked_in=True,
                    request=request,
                ),
                "attendance_record": AttendanceRecordSerializer(
                    record, context={"request": request}
                ).data,
            },
            status=status.HTTP_409_CONFLICT if already else status.HTTP_200_OK,
        )

    def _create_and_check_in(self, request, resolved):
        cleaned, errors = validate_guest_encode_fields(request.data or {})
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        inviter, inviter_errors = resolve_optional_inviter(
            request.user, resolved.event, (request.data or {}).get("inviter_id")
        )
        if inviter_errors:
            return Response(inviter_errors, status=status.HTTP_400_BAD_REQUEST)

        branch = resolved.event.branch or getattr(request.user, "branch", None)
        person_matches = list(
            exact_name_matches(
                cleaned["first_name"],
                cleaned["last_name"],
                getattr(branch, "pk", None),
            )[:8]
        )
        prospect_matches = list(
            exact_prospect_name_matches(
                cleaned["first_name"], cleaned["last_name"], resolved.event
            )[:8]
        )
        if person_matches or prospect_matches:
            checked = checked_in_person_ids(resolved.event, resolved.occurrence_date)
            matches = [
                serialize_person_slim(
                    person,
                    already_checked_in=person.pk in checked,
                    request=request,
                )
                for person in person_matches
            ]
            matches.extend(
                serialize_prospect_match(prospect) for prospect in prospect_matches
            )
            return Response(
                {
                    "detail": (
                        "A person with this name already exists. "
                        "Check them in instead of creating a duplicate."
                    ),
                    "matches": matches,
                },
                status=status.HTTP_409_CONFLICT,
            )

        person = create_visitor_guest_person(
            first_name=cleaned["first_name"],
            last_name=cleaned["last_name"],
            gender=cleaned["gender"],
            age_group=cleaned["age_group"],
            phone=cleaned["phone"],
            email=cleaned["email"],
            branch=branch,
            inviter=inviter,
            date_first_attended=resolved.occurrence_date,
            date_first_invited=(
                resolved.occurrence_date
                if parse_first_time_attending(
                    (request.data or {}).get("first_time_attending")
                )
                else None
            ),
        )

        record, _created, _already = _upsert_onsite_present(
            resolved.event, person, resolved.occurrence_date, request
        )
        return Response(
            {
                "created_person": True,
                "already_checked_in": False,
                "person": serialize_person_slim(
                    person,
                    already_checked_in=True,
                    request=request,
                ),
                "attendance_record": AttendanceRecordSerializer(
                    record, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class OnsiteGuestInvitersView(APIView):
    permission_classes = STAFF_PERMISSIONS

    def get(self, request):
        resolved, error = _resolve_or_error(request)
        if error:
            return error

        query = (request.query_params.get("q") or "").strip()
        qs = (
            people_scope_for_event(request.user, resolved.event)
            .exclude(role="VISITOR")
            .exclude(status="DECEASED")
        )
        if len(query) >= 2:
            qs = search_people_by_name(qs, query, limit=15)
        else:
            qs = qs.none()

        results = [
            {
                "id": person.pk,
                "full_name": person_full_name(person),
                "first_name": person.first_name or "",
                "last_name": person.last_name or "",
                "member_id": person.member_id or "",
                "is_self": person.pk == request.user.pk,
            }
            for person in qs
        ]
        return Response({"results": results, "query": query})

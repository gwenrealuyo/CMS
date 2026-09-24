"""Authenticated event self check-in API."""

from __future__ import annotations

from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.attendance.models import AttendanceRecord
from apps.attendance.serializers import AttendanceRecordSerializer
from apps.authentication.permissions import (
    IsAuthenticatedAndNotVisitor,
    IsMemberOrAbove,
    IsAdmin,
)
from apps.events.models import AttendanceVenue, Event, EventSetting
from apps.evangelism.models import Prospect
from apps.evangelism.services import mark_prospect_attended
from apps.events.serializers import AttendanceVenueSerializer, EventSettingSerializer
from apps.events.services.self_checkin import (
    REASON_RESTRICTED,
    checked_in_person_ids,
    create_visitor_guest_person,
    exact_name_matches,
    exact_prospect_name_matches,
    find_people_by_member_id,
    household_person_ids,
    household_queryset,
    invited_prospect_scope_for_event,
    member_self_checkin_enabled,
    parse_event_id,
    parse_first_time_attending,
    parse_person_ids,
    people_scope_for_event,
    person_full_name,
    resolve_person_public_session,
    resolve_public_session,
    resolve_session,
    search_people_by_name,
    search_prospects_by_name,
    serialize_event_option,
    serialize_person_slim,
    serialize_prospect_match,
    serialize_public_person,
    serialize_session_event,
    undoable_person_ids,
    user_can_encode_self_checkin_visitors,
    user_can_use_self_checkin,
    validate_guest_encode_fields,
    visitor_scope_for_event,
)
from apps.people.models import Person


def _active_venues_payload():
    venues = AttendanceVenue.objects.filter(is_active=True).annotate(
        attendance_count=Count("attendance_records")
    ).order_by("sort_order", "code")
    return AttendanceVenueSerializer(venues, many=True).data


def _resolve_online_venue(request, event=None):
    """Resolve venue for hybrid online check-in; online-only skips venue."""
    if event is not None and (
        getattr(event, "attendance_format", None)
        == Event.AttendanceFormat.ONLINE_ONLY
    ):
        raw = None
        if hasattr(request, "data"):
            raw = request.data.get("attendance_venue")
        if raw not in (None, ""):
            return None, {
                "attendance_venue": [
                    "Online-only events do not use an online venue."
                ]
            }
        return None, None

    raw = None
    if hasattr(request, "data"):
        raw = request.data.get("attendance_venue")
    if raw in (None, ""):
        return None, {
            "attendance_venue": [
                "Select an online venue (e.g. Home altar or Cluster house)."
            ]
        }
    code = str(raw).strip().upper()
    try:
        venue = AttendanceVenue.objects.get(code=code, is_active=True)
    except AttendanceVenue.DoesNotExist:
        return None, {
            "attendance_venue": ["Selected online venue is invalid or inactive."]
        }
    return venue, None


def _session_requires_online_venue(resolved) -> bool:
    event = getattr(resolved, "event", None)
    if event is not None:
        return bool(getattr(event, "requires_online_venue", True))
    options = getattr(resolved, "options", None) or []
    if not options:
        return True
    return any(getattr(ev, "requires_online_venue", True) for ev, _occ in options)


def _with_venues(payload: dict, resolved=None) -> dict:
    payload = dict(payload)
    requires = True
    if resolved is not None:
        requires = _session_requires_online_venue(resolved)
    elif "requires_online_venue" in payload:
        requires = bool(payload["requires_online_venue"])
    payload["requires_online_venue"] = requires
    payload["attendance_venues"] = (
        _active_venues_payload() if requires else []
    )
    return payload


class CanEncodeSelfCheckInVisitors(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user_can_encode_self_checkin_visitors(user))


class CanUseSelfCheckIn(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user_can_use_self_checkin(user))


SESSION_PERMISSIONS = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
ENCODE_PERMISSIONS = [
    IsAuthenticatedAndNotVisitor,
    IsMemberOrAbove,
    CanUseSelfCheckIn,
    CanEncodeSelfCheckInVisitors,
]
MUTATE_PERMISSIONS = [
    IsAuthenticatedAndNotVisitor,
    IsMemberOrAbove,
    CanUseSelfCheckIn,
]


def _event_id_from_request(request) -> int | None:
    raw = request.query_params.get("event")
    if raw in (None, ""):
        raw = request.data.get("event_id") if hasattr(request, "data") else None
    return parse_event_id(raw)


def _unavailable_payload(resolved) -> dict:
    return _with_venues(
        {
            "available": False,
            "reason": resolved.reason or "no_service_today",
            "occurrence_date": (
                resolved.occurrence_date.isoformat()
                if resolved.occurrence_date
                else None
            ),
            "needs_selection": False,
            "can_encode_visitors": resolved.can_encode_visitors,
            "session": None,
            "options": [],
        },
        resolved=resolved,
    )


def _restricted_payload() -> dict:
    return _with_venues(
        {
            "available": False,
            "reason": REASON_RESTRICTED,
            "occurrence_date": None,
            "needs_selection": False,
            "can_encode_visitors": False,
            "session": None,
            "options": [],
            "detail": "Online self-check-in is not open to members yet.",
        }
    )


def _options_payload(resolved) -> dict:
    return _with_venues(
        {
            "available": True,
            "reason": None,
            "occurrence_date": (
                resolved.occurrence_date.isoformat()
                if resolved.occurrence_date
                else None
            ),
            "needs_selection": True,
            "can_encode_visitors": resolved.can_encode_visitors,
            "session": None,
            "options": [
                serialize_event_option(event, occ) for event, occ in resolved.options
            ],
        },
        resolved=resolved,
    )


def _session_payload(resolved, user, request) -> dict:
    event = resolved.event
    occ = resolved.occurrence
    occurrence_date = resolved.occurrence_date
    checked = checked_in_person_ids(event, occurrence_date)
    household = [
        serialize_person_slim(
            person,
            already_checked_in=person.pk in checked,
            is_self=person.pk == user.pk,
            request=request,
        )
        for person in household_queryset(user)
    ]
    return _with_venues(
        {
            "available": True,
            "reason": None,
            "occurrence_date": occurrence_date.isoformat(),
            "needs_selection": False,
            "can_encode_visitors": resolved.can_encode_visitors,
            "session": {
                "event": serialize_session_event(event, occ),
                "occurrence_date": occurrence_date.isoformat(),
                "start": occ.start.isoformat(),
                "end": occ.end.isoformat(),
                "already_checked_in_ids": sorted(checked),
                "household": household,
            },
            "options": [serialize_event_option(event, occ)],
        },
        resolved=resolved,
    )


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
    return Response(_session_payload(resolved, request.user, request))


def _upsert_present(event, person, occurrence_date, request, venue: AttendanceVenue | None):
    serializer = AttendanceRecordSerializer(
        data={
            "event_id": event.pk,
            "person_id": person.pk,
            "occurrence_date": occurrence_date.isoformat(),
            "status": "PRESENT",
            "attendance_mode": AttendanceRecord.AttendanceMode.ONLINE,
            "attendance_venue": venue.code if venue is not None else None,
        },
        context={"request": request},
    )
    serializer.is_valid(raise_exception=True)
    record = serializer.save()
    return record, serializer.was_created, serializer.already_checked_in


class SelfCheckInSessionView(APIView):
    permission_classes = SESSION_PERMISSIONS

    def get(self, request):
        if not user_can_use_self_checkin(request.user):
            return Response(_restricted_payload())
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        return build_session_response(request, resolved)


class SelfCheckInView(APIView):
    permission_classes = MUTATE_PERMISSIONS

    def post(self, request):
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        if not resolved.available or resolved.needs_selection or not resolved.event:
            if resolved.needs_selection:
                return Response(
                    {
                        "detail": "Select an event to check in online.",
                        **_options_payload(resolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload = _unavailable_payload(resolved)
            payload["detail"] = "Online self-check-in is not available right now."
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        person_ids = parse_person_ids(request.data.get("person_ids") or [])
        if not person_ids:
            return Response(
                {"person_ids": ["Select at least one person."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        venue, venue_errors = _resolve_online_venue(request, resolved.event)
        if venue_errors:
            return Response(venue_errors, status=status.HTTP_400_BAD_REQUEST)

        allowed = household_person_ids(request.user)
        rejected = [pk for pk in person_ids if pk not in allowed]
        if rejected:
            return Response(
                {
                    "detail": "You can only check in yourself and household members.",
                    "rejected_ids": rejected,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        people = {p.pk: p for p in Person.objects.filter(pk__in=person_ids)}
        records = []
        already = []
        for pk in person_ids:
            person = people.get(pk)
            if person is None:
                continue
            record, _created, was_already = _upsert_present(
                resolved.event, person, resolved.occurrence_date, request, venue
            )
            records.append(
                AttendanceRecordSerializer(record, context={"request": request}).data
            )
            if was_already:
                already.append(pk)

        refreshed = resolve_session(request.user, event_id=resolved.event.pk)
        body = _session_payload(refreshed, request.user, request)
        body["attendance_records"] = records
        if already and len(already) == len(records):
            body["detail"] = (
                "Already checked in. Mode and venue cannot be changed."
            )
            return Response(body, status=status.HTTP_409_CONFLICT)
        return Response(body, status=status.HTTP_200_OK)


class SelfCheckInUndoView(APIView):
    permission_classes = MUTATE_PERMISSIONS

    def post(self, request):
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        if not resolved.available or resolved.needs_selection or not resolved.event:
            if resolved.needs_selection:
                return Response(
                    {
                        "detail": "Select an event first.",
                        **_options_payload(resolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            payload = _unavailable_payload(resolved)
            payload["detail"] = "Online self-check-in is not available right now."
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        person_ids = parse_person_ids(request.data.get("person_ids") or [])
        if not person_ids:
            return Response(
                {"person_ids": ["Select at least one person."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed = undoable_person_ids(request.user, resolved.event)
        rejected = [pk for pk in person_ids if pk not in allowed]
        if rejected:
            return Response(
                {
                    "detail": "You can only undo check-in for yourself, household members, or guests you invited.",
                    "rejected_ids": rejected,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        records = AttendanceRecord.objects.filter(
            event=resolved.event,
            occurrence_date=resolved.occurrence_date,
            person_id__in=person_ids,
        )
        removed_ids = list(records.values_list("person_id", flat=True))
        if not removed_ids:
            return Response(
                {"detail": "No check-in found to undo."},
                status=status.HTTP_404_NOT_FOUND,
            )
        records.delete()

        refreshed = resolve_session(request.user, event_id=resolved.event.pk)
        body = _session_payload(refreshed, request.user, request)
        body["removed_person_ids"] = removed_ids
        return Response(body, status=status.HTTP_200_OK)


class SelfCheckInVisitorsView(APIView):
    permission_classes = ENCODE_PERMISSIONS

    def get(self, request):
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        if not resolved.available or resolved.needs_selection or not resolved.event:
            if resolved.needs_selection:
                return Response(
                    {
                        "detail": "Select an event first.",
                        **_options_payload(resolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {
                    "detail": "Online self-check-in is not available right now.",
                    **_unavailable_payload(resolved),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        return Response(
            {
                "query": query,
                "results": results[:15],
            }
        )

    def post(self, request):
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        if not resolved.available or resolved.needs_selection or not resolved.event:
            if resolved.needs_selection:
                return Response(
                    {
                        "detail": "Select an event first.",
                        **_options_payload(resolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {
                    "detail": "Online self-check-in is not available right now.",
                    **_unavailable_payload(resolved),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        person_id = parse_event_id(request.data.get("person_id"))
        prospect_id = parse_event_id(request.data.get("prospect_id"))
        venue, venue_errors = _resolve_online_venue(request, resolved.event)
        if venue_errors:
            return Response(venue_errors, status=status.HTTP_400_BAD_REQUEST)
        if prospect_id:
            return self._check_in_prospect(request, resolved, prospect_id, venue)
        if person_id:
            return self._check_in_existing(request, resolved, person_id, venue)
        return self._create_and_check_in(request, resolved, venue)

    def _check_in_prospect(self, request, resolved, prospect_id: int, venue: AttendanceVenue):
        qs = invited_prospect_scope_for_event(resolved.event)
        try:
            prospect = qs.get(pk=prospect_id)
        except Prospect.DoesNotExist:
            return Response(
                {"detail": "Invited visitor not found for this service."},
                status=status.HTTP_404_NOT_FOUND,
            )
        event_type = resolved.event.event_type
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

        record, created, already = _upsert_present(
            resolved.event, person, resolved.occurrence_date, request, venue
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

    def _check_in_existing(self, request, resolved, person_id: int, venue: AttendanceVenue):
        qs = visitor_scope_for_event(request.user, resolved.event)
        try:
            person = qs.get(pk=person_id)
        except Person.DoesNotExist:
            return Response(
                {"detail": "Person not found for this service."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not person.inviter_id:
            person.inviter = request.user
            person.save(update_fields=["inviter"])
        record, created, already = _upsert_present(
            resolved.event, person, resolved.occurrence_date, request, venue
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

    def _create_and_check_in(self, request, resolved, venue: AttendanceVenue):
        cleaned, errors = validate_guest_encode_fields(request.data or {})
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

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
                    "detail": "A person with this name already exists. Check them in instead of creating a duplicate.",
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
            inviter=request.user,
            date_first_attended=resolved.occurrence_date,
            date_first_invited=(
                resolved.occurrence_date
                if parse_first_time_attending(
                    (request.data or {}).get("first_time_attending")
                )
                else None
            ),
            first_activity_attended=resolved.event.event_type,
        )

        record, _created, _already = _upsert_present(
            resolved.event, person, resolved.occurrence_date, request, venue
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

class SelfCheckInInvitersView(APIView):
    permission_classes = ENCODE_PERMISSIONS

    def get(self, request):
        resolved = resolve_session(request.user, event_id=_event_id_from_request(request))
        if not resolved.available or resolved.needs_selection or not resolved.event:
            if resolved.needs_selection:
                return Response(
                    {
                        "detail": "Select an event first.",
                        **_options_payload(resolved),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {
                    "detail": "Online self-check-in is not available right now.",
                    **_unavailable_payload(resolved),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        query = (request.query_params.get("q") or "").strip()
        qs = (
            people_scope_for_event(request.user, resolved.event)
            .exclude(role="VISITOR")
            .exclude(status="DECEASED")
        )
        if len(query) >= 2:
            qs = search_people_by_name(qs, query, limit=15)
        else:
            qs = qs.filter(pk=request.user.pk)

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
        if not any(row["is_self"] for row in results):
            results.insert(
                0,
                {
                    "id": request.user.pk,
                    "full_name": person_full_name(request.user),
                    "first_name": request.user.first_name or "",
                    "last_name": request.user.last_name or "",
                    "member_id": getattr(request.user, "member_id", "") or "",
                    "is_self": True,
                },
            )
        return Response({"results": results, "query": query})


class EventSettingView(APIView):
    """Singleton Events flags (ADMIN only). GET/PATCH /api/events/settings/"""

    permission_classes = [IsAuthenticatedAndNotVisitor, IsAdmin]

    def get(self, request):
        setting = EventSetting.get_solo()
        return Response(EventSettingSerializer(setting).data)

    def patch(self, request):
        setting = EventSetting.get_solo()
        serializer = EventSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


class PublicSelfCheckInThrottle(AnonRateThrottle):
    rate = "30/min"


PUBLIC_MEMBER_NOT_FOUND = "No member found for this LAMP ID."
PUBLIC_MEMBER_AMBIGUOUS = (
    "This LAMP ID matches more than one person. Please ask an Events coordinator for help."
)


def _public_payload(resolved, extra=None) -> dict:
    payload = {
        "available": resolved.available,
        "reason": resolved.reason,
        "occurrence_date": (
            resolved.occurrence_date.isoformat() if resolved.occurrence_date else None
        ),
        "needs_selection": resolved.needs_selection,
        "can_encode_visitors": False,
        "session": None,
        "options": [
            serialize_event_option(event, occ) for event, occ in resolved.options
        ],
    }
    if (
        resolved.available
        and resolved.event
        and resolved.occurrence
        and resolved.occurrence_date
        and not resolved.needs_selection
    ):
        payload["session"] = {
            "event": serialize_session_event(resolved.event, resolved.occurrence),
            "occurrence_date": resolved.occurrence_date.isoformat(),
            "start": resolved.occurrence.start.isoformat(),
            "end": resolved.occurrence.end.isoformat(),
        }
    if extra:
        payload.update(extra)
    return _with_venues(payload, resolved=resolved)


def _public_restricted_payload() -> dict:
    return _with_venues(
        {
            "available": False,
            "reason": REASON_RESTRICTED,
            "occurrence_date": None,
            "needs_selection": False,
            "can_encode_visitors": False,
            "session": None,
            "options": [],
            "detail": "Online self-check-in is not open to members yet.",
        }
    )


def _lookup_public_person(request):
    raw = ""
    if hasattr(request, "data"):
        raw = request.data.get("member_id") or ""
    raw = str(raw).strip()
    if not raw:
        return None, Response(
            {"member_id": ["Enter your LAMP ID."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    people = list(find_people_by_member_id(raw)[:8])
    if not people:
        return None, Response(
            {"detail": PUBLIC_MEMBER_NOT_FOUND},
            status=status.HTTP_404_NOT_FOUND,
        )
    if len(people) > 1:
        return None, Response(
            {"detail": PUBLIC_MEMBER_AMBIGUOUS},
            status=status.HTTP_409_CONFLICT,
        )
    return people[0], None


def _identify_public_person(request):
    if not member_self_checkin_enabled():
        return None, None, Response(
            _public_restricted_payload(),
            status=status.HTTP_400_BAD_REQUEST,
        )
    person, error = _lookup_public_person(request)
    if error is not None:
        return None, None, error
    resolved = resolve_person_public_session(
        person, event_id=_event_id_from_request(request)
    )
    if not resolved.available:
        payload = _public_payload(resolved)
        payload["detail"] = "Online self-check-in is not available right now."
        payload["person"] = None
        return None, None, Response(payload, status=status.HTTP_400_BAD_REQUEST)
    return person, resolved, None


class PublicSelfCheckInSessionView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not member_self_checkin_enabled():
            return Response(_public_restricted_payload())
        resolved = resolve_public_session(event_id=_event_id_from_request(request))
        if not resolved.available:
            status_code = (
                status.HTTP_400_BAD_REQUEST
                if resolved.reason == "invalid_event"
                else status.HTTP_200_OK
            )
            return Response(_public_payload(resolved), status=status_code)
        return Response(_public_payload(resolved))


class PublicSelfCheckInIdentifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PublicSelfCheckInThrottle]

    def post(self, request):
        person, resolved, error = _identify_public_person(request)
        if error is not None:
            return error
        already = False
        if resolved.event and resolved.occurrence_date:
            already = person.pk in checked_in_person_ids(
                resolved.event, resolved.occurrence_date
            )
        return Response(
            _public_payload(
                resolved,
                {
                    "person": serialize_public_person(
                        person,
                        already_checked_in=already,
                        request=request,
                    ),
                    "already_checked_in": already,
                },
            )
        )


class PublicSelfCheckInView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PublicSelfCheckInThrottle]

    def post(self, request):
        person, resolved, error = _identify_public_person(request)
        if error is not None:
            return error
        if resolved.needs_selection or not resolved.event:
            payload = _public_payload(
                resolved,
                {
                    "detail": "Select an event to check in online.",
                    "person": serialize_public_person(
                        person,
                        already_checked_in=False,
                        request=request,
                    ),
                },
            )
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        venue, venue_errors = _resolve_online_venue(request, resolved.event)
        if venue_errors:
            return Response(venue_errors, status=status.HTTP_400_BAD_REQUEST)

        record, _created, already = _upsert_present(
            resolved.event, person, resolved.occurrence_date, request, venue
        )
        payload = _public_payload(
            resolved,
            {
                "person": serialize_public_person(
                    person,
                    already_checked_in=True,
                    request=request,
                ),
                "already_checked_in": already,
                "attendance_record": AttendanceRecordSerializer(
                    record, context={"request": request}
                ).data,
            },
        )
        if already:
            payload["detail"] = (
                "Already checked in. Mode and venue cannot be changed."
            )
            return Response(payload, status=status.HTTP_409_CONFLICT)
        return Response(payload, status=status.HTTP_200_OK)

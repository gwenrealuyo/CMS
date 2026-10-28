"""Sunday Bible study reports: branch-owned Bible Sharers submissions."""

from __future__ import annotations

from django.db import transaction
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsAdmin,
    IsAuthenticatedAndNotVisitor,
    IsMemberOrAbove,
)
from apps.ministries.bible_sharers import (
    get_bible_sharers_ministry,
    person_on_bible_sharers_roster,
    user_is_bible_sharers_roster_manager,
)
from apps.ministries.models import MinistryMember
from apps.people.models import Branch, Journey, Person

from .models import (
    Prospect,
    SundayBibleStudyFacilitator,
    SundayBibleStudyReport,
    SundayBibleStudyVisitor,
)
from .permissions import (
    allows_evangelism_report_mutation_attempt,
    is_evangelism_senior_or_privileged,
)
from .services import prospects_for_branch_report

SUNDAY_BS_JOURNEY_TITLE = "Sunday Bible Study"
_LESSON_FIELDS = ("topic", "scripture_reference", "study_summary")


def user_can_browse_sunday_bible_studies(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) == "VISITOR":
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if user.is_senior_coordinator("EVANGELISM"):
        return True
    if user_is_bible_sharers_roster_manager(user):
        return True
    return person_on_bible_sharers_roster(user)


def user_can_create_sunday_bible_study(user) -> bool:
    if not user_can_browse_sunday_bible_studies(user):
        return False
    if user_is_bible_sharers_roster_manager(user):
        return True
    if allows_evangelism_report_mutation_attempt(user):
        return True
    return person_on_bible_sharers_roster(user)


def user_can_update_sunday_bible_study(user, report) -> bool:
    if user_can_create_sunday_bible_study(user):
        return True
    return report.facilitators.filter(person=user).exists()


def user_can_view_sunday_bible_study_sensitive(user, report) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    if is_evangelism_senior_or_privileged(user) and user.is_senior_coordinator(
        "EVANGELISM"
    ):
        return True
    if user_is_bible_sharers_roster_manager(user):
        return True
    return report.facilitators.filter(person_id=user.id).exists()


def filter_sunday_bible_studies_for_user(user, queryset):
    if not user_can_browse_sunday_bible_studies(user):
        return queryset.none()
    if user.can_see_all_branches():
        return queryset
    if getattr(user, "branch_id", None):
        return queryset.filter(branch_id=user.branch_id)
    return queryset.filter(facilitators__person=user).distinct()


def active_bible_sharer_ids() -> set[int]:
    ministry = get_bible_sharers_ministry()
    if ministry is None:
        return set()
    return set(
        ministry.memberships.filter(is_active=True).values_list("member_id", flat=True)
    )


def facilitator_double_booking_warnings(report, person_ids, session_date, session_type):
    if report is not None and report.cancelled:
        return []
    if not person_ids or session_date is None or not session_type:
        return []
    conflicts = SundayBibleStudyFacilitator.objects.filter(
        person_id__in=person_ids,
        report__session_date=session_date,
        report__session_type=session_type,
        report__cancelled=False,
    ).select_related("person")
    if report is not None and report.pk:
        conflicts = conflicts.exclude(report_id=report.pk)
    label = dict(SundayBibleStudyReport.SessionType.choices).get(
        session_type, session_type
    )
    warnings = []
    seen = set()
    for row in conflicts:
        if row.person_id in seen:
            continue
        seen.add(row.person_id)
        name = row.person.get_full_name() or row.person.username
        warnings.append(
            f"{name} is already assigned to another {label} report on "
            f"{session_date.isoformat()}."
        )
    return warnings


class CanBrowseSundayBibleStudies(permissions.BasePermission):
    def has_permission(self, request, view):
        return user_can_browse_sunday_bible_studies(request.user)


class HasSundayBibleStudyWrite(permissions.BasePermission):
    def has_permission(self, request, view):
        return user_can_create_sunday_bible_study(request.user)


class _PersonIdSerializer(serializers.Serializer):
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.all(),
    )
    is_lead = serializers.BooleanField(required=False, default=False)


class _VisitorWriteSerializer(serializers.Serializer):
    person_id = serializers.PrimaryKeyRelatedField(
        source="person",
        queryset=Person.objects.filter(role="VISITOR"),
    )
    attendance_kind = serializers.ChoiceField(
        choices=SundayBibleStudyVisitor.AttendanceKind.choices
    )
    progress = serializers.ChoiceField(
        choices=SundayBibleStudyVisitor.Progress.choices,
        required=False,
        allow_blank=True,
        default="",
    )
    note = serializers.CharField(required=False, allow_blank=True)
    inviter_id = serializers.PrimaryKeyRelatedField(
        source="inviter",
        queryset=Person.objects.exclude(role="ADMIN"),
        required=False,
        allow_null=True,
    )
    date_first_attended = serializers.DateField(
        required=False, allow_null=True
    )
    first_activity_attended = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )


class _NewVisitorWriteSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    suffix = serializers.CharField(max_length=150, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=[("MALE", "Male"), ("FEMALE", "Female"), ("", "")],
        required=False,
        allow_blank=True,
    )
    facebook_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    inviter_id = serializers.PrimaryKeyRelatedField(
        source="inviter",
        queryset=Person.objects.exclude(role="ADMIN"),
        required=False,
        allow_null=True,
    )
    note = serializers.CharField(required=False, allow_blank=True)
    progress = serializers.ChoiceField(
        choices=SundayBibleStudyVisitor.Progress.choices,
        required=False,
        allow_blank=True,
        default="",
    )
    attendance_kind = serializers.ChoiceField(
        choices=SundayBibleStudyVisitor.AttendanceKind.choices,
        required=False,
        default=SundayBibleStudyVisitor.AttendanceKind.FIRST_TIME,
    )
    date_first_attended = serializers.DateField(
        required=False, allow_null=True
    )
    first_activity_attended = serializers.CharField(
        required=False, allow_blank=True, allow_null=True
    )
    prospect_id = serializers.PrimaryKeyRelatedField(
        source="prospect",
        queryset=Prospect.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        prospect = attrs.get("prospect")
        if prospect is not None:
            return attrs
        if not str(attrs.get("first_name") or "").strip():
            raise serializers.ValidationError(
                {"first_name": "This field is required."}
            )
        if not str(attrs.get("last_name") or "").strip():
            raise serializers.ValidationError(
                {"last_name": "This field is required."}
            )
        return attrs


class SundayBibleStudyReportSerializer(serializers.ModelSerializer):
    branch_id = serializers.PrimaryKeyRelatedField(
        source="branch",
        queryset=Branch.objects.all(),
        required=False,
        write_only=True,
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    facilitators = _PersonIdSerializer(many=True, write_only=True, required=False)
    facilitator_details = serializers.SerializerMethodField()
    visitors = _VisitorWriteSerializer(many=True, write_only=True, required=False)
    new_visitors = _NewVisitorWriteSerializer(many=True, write_only=True, required=False)
    visitor_details = serializers.SerializerMethodField()
    members_attended = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Person.objects.exclude(role__in=["VISITOR", "ADMIN"]),
        required=False,
    )
    members_attended_details = serializers.SerializerMethodField()
    facilitator_warnings = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    first_time_count = serializers.SerializerMethodField()
    returning_count = serializers.SerializerMethodField()
    total_attendance = serializers.SerializerMethodField()

    class Meta:
        model = SundayBibleStudyReport
        fields = (
            "id",
            "branch",
            "branch_id",
            "branch_name",
            "session_date",
            "year",
            "week_number",
            "session_type",
            "gathering_type",
            "cancelled",
            "cancellation_reason",
            "topic",
            "scripture_reference",
            "study_summary",
            "observation",
            "testimonies",
            "prayer_requests",
            "notes",
            "facilitators",
            "facilitator_details",
            "visitors",
            "new_visitors",
            "visitor_details",
            "members_attended",
            "members_attended_details",
            "facilitator_warnings",
            "member_count",
            "first_time_count",
            "returning_count",
            "total_attendance",
            "submitted_by",
            "submitted_at",
            "updated_at",
        )
        read_only_fields = (
            "branch",
            "year",
            "week_number",
            "submitted_by",
            "submitted_at",
            "updated_at",
        )

    def _value(self, attrs, field):
        if field in attrs:
            return attrs[field]
        if self.instance is not None:
            return getattr(self.instance, field)
        return None

    def validate_facilitators(self, rows):
        person_ids = [row["person"].id for row in rows]
        if len(person_ids) != len(set(person_ids)):
            raise serializers.ValidationError(
                "A Bible Sharer can only be assigned once on this report."
            )
        leads = [row for row in rows if row.get("is_lead")]
        if len(leads) > 1:
            raise serializers.ValidationError(
                "Only one lead facilitator can be assigned."
            )
        allowed = active_bible_sharer_ids()
        existing = set()
        if self.instance is not None:
            existing = set(
                self.instance.facilitators.values_list("person_id", flat=True)
            )
        invalid = [
            row["person"]
            for row in rows
            if row["person"].id not in allowed and row["person"].id not in existing
        ]
        if invalid:
            names = ", ".join(
                person.get_full_name() or person.username for person in invalid
            )
            raise serializers.ValidationError(
                f"Only active Bible Sharers can be newly assigned: {names}."
            )
        return rows

    def _branch_for_write_validation(self):
        if self.instance is not None:
            return self.instance.branch
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if getattr(user, "role", None) == "ADMIN":
            raw = self.initial_data.get("branch_id")
            if raw not in (None, ""):
                return Branch.objects.filter(pk=raw).first()
        return getattr(user, "branch", None)

    def validate_members_attended(self, members):
        branch = self._branch_for_write_validation()
        invalid = []
        for person in members:
            if person.role in ("VISITOR", "ADMIN"):
                invalid.append(person)
                continue
            if branch is not None and person.branch_id != branch.id:
                if self.instance is None or not self.instance.members_attended.filter(
                    pk=person.pk
                ).exists():
                    invalid.append(person)
        if invalid:
            names = ", ".join(
                person.get_full_name() or person.username for person in invalid
            )
            raise serializers.ValidationError(
                "People attended must belong to this branch and cannot be "
                f"visitors or admins: {names}."
            )
        return members

    def _visitor_overlap_errors(self, attrs):
        if bool(self._value(attrs, "cancelled")):
            return
        member_ids = set()
        if "members_attended" in attrs:
            member_ids = {person.id for person in attrs["members_attended"]}
        elif self.instance is not None and "members_attended" not in self.initial_data:
            member_ids = set(
                self.instance.members_attended.values_list("id", flat=True)
            )
        visitor_ids = []
        if "visitors" in attrs:
            visitor_ids = [row["person"].id for row in attrs["visitors"]]
        elif self.instance is not None and "visitors" not in self.initial_data:
            visitor_ids = list(
                self.instance.visitors.values_list("person_id", flat=True)
            )
        if len(visitor_ids) != len(set(visitor_ids)):
            raise serializers.ValidationError(
                {"visitors": "A visitor can only be listed once on this report."}
            )
        overlap = member_ids.intersection(visitor_ids)
        if overlap:
            raise serializers.ValidationError(
                {
                    "visitors": (
                        "A person cannot be both a member and a visitor on this report."
                    )
                }
            )
        branch = self._value(attrs, "branch") or self._branch_for_write_validation()
        if branch is not None and "visitors" in attrs:
            bad = [
                row["person"]
                for row in attrs["visitors"]
                if row["person"].branch_id
                and row["person"].branch_id != branch.id
                and (
                    self.instance is None
                    or not self.instance.visitors.filter(
                        person_id=row["person"].id
                    ).exists()
                )
            ]
            if bad:
                names = ", ".join(
                    person.get_full_name() or person.username for person in bad
                )
                raise serializers.ValidationError(
                    {
                        "visitors": (
                            f"Visitors must belong to this branch: {names}."
                        )
                    }
                )

    def validate(self, attrs):
        attrs = self._validate_schedule(attrs)
        self._visitor_overlap_errors(attrs)
        cancelled = bool(self._value(attrs, "cancelled") or False)
        if cancelled:
            return attrs
        facilitators_in_payload = "facilitators" in self.initial_data
        if self.instance is None or facilitators_in_payload:
            rows = attrs.get("facilitators", [])
            if not rows:
                raise serializers.ValidationError(
                    {"facilitators": "Assign at least one Bible Sharer."}
                )
        return attrs

    def _validate_schedule(self, attrs):
        cancelled = bool(self._value(attrs, "cancelled") or False)
        session_date = self._value(attrs, "session_date")
        if session_date is None:
            raise serializers.ValidationError(
                {"session_date": "This field is required."}
            )
        if session_date.weekday() != 6:
            raise serializers.ValidationError(
                {"session_date": "Session date must be a Sunday."}
            )
        iso = session_date.isocalendar()
        attrs["year"] = iso[0]
        attrs["week_number"] = iso[1]

        if self.instance is None:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            requested_branch = attrs.get("branch")
            if getattr(user, "role", None) == "ADMIN":
                branch = requested_branch or getattr(user, "branch", None)
                if branch is None:
                    raise serializers.ValidationError(
                        {"branch_id": "Select a branch for this report."}
                    )
            else:
                branch = getattr(user, "branch", None)
                if branch is None:
                    raise serializers.ValidationError(
                        {
                            "branch": (
                                "Your account must belong to a branch to submit "
                                "a Sunday Bible study report."
                            )
                        }
                    )
            attrs["branch"] = branch

        if cancelled:
            reason = self._value(attrs, "cancellation_reason") or ""
            if not str(reason).strip():
                raise serializers.ValidationError(
                    {"cancellation_reason": "Explain why this session was cancelled."}
                )
            attrs["gathering_type"] = None
            attrs["topic"] = ""
            attrs["scripture_reference"] = ""
            attrs["study_summary"] = ""
            attrs["observation"] = ""
            attrs["testimonies"] = ""
            attrs["prayer_requests"] = ""
            attrs["notes"] = ""
            attrs["cancellation_reason"] = str(reason).strip()
            return attrs

        if not self._value(attrs, "session_type"):
            raise serializers.ValidationError(
                {"session_type": "This field is required."}
            )
        if not self._value(attrs, "gathering_type"):
            raise serializers.ValidationError(
                {"gathering_type": "This field is required."}
            )
        labels = {
            "topic": "Topic",
            "scripture_reference": "Scripture reference",
            "study_summary": "Flow",
        }
        errors = {}
        for field in _LESSON_FIELDS:
            if not str(self._value(attrs, field) or "").strip():
                errors[field] = f"{labels[field]} is required."
        if errors:
            raise serializers.ValidationError(errors)
        attrs["cancellation_reason"] = ""
        return attrs

    def _person_payload(self, person):
        return {
            "id": person.id,
            "name": person.get_full_name() or person.username,
            "role": person.role,
        }

    def get_facilitator_details(self, obj):
        rows = obj.facilitators.all()
        details = []
        for row in rows:
            groups = list(row.groups_at_assignment.all())
            details.append(
                {
                    "id": row.id,
                    "person_id": row.person_id,
                    "name": row.person.get_full_name() or row.person.username,
                    "is_lead": row.is_lead,
                    "evangelism_group_names": sorted(group.name for group in groups),
                }
            )
        return details

    def get_visitor_details(self, obj):
        details = []
        for row in obj.visitors.all():
            inviter = row.person.inviter
            details.append(
                {
                    "id": row.id,
                    "person_id": row.person_id,
                    "name": row.person.get_full_name() or row.person.username,
                    "attendance_kind": row.attendance_kind,
                    "progress": row.progress or "",
                    "note": row.note,
                    "inviter_id": row.person.inviter_id,
                    "inviter_name": (
                        (inviter.get_full_name() or inviter.username) if inviter else ""
                    ),
                    "date_attended": obj.session_date.isoformat(),
                }
            )
        return details

    def get_members_attended_details(self, obj):
        return [self._person_payload(person) for person in obj.members_attended.all()]

    def get_member_count(self, obj):
        return len(obj.members_attended.all())

    def get_first_time_count(self, obj):
        return sum(
            1
            for row in obj.visitors.all()
            if row.attendance_kind == SundayBibleStudyVisitor.AttendanceKind.FIRST_TIME
        )

    def get_returning_count(self, obj):
        return sum(
            1
            for row in obj.visitors.all()
            if row.attendance_kind == SundayBibleStudyVisitor.AttendanceKind.RETURNING
        )

    def get_total_attendance(self, obj):
        return self.get_member_count(obj) + len(obj.visitors.all())

    def get_facilitator_warnings(self, obj):
        if not self.context.get("include_facilitator_warnings"):
            return []
        person_ids = [row.person_id for row in obj.facilitators.all()]
        return facilitator_double_booking_warnings(
            obj, person_ids, obj.session_date, obj.session_type
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user_can_view_sunday_bible_study_sensitive(user, instance):
            data.pop("prayer_requests", None)
            data.pop("notes", None)
        data.pop("facilitators", None)
        data.pop("visitors", None)
        data.pop("new_visitors", None)
        return data

    def _sync_journey(self, row, report):
        note = (row.note or "").strip()
        if not note:
            if row.journey_id:
                journey_id = row.journey_id
                row.journey = None
                row.save(update_fields=["journey"])
                Journey.objects.filter(pk=journey_id).delete()
            return
        if row.journey_id:
            journey = row.journey
            journey.type = "NOTE"
            journey.title = SUNDAY_BS_JOURNEY_TITLE
            journey.description = note
            journey.date = report.session_date
            journey.save(
                update_fields=["type", "title", "description", "date", "updated_at"]
            )
            return
        journey = Journey.objects.create(
            user=row.person,
            type="NOTE",
            title=SUNDAY_BS_JOURNEY_TITLE,
            description=note,
            date=report.session_date,
            verified_by=None,
        )
        row.journey = journey
        row.save(update_fields=["journey"])

    def _create_visitor_person(self, branch, session_date, payload):
        from apps.people.serializers import PersonSerializer

        first_attended = payload.get("date_first_attended") or session_date
        person_data = {
            "first_name": payload["first_name"],
            "last_name": payload["last_name"],
            "middle_name": payload.get("middle_name") or "",
            "suffix": payload.get("suffix") or "",
            "facebook_name": payload.get("facebook_name") or "",
            "role": "VISITOR",
            "status": "ONGOING",
            "date_first_attended": first_attended,
            "generate_temporary_password": False,
        }
        gender = payload.get("gender") or ""
        if gender:
            person_data["gender"] = gender
        if branch is not None:
            person_data["branch"] = branch.id
        inviter = payload.get("inviter")
        if inviter is not None:
            person_data["inviter"] = inviter.pk
        activity = (payload.get("first_activity_attended") or "").strip()
        attendance_kind = payload.get("attendance_kind") or ""
        if not activity and attendance_kind != (
            SundayBibleStudyVisitor.AttendanceKind.RETURNING
        ):
            activity = "SUNDAY_SERVICE"
        if activity:
            person_data["first_activity_attended"] = activity
        serializer = PersonSerializer(data=person_data, context=self.context)
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def _person_from_prospect(self, report, payload):
        prospect = payload["prospect"]
        allowed = prospects_for_branch_report(report.branch_id)
        if not allowed.filter(pk=prospect.pk).exists():
            raise serializers.ValidationError(
                {
                    "new_visitors": (
                        f"Prospect {prospect.pk} is not available for this branch."
                    )
                }
            )
        if prospect.person_id:
            return prospect.person
        create_payload = {
            "first_name": payload.get("first_name") or prospect.first_name,
            "last_name": payload.get("last_name") or prospect.last_name,
            "middle_name": payload.get("middle_name") or prospect.middle_name or "",
            "suffix": payload.get("suffix") or prospect.suffix or "",
            "facebook_name": payload.get("facebook_name")
            or prospect.facebook_name
            or "",
            "gender": payload.get("gender") or prospect.gender or "",
            "inviter": payload.get("inviter") or prospect.invited_by,
            "attendance_kind": payload.get("attendance_kind"),
            "date_first_attended": payload.get("date_first_attended"),
            "first_activity_attended": payload.get("first_activity_attended") or "",
        }
        person = self._create_visitor_person(
            report.branch, report.session_date, create_payload
        )
        prospect.person = person
        prospect.save(update_fields=["person"])
        return person

    def _apply_inviter(self, person, payload, inviter_was_sent):
        if not inviter_was_sent:
            return
        person.inviter = payload.get("inviter")
        person.save(update_fields=["inviter"])

    def _apply_first_attendance(self, person, payload):
        """Fill missing first-attendance fields on a returning visitor."""
        updates = []
        first_attended = payload.get("date_first_attended")
        if first_attended and not person.date_first_attended:
            person.date_first_attended = first_attended
            updates.append("date_first_attended")
        activity = (payload.get("first_activity_attended") or "").strip()
        if activity and not person.first_activity_attended_id:
            person.first_activity_attended_id = activity
            updates.append("first_activity_attended")
        if updates:
            person.save(update_fields=updates)

    def _clear_attendance(self, report):
        report.members_attended.clear()
        report.facilitators.all().delete()
        for row in list(report.visitors.all()):
            journey_id = row.journey_id
            row.delete()
            if journey_id:
                Journey.objects.filter(pk=journey_id).delete()

    def _sync_facilitators(self, report, rows):
        existing = {row.person_id: row for row in report.facilitators.all()}
        keep = set()
        for payload in rows:
            person = payload["person"]
            keep.add(person.id)
            row = existing.get(person.id)
            if row is None:
                row = SundayBibleStudyFacilitator.objects.create(
                    report=report,
                    person=person,
                    is_lead=bool(payload.get("is_lead")),
                )
                row.groups_at_assignment.set(person.evangelism_groups.all())
            elif row.is_lead != bool(payload.get("is_lead")):
                row.is_lead = bool(payload.get("is_lead"))
                row.save(update_fields=["is_lead"])
        for person_id, row in existing.items():
            if person_id not in keep:
                row.delete()

    def _sync_visitors(self, report, visitor_rows, new_visitors, visitor_keys, new_keys):
        created_rows = []
        for index, payload in enumerate(new_visitors):
            if payload.get("prospect") is not None:
                person = self._person_from_prospect(report, payload)
            else:
                person = self._create_visitor_person(
                    report.branch, report.session_date, payload
                )
            created_rows.append(
                {
                    "person": person,
                    "attendance_kind": payload.get("attendance_kind")
                    or SundayBibleStudyVisitor.AttendanceKind.FIRST_TIME,
                    "progress": payload.get("progress") or "",
                    "note": payload.get("note") or "",
                    "inviter": payload.get("inviter"),
                    "inviter_was_sent": index < len(new_keys)
                    and "inviter_id" in new_keys[index],
                }
            )

        desired = []
        for index, payload in enumerate(visitor_rows):
            desired.append(
                {
                    "person": payload["person"],
                    "attendance_kind": payload["attendance_kind"],
                    "progress": payload.get("progress") or "",
                    "note": payload.get("note") or "",
                    "inviter": payload.get("inviter"),
                    "inviter_was_sent": index < len(visitor_keys)
                    and "inviter_id" in visitor_keys[index],
                    "date_first_attended": payload.get("date_first_attended"),
                    "first_activity_attended": payload.get(
                        "first_activity_attended"
                    ),
                }
            )
        desired.extend(created_rows)

        member_ids = set(report.members_attended.values_list("id", flat=True))
        visitor_ids = [item["person"].id for item in desired]
        if len(visitor_ids) != len(set(visitor_ids)) or member_ids.intersection(
            visitor_ids
        ):
            raise serializers.ValidationError(
                {
                    "visitors": (
                        "Each person can only be recorded once on this report."
                    )
                }
            )

        existing = {row.person_id: row for row in report.visitors.all()}
        keep = set()
        for item in desired:
            person = item["person"]
            keep.add(person.id)
            row = existing.get(person.id)
            if row is None:
                row = SundayBibleStudyVisitor(
                    report=report,
                    person=person,
                )
            row.attendance_kind = item["attendance_kind"]
            row.progress = item.get("progress") or ""
            row.note = item["note"]
            row.save()
            self._apply_inviter(person, item, item["inviter_was_sent"])
            if (
                item.get("attendance_kind")
                == SundayBibleStudyVisitor.AttendanceKind.RETURNING
            ):
                self._apply_first_attendance(person, item)
            self._sync_journey(row, report)
        for person_id, row in existing.items():
            if person_id not in keep:
                journey_id = row.journey_id
                row.delete()
                if journey_id:
                    Journey.objects.filter(pk=journey_id).delete()

    def _nested_inputs(self, validated_data):
        facilitators = validated_data.pop("facilitators", serializers.empty)
        visitors = validated_data.pop("visitors", serializers.empty)
        new_visitors = validated_data.pop("new_visitors", serializers.empty)
        members = validated_data.pop("members_attended", serializers.empty)
        return facilitators, visitors, new_visitors, members

    def _store_nested(self, report, facilitators, visitors, new_visitors, members):
        if report.cancelled:
            self._clear_attendance(report)
            return
        if members is not serializers.empty:
            report.members_attended.set(members)
        if facilitators is not serializers.empty:
            self._sync_facilitators(report, facilitators)
        if visitors is not serializers.empty or new_visitors is not serializers.empty:
            visitor_rows = [] if visitors is serializers.empty else visitors
            new_rows = [] if new_visitors is serializers.empty else new_visitors
            if visitors is serializers.empty and self.instance is not None:
                visitor_rows = [
                    {
                        "person": row.person,
                        "attendance_kind": row.attendance_kind,
                        "progress": row.progress,
                        "note": row.note,
                    }
                    for row in report.visitors.select_related("person")
                ]
                visitor_keys = [{} for _ in visitor_rows]
            else:
                visitor_keys = self.initial_data.get("visitors") or []
            new_keys = self.initial_data.get("new_visitors") or []
            self._sync_visitors(
                report, visitor_rows, new_rows, visitor_keys, new_keys
            )

    @transaction.atomic
    def create(self, validated_data):
        facilitators, visitors, new_visitors, members = self._nested_inputs(
            validated_data
        )
        report = SundayBibleStudyReport.objects.create(**validated_data)
        self._store_nested(report, facilitators, visitors, new_visitors, members)
        return report

    @transaction.atomic
    def update(self, instance, validated_data):
        facilitators, visitors, new_visitors, members = self._nested_inputs(
            validated_data
        )
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        self._store_nested(instance, facilitators, visitors, new_visitors, members)
        return instance


class SundayBibleStudyPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


class SundayBibleStudyReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor, IsMemberOrAbove]
    serializer_class = SundayBibleStudyReportSerializer
    pagination_class = SundayBibleStudyPagination
    queryset = SundayBibleStudyReport.objects.select_related(
        "branch",
        "submitted_by",
    ).prefetch_related(
        "members_attended",
        "facilitators__person",
        "facilitators__groups_at_assignment",
        "visitors__person__inviter",
        "visitors__journey",
    )

    def get_permissions(self):
        if self.action in ("list", "retrieve", "summary", "facilitator_options"):
            return [
                IsAuthenticatedAndNotVisitor(),
                IsMemberOrAbove(),
                CanBrowseSundayBibleStudies(),
            ]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        return [IsAuthenticatedAndNotVisitor(), HasSundayBibleStudyWrite()]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_facilitator_warnings"] = self.action in (
            "retrieve",
            "create",
            "update",
            "partial_update",
        )
        return context

    def get_queryset(self):
        queryset = filter_sunday_bible_studies_for_user(
            self.request.user, super().get_queryset()
        )
        params = self.request.query_params
        session_date = params.get("session_date")
        if session_date:
            queryset = queryset.filter(session_date=session_date)
        date_from = params.get("session_date_from")
        if date_from:
            queryset = queryset.filter(session_date__gte=date_from)
        date_to = params.get("session_date_to")
        if date_to:
            queryset = queryset.filter(session_date__lte=date_to)
        year = params.get("year")
        if year and str(year).isdigit():
            queryset = queryset.filter(year=int(year))
        week_raw = params.get("week_number")
        if week_raw:
            week_numbers = []
            for part in str(week_raw).split(","):
                part = part.strip()
                if part.isdigit():
                    number = int(part)
                    if 1 <= number <= 53:
                        week_numbers.append(number)
            if week_numbers:
                queryset = queryset.filter(week_number__in=week_numbers)
        session_type = params.get("session_type")
        if session_type:
            queryset = queryset.filter(session_type=session_type)
        branch = params.get("branch")
        if (
            branch
            and str(branch).isdigit()
            and getattr(self.request.user, "role", None) == "ADMIN"
        ):
            queryset = queryset.filter(branch_id=int(branch))
        facilitator = params.get("facilitator")
        if facilitator:
            queryset = queryset.filter(facilitators__person_id=facilitator)
        cancelled = params.get("cancelled")
        if cancelled in ("true", "false"):
            queryset = queryset.filter(cancelled=(cancelled == "true"))
        return queryset.distinct()

    def perform_create(self, serializer):
        if not user_can_create_sunday_bible_study(self.request.user):
            raise PermissionDenied(
                "You do not have permission to submit a Sunday Bible study report."
            )
        serializer.save(submitted_by=self.request.user)

    def perform_update(self, serializer):
        if not user_can_update_sunday_bible_study(
            self.request.user, serializer.instance
        ):
            raise PermissionDenied(
                "You do not have permission to update this Sunday Bible study report."
            )
        serializer.save()

    @action(detail=False, methods=["get"], url_path="facilitators")
    def facilitator_options(self, request):
        ministry = get_bible_sharers_ministry()
        if ministry is None:
            return Response([])
        rows = (
            MinistryMember.objects.filter(ministry=ministry, is_active=True)
            .select_related("member", "member__branch")
            .prefetch_related("member__clusters")
            .order_by("member__first_name", "member__last_name")
        )
        return Response(
            [
                {
                    "id": row.member_id,
                    "name": row.member.get_full_name() or row.member.username,
                    "status": row.member.status,
                    "branch": row.member.branch_id,
                    "cluster_codes": [
                        code
                        for code in (
                            cluster.code for cluster in row.member.clusters.all()
                        )
                        if code
                    ],
                }
                for row in rows
            ]
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        reports = self.get_queryset()
        held = reports.filter(cancelled=False)

        def bucket(session_type):
            scoped = reports.filter(session_type=session_type)
            held_scoped = held.filter(session_type=session_type)
            held_ids = held_scoped.values("id")
            members = (
                SundayBibleStudyReport.members_attended.through.objects.filter(
                    sundaybiblestudyreport_id__in=held_ids
                ).count()
            )
            first_time = SundayBibleStudyVisitor.objects.filter(
                report__in=held_scoped,
                attendance_kind=SundayBibleStudyVisitor.AttendanceKind.FIRST_TIME,
            ).count()
            returning = SundayBibleStudyVisitor.objects.filter(
                report__in=held_scoped,
                attendance_kind=SundayBibleStudyVisitor.AttendanceKind.RETURNING,
            ).count()
            return {
                "report_count": scoped.count(),
                "cancelled_count": scoped.filter(cancelled=True).count(),
                "member_attendance": members,
                "first_time_visitors": first_time,
                "returning_visitors": returning,
                "total_attendance": members + first_time + returning,
            }

        member_ids = set(
            Person.objects.filter(
                sunday_bible_study_reports_as_member__in=held
            ).values_list("id", flat=True)
        )
        visitor_ids = set(
            SundayBibleStudyVisitor.objects.filter(report__in=held).values_list(
                "person_id", flat=True
            )
        )
        before = bucket(SundayBibleStudyReport.SessionType.BEFORE_SERVICE)
        after = bucket(SundayBibleStudyReport.SessionType.AFTER_SERVICE)
        return Response(
            {
                "report_count": reports.count(),
                "cancelled_count": reports.filter(cancelled=True).count(),
                "member_attendance": before["member_attendance"]
                + after["member_attendance"],
                "first_time_visitors": before["first_time_visitors"]
                + after["first_time_visitors"],
                "returning_visitors": before["returning_visitors"]
                + after["returning_visitors"],
                "total_attendance": before["total_attendance"]
                + after["total_attendance"],
                "unique_people": len(member_ids | visitor_ids),
                "by_session_type": {
                    SundayBibleStudyReport.SessionType.BEFORE_SERVICE: before,
                    SundayBibleStudyReport.SessionType.AFTER_SERVICE: after,
                },
            }
        )

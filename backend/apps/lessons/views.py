from __future__ import annotations

from datetime import datetime
from typing import Iterable

from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.people.models import Person
from apps.authentication.permissions import (
    IsMemberOrAbove,
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
    IsAdmin,
    CanManageLessonCatalog,
)
from apps.ministries.models import MinistryMember, NCC_MINISTRY_CODE
from apps.ministries.ncc import (
    ensure_ncc_ministry,
    lessons_teacher_access_person_ids,
)
from apps.lessons.branch_scope import can_pick_lessons_branch
from apps.lessons.coordinator_access import (
    can_review_lesson_assignment_requests,
    can_view_lesson_timeline,
    has_lessons_browse_all,
    has_lessons_teacher_assignment,
    is_scoped_lessons_teacher,
)

from .models import (
    Lesson,
    LessonAssignmentRequest,
    LessonSessionReport,
    LessonSettings,
    LessonStudentEnrollment,
    PersonLessonProgress,
)
from .serializers import (
    EnrollmentCommitmentSerializer,
    LessonAssignmentRequestSerializer,
    LessonBulkAssignSerializer,
    LessonCompletionSerializer,
    LessonFollowUpInputSerializer,
    LessonSerializer,
    LessonSettingsSerializer,
    LessonSessionReportSerializer,
    LessonStudentEnrollmentSerializer,
    LessonTeacherTransferRequestSerializer,
    LessonTeacherTransferSerializer,
    PersonLessonProgressSerializer,
)
from .branch_scope import apply_branch_to_person_queryset, apply_lessons_branch_filter
from .services import (
    approve_lesson_assignment_request,
    bulk_assign_lessons,
    build_lesson_progress_summary,
    build_lesson_timeline,
    clear_lesson_follow_up_for_newer_session,
    clear_pre_lesson_session_journey,
    mark_progress_completed,
    reconcile_student_progress_from_reports,
    reject_lesson_assignment_request,
    save_lesson_follow_up,
    student_cannot_be_own_teacher_error,
    _follow_up_payload,
    submit_lesson_assignment_request,
    sync_pre_lesson_session_journey,
)


def _ncc_roster_rows(memberships: Iterable[MinistryMember]) -> list[dict]:
    memberships = list(memberships)
    access_ids = lessons_teacher_access_person_ids(
        membership.member for membership in memberships
    )
    results = []
    for membership in memberships:
        person = membership.member
        branch_id = membership.ministry.branch_id
        results.append(
            {
                "id": person.id,
                "username": person.username,
                "first_name": person.first_name,
                "middle_name": person.middle_name,
                "last_name": person.last_name,
                "suffix": person.suffix,
                "nickname": getattr(person, "nickname", "") or "",
                "role": person.role,
                "member_id": person.member_id,
                "is_active": membership.is_active,
                "has_lessons_teacher_access": person.id in access_ids,
                "branch": branch_id,
                "branch_id": branch_id,
            }
        )
    return results


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndNotVisitor, IsMemberOrAbove])
def lesson_teacher_roster(request):
    """
    Teachers on the NCC / Lessons ministry roster (active + inactive).
    Query: branch_id (optional). Privileged users who omit it receive all branches.
    """
    user = request.user
    branch_param = request.query_params.get("branch_id") or request.query_params.get(
        "branch"
    )
    branch_id = None
    if branch_param:
        try:
            branch_id = int(branch_param)
        except (TypeError, ValueError):
            raise ValidationError({"branch_id": "Invalid branch id."})

    from apps.people.models import Branch

    membership_qs = MinistryMember.objects.select_related("member", "ministry")

    if can_pick_lessons_branch(user):
        if branch_id is None:
            memberships = list(
                membership_qs.filter(ministry__code=NCC_MINISTRY_CODE).order_by(
                    "member__last_name", "member__first_name"
                )
            )
            return Response(_ncc_roster_rows(memberships))

        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            raise ValidationError({"branch_id": "Branch not found."})
        ministry = ensure_ncc_ministry(branch)
        memberships = list(
            membership_qs.filter(ministry=ministry).order_by(
                "member__last_name", "member__first_name"
            )
        )
        return Response(_ncc_roster_rows(memberships))

    branch_id = user.branch_id
    if not branch_id:
        return Response([])

    if branch_param and int(branch_param) != branch_id:
        raise ValidationError({"branch_id": "You can only view your own branch roster."})

    try:
        branch = Branch.objects.get(pk=branch_id)
    except Branch.DoesNotExist:
        raise ValidationError({"branch_id": "Branch not found."})

    ministry = ensure_ncc_ministry(branch)
    memberships = list(
        membership_qs.filter(ministry=ministry).order_by(
            "member__last_name", "member__first_name"
        )
    )
    return Response(_ncc_roster_rows(memberships))


def _visitor_since(person: Person) -> str | None:
    if person.date_first_attended:
        return person.date_first_attended.isoformat()
    joined = person.date_joined
    if not joined:
        return None
    if timezone.is_aware(joined):
        joined = timezone.localtime(joined)
    return joined.date().isoformat()


def _can_list_visitors_awaiting_teacher(user: Person) -> bool:
    if getattr(user, "role", None) in ("ADMIN", "PASTOR"):
        return True
    return has_lessons_browse_all(user)


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndNotVisitor])
def visitors_awaiting_teacher(request):
    """
    Visitors with no live lessons teacher.

    Includes people with no enrollment and enrollments that only have a
    historical teacher name. Excludes deceased visitors and anyone who has
    already finished lessons.
    """
    user = request.user
    if not isinstance(user, Person) or not _can_list_visitors_awaiting_teacher(user):
        raise PermissionDenied(
            "You do not have permission to view visitors awaiting a lessons teacher."
        )

    from apps.clusters.models import Cluster

    live_teacher = LessonStudentEnrollment.objects.filter(
        student_id=OuterRef("pk"),
        teacher__isnull=False,
    )
    queryset = (
        Person.objects.filter(role="VISITOR")
        .exclude(status="DECEASED")
        .exclude(has_finished_lessons=True)
        .exclude(Exists(live_teacher))
        .select_related("branch", "inviter")
        .prefetch_related(
            Prefetch(
                "clusters",
                queryset=Cluster.objects.order_by("code", "name", "id"),
            )
        )
        .order_by("last_name", "first_name", "id")
    )
    queryset = apply_branch_to_person_queryset(queryset, user, request)
    people = list(queryset)
    enrollment_ids = dict(
        LessonStudentEnrollment.objects.filter(
            student_id__in=[person.id for person in people],
            teacher__isnull=True,
        ).values_list("student_id", "id")
    )

    payload = []
    for person in people:
        cluster_codes = []
        for cluster in person.clusters.all():
            code = (cluster.code or "").strip()
            if code:
                cluster_codes.append(code)
        branch_code = ""
        if person.branch_id and person.branch is not None:
            branch_code = (person.branch.code or "").strip()
        inviter = person.inviter
        inviter_name = ""
        if inviter is not None:
            inviter_name = inviter.get_full_name() or inviter.username
        payload.append(
            {
                "id": person.id,
                "name": person.get_full_name() or person.username,
                "first_name": person.first_name or "",
                "last_name": person.last_name or "",
                "branch_id": person.branch_id,
                "branch_code": branch_code,
                "cluster_codes": cluster_codes,
                "phone": person.phone or "",
                "visitor_since": _visitor_since(person),
                "inviter_name": inviter_name,
                "enrollment_id": enrollment_ids.get(person.id),
            }
        )
    return Response(payload)


class LessonViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = LessonSerializer
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        Catalog create/update, commitment POST, and NCC lessons PDF POST:
        HQ Admin/Pastor/Coordinator only.
        """
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "commitment_form":
            if self.request.method == "GET":
                return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
            return [IsAuthenticatedAndNotVisitor(), CanManageLessonCatalog()]
        if self.action == "ncc_lessons_pdf":
            return [IsAuthenticatedAndNotVisitor(), CanManageLessonCatalog()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        # create / update / partial_update
        return [IsAuthenticatedAndNotVisitor(), CanManageLessonCatalog()]

    def get_queryset(self):
        queryset = (
            Lesson.objects.all()
            .select_related("journey_config")
            .prefetch_related(
                Prefetch(
                    "progress_records",
                    queryset=PersonLessonProgress.objects.select_related("person"),
                )
            )
        )
        include_superseded = self.request.query_params.get("include_superseded")
        if not include_superseded:
            queryset = queryset.filter(is_latest=True, is_active=True)
        return queryset.order_by("order", "version_label")

    def _get_settings(self) -> LessonSettings:
        settings, _ = LessonSettings.objects.get_or_create(id=1)
        return settings

    @action(
        detail=False,
        methods=["get", "post"],
        url_path="commitment-form",
        parser_classes=[MultiPartParser, FormParser],
    )
    def commitment_form(self, request):
        settings = self._get_settings()

        if request.method == "POST":
            serializer = LessonSettingsSerializer(
                settings,
                data=request.data,
                context={"request": request},
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = LessonSettingsSerializer(settings, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="ncc-lessons-pdf",
        parser_classes=[MultiPartParser, FormParser],
    )
    def ncc_lessons_pdf(self, request):
        settings = self._get_settings()
        serializer = LessonSettingsSerializer(
            settings,
            data=request.data,
            context={"request": request},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        if "ncc_lessons_pdf" not in serializer.validated_data:
            raise ValidationError(
                {"ncc_lessons_pdf": "Please choose a PDF to upload."}
            )
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class PersonLessonProgressViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = PersonLessonProgressSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = PersonLessonProgress.objects.select_related(
            "person", "lesson", "lesson__journey_config", "journey"
        )
        
        # ADMIN/PASTOR: All progress
        if user.role in ["ADMIN", "PASTOR"]:
            pass  # No filtering
        # Lessons Coordinator / Senior / NCC primary or support: All progress
        elif has_lessons_browse_all(user):
            pass  # No filtering
        # Lessons Teacher: Only progress for their students
        elif has_lessons_teacher_assignment(user):
            queryset = queryset.filter(person__lesson_enrollment__teacher=user)
        # MEMBER: Only own progress
        elif user.role == "MEMBER":
            queryset = queryset.filter(person=user)
        else:
            # Default: empty queryset for safety
            queryset = queryset.none()
        
        # Apply query filters
        person_id = self.request.query_params.get("person")
        if person_id:
            queryset = queryset.filter(person_id=person_id)
        lesson_id = self.request.query_params.get("lesson")
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        queryset = apply_lessons_branch_filter(
            queryset, user, self.request, person_lookup="person"
        )
        return queryset.order_by("lesson__order", "-updated_at")
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        else:
            # Write operations: ADMIN, PASTOR, Lessons Coordinator, or Teacher
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('LESSONS', 'write')]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        progress = self.get_object()
        serializer = LessonCompletionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        completed_at = data.get("completed_at") or timezone.now()
        completed_by = data.get("completed_by") or (
            request.user if isinstance(request.user, Person) else None
        )
        note = data.get("note") or progress.notes

        result = mark_progress_completed(
            progress,
            completed_by=completed_by,
            note=note,
            completed_at=completed_at,
        )

        output_serializer = self.get_serializer(result.progress)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def assign(self, request):
        serializer = LessonBulkAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lesson: Lesson = serializer.validated_data["lesson"]
        persons: Iterable[Person] = serializer.validated_data["persons"]
        assigned_by = request.user if isinstance(request.user, Person) else None

        teacher = serializer.validated_data.get("teacher")
        if is_scoped_lessons_teacher(assigned_by):
            if teacher is None or teacher.pk != assigned_by.pk:
                return Response(
                    {
                        "detail": (
                            "Lessons teachers can only request students for themselves."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            person_list = list(persons)
            for person in person_list:
                submit_lesson_assignment_request(
                    student=person,
                    teacher=assigned_by,
                    requested_by=assigned_by,
                    lessons=[lesson],
                    add_lessons_if_pending=True,
                )
            return Response(
                {"created": 0, "requests": len(person_list)},
                status=status.HTTP_201_CREATED,
            )

        created_count = bulk_assign_lessons(
            lesson,
            persons,
            assigned_by=assigned_by,
            teacher=teacher,
        )

        return Response(
            {"created": created_count},
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.get_queryset()

        lesson_id = request.query_params.get("lesson")
        version_label = request.query_params.get("version_label")
        include_superseded_param = request.query_params.get("include_superseded")
        include_superseded = (
            str(include_superseded_param).lower() in {"1", "true", "yes"}
            if include_superseded_param is not None
            else False
        )

        year_param = request.query_params.get("year")
        if year_param:
            try:
                target_year = int(year_param)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"year": "Year must be a valid number."}) from exc
        else:
            target_year = timezone.now().year

        if target_year < 1900 or target_year > 3000:
            raise ValidationError({"year": "Year must be between 1900 and 3000."})

        payload = build_lesson_progress_summary(
            queryset,
            year=target_year,
            lesson_id=int(lesson_id) if lesson_id else None,
            version_label=version_label or None,
            include_superseded=include_superseded,
        )

        unassigned_visitors_qs = Person.objects.filter(role="VISITOR").filter(
            lesson_progress__isnull=True
        )
        unassigned_visitors_qs = apply_branch_to_person_queryset(
            unassigned_visitors_qs, request.user, request
        )
        payload["unassigned_visitors"] = unassigned_visitors_qs.distinct().count()

        return Response(payload)

    def _timeline_people(self):
        progress_ids = PersonLessonProgress.objects.values("person_id")
        enrollment_ids = LessonStudentEnrollment.objects.values("student_id")
        people = Person.objects.filter(
            Q(pk__in=progress_ids) | Q(pk__in=enrollment_ids)
        ).distinct()
        people = apply_branch_to_person_queryset(
            people, self.request.user, self.request
        )
        if is_scoped_lessons_teacher(self.request.user):
            people = people.filter(lesson_enrollment__teacher=self.request.user)
        return people

    @action(detail=False, methods=["get"], url_path="timeline")
    def timeline(self, request):
        if not can_view_lesson_timeline(request.user):
            raise PermissionDenied(
                "You do not have permission to view the lessons timeline."
            )
        return Response(build_lesson_timeline(self._timeline_people()))

    @action(detail=False, methods=["post"], url_path="follow-up")
    def follow_up(self, request):
        if not can_view_lesson_timeline(request.user):
            raise PermissionDenied(
                "You do not have permission to record a lessons follow-up."
            )
        serializer = LessonFollowUpInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = serializer.validated_data["student"]
        if not self._timeline_people().filter(pk=student.pk).exists():
            raise PermissionDenied(
                "That student is outside your lessons timeline."
            )
        case = save_lesson_follow_up(
            student=student,
            actor=request.user if isinstance(request.user, Person) else None,
            status=serializer.validated_data["status"],
            action_text=serializer.validated_data.get("action_text") or "",
            excuse_text=serializer.validated_data.get("excuse_text") or "",
            who=serializer.validated_data.get("who") or "",
            when_date=serializer.validated_data.get("when"),
            remarks=serializer.validated_data.get("remarks") or "",
        )
        return Response(_follow_up_payload(case))


class LessonSessionReportViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = LessonSessionReportSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = LessonSessionReport.objects.select_related(
            "teacher", "student", "lesson"
        )
        
        # ADMIN/PASTOR: All reports
        if user.role in ["ADMIN", "PASTOR"]:
            pass  # No filtering
        # Lessons Coordinator / Senior / NCC primary or support: All reports
        elif has_lessons_browse_all(user):
            pass  # No filtering
        # Lessons Teacher: Only reports where they are the teacher
        elif has_lessons_teacher_assignment(user):
            queryset = queryset.filter(teacher=user)
        # MEMBER: Only reports where they are the student
        elif user.role == "MEMBER":
            queryset = queryset.filter(student=user)
        else:
            # Default: empty queryset for safety
            queryset = queryset.none()
        
        # Apply query filters
        teacher_id = self.request.query_params.get("teacher")
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
        student_id = self.request.query_params.get("student")
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        lesson_id = self.request.query_params.get("lesson")
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)

        session_type = self.request.query_params.get("session_type")
        if session_type:
            queryset = queryset.filter(session_type=session_type)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(session_date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(session_date__lte=date_to)

        queryset = apply_lessons_branch_filter(
            queryset, user, self.request, person_lookup="student"
        )
        return queryset.order_by("-session_date", "-session_start")
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        if self.action == "destroy":
            return [IsAuthenticatedAndNotVisitor(), IsAdmin()]
        # Write operations: ADMIN, PASTOR, Lessons Coordinator, or Teacher
        return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('LESSONS', 'write')]

    def perform_create(self, serializer):
        request = self.request
        validated = serializer.validated_data
        teacher = validated.get("teacher")
        student = validated.get("student")
        if teacher is None and student is not None:
            enrollment = (
                LessonStudentEnrollment.objects.filter(student=student, is_active=True)
                .select_related("teacher")
                .first()
            )
            if enrollment:
                teacher = enrollment.teacher
        if (
            teacher is None
            and isinstance(request.user, Person)
            and request.user.role != "VISITOR"
        ):
            teacher = request.user

        if teacher is None:
            raise ValidationError({"teacher": "Teacher is required."})

        reason = student_cannot_be_own_teacher_error(student, teacher)
        if reason:
            raise ValidationError({"teacher_id": reason})

        report = serializer.save(
            teacher=teacher,
            submitted_by=request.user if isinstance(request.user, Person) else None,
        )
        self._sync_report_side_effects(report)

    def perform_update(self, serializer):
        report = serializer.save(
            submitted_by=self.request.user
            if isinstance(self.request.user, Person)
            else None
        )
        self._sync_report_side_effects(report)

    def perform_destroy(self, instance):
        student = instance.student
        clear_pre_lesson_session_journey(instance)
        super().perform_destroy(instance)
        if student:
            reconcile_student_progress_from_reports(student, force_report_rules=True)

    def _sync_report_side_effects(self, report: LessonSessionReport) -> None:
        clear_lesson_follow_up_for_newer_session(report)
        if report.session_type == LessonSessionReport.SessionType.PRE_LESSON:
            sync_pre_lesson_session_journey(report)
            return
        clear_pre_lesson_session_journey(report)
        self._sync_progress(report)

    def _sync_progress(self, report: LessonSessionReport) -> None:
        if report.session_type != LessonSessionReport.SessionType.LESSON:
            return

        student = report.student
        lesson = report.lesson
        if not student or not lesson:
            return

        progress = report.progress
        if progress is None:
            progress = (
                PersonLessonProgress.objects.filter(
                    person=student, lesson=lesson
                )
                .order_by("-updated_at")
                .first()
            )

        if progress is None:
            progress = PersonLessonProgress.objects.create(
                person=student,
                lesson=lesson,
                status=PersonLessonProgress.Status.ASSIGNED,
                assigned_by=report.teacher,
                started_at=report.session_start,
            )
        else:
            updated_fields = []
            if progress.started_at is None and report.session_start:
                progress.started_at = report.session_start
                updated_fields.append("started_at")
            if updated_fields:
                updated_fields.append("updated_at")
                progress.save(update_fields=updated_fields)

        completed_by = progress.completed_by or report.teacher or report.submitted_by
        completed_at = progress.completed_at or report.session_start or timezone.now()
        completion_note = progress.notes or report.remarks
        mark_progress_completed(
            progress,
            completed_by=completed_by,
            note=completion_note,
            completed_at=completed_at,
            completion_date=report.session_date,
        )

        if report.progress_id != progress.id:
            report.progress = progress
            report.save(update_fields=["progress", "updated_at"])


class LessonStudentEnrollmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = LessonStudentEnrollmentSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = LessonStudentEnrollment.objects.select_related(
            "student", "teacher", "assigned_by"
        )

        if user.role in ["ADMIN", "PASTOR"]:
            pass
        elif has_lessons_browse_all(user):
            pass
        elif has_lessons_teacher_assignment(user):
            queryset = queryset.filter(teacher=user)
        elif user.role == "MEMBER":
            queryset = queryset.filter(student=user)
        else:
            queryset = queryset.none()

        student_id = self.request.query_params.get("student")
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        teacher_id = self.request.query_params.get("teacher")
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        queryset = apply_lessons_branch_filter(
            queryset, user, self.request, person_lookup="student"
        )
        return queryset.order_by("student__last_name", "student__first_name")

    def get_permissions(self):
        if self.action in ["list", "retrieve", "transfers"]:
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        return [IsAuthenticatedAndNotVisitor(), HasModuleAccess("LESSONS", "write")]

    def create(self, request, *args, **kwargs):
        if is_scoped_lessons_teacher(request.user):
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            teacher = serializer.validated_data["teacher"]
            student = serializer.validated_data["student"]
            if teacher.pk != request.user.pk:
                return Response(
                    {
                        "detail": (
                            "Lessons teachers can only request students for themselves."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            assignment_request = submit_lesson_assignment_request(
                student=student,
                teacher=request.user,
                requested_by=request.user,
                lessons=[],
            )
            output = LessonAssignmentRequestSerializer(
                assignment_request, context={"request": request}
            )
            return Response(output.data, status=status.HTTP_201_CREATED)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        enrollment = self.get_object()
        serializer = LessonTeacherTransferRequestSerializer(
            data=request.data,
            context={"enrollment": enrollment, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        enrollment.refresh_from_db()
        return Response(
            LessonStudentEnrollmentSerializer(
                enrollment, context={"request": request}
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def transfers(self, request, pk=None):
        enrollment = self.get_object()
        transfers = enrollment.transfers.select_related(
            "from_teacher", "to_teacher", "transferred_by"
        )
        serializer = LessonTeacherTransferSerializer(transfers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="commitment")
    def commitment(self, request, pk=None):
        enrollment = self.get_object()
        serializer = EnrollmentCommitmentSerializer(
            data=request.data,
            context={"enrollment": enrollment, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        enrollment = serializer.save()
        return Response(
            LessonStudentEnrollmentSerializer(
                enrollment, context={"request": request}
            ).data,
            status=status.HTTP_200_OK,
        )


class LessonAssignmentRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LessonAssignmentRequestSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = LessonAssignmentRequest.objects.select_related(
            "student", "teacher", "requested_by", "reviewed_by"
        ).prefetch_related("lessons")

        if getattr(user, "role", None) in ["ADMIN", "PASTOR"] or has_lessons_browse_all(
            user
        ):
            pass
        elif has_lessons_teacher_assignment(user):
            queryset = queryset.filter(teacher=user)
        else:
            queryset = queryset.none()

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        queryset = apply_lessons_branch_filter(
            queryset, user, self.request, person_lookup="student"
        )
        return queryset.order_by("-created_at")

    def get_permissions(self):
        if self.action == "create":
            return [
                IsAuthenticatedAndNotVisitor(),
                HasModuleAccess("LESSONS", "write"),
            ]
        return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]

    def create(self, request, *args, **kwargs):
        if not is_scoped_lessons_teacher(request.user):
            return Response(
                {
                    "detail": (
                        "Only Lessons teachers submit assignment requests. "
                        "Coordinators assign students directly."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def _deny_unless_reviewer(self, request):
        if can_review_lesson_assignment_requests(request.user):
            return None
        return Response(
            {
                "detail": (
                    "You do not have permission to review lesson assignment requests."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        denied = self._deny_unless_reviewer(request)
        if denied is not None:
            return denied
        assignment_request = self.get_object()
        note = request.data.get("review_note") or request.data.get("note") or ""
        updated = approve_lesson_assignment_request(
            assignment_request, request.user, note=note
        )
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        denied = self._deny_unless_reviewer(request)
        if denied is not None:
            return denied
        assignment_request = self.get_object()
        note = request.data.get("review_note") or request.data.get("note") or ""
        updated = reject_lesson_assignment_request(
            assignment_request, request.user, note=note
        )
        return Response(self.get_serializer(updated).data)

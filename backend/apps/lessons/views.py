from __future__ import annotations

from datetime import datetime
from typing import Iterable

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.people.models import Person
from apps.authentication.permissions import (
    IsMemberOrAbove, 
    IsAuthenticatedAndNotVisitor,
    HasModuleAccess,
)
from apps.people.models import ModuleCoordinator

from .models import Lesson, LessonSessionReport, LessonSettings, PersonLessonProgress
from .serializers import (
    LessonBulkAssignSerializer,
    LessonCompletionSerializer,
    LessonSerializer,
    LessonSettingsSerializer,
    LessonSessionReportSerializer,
    PersonLessonProgressSerializer,
)
from .services import bulk_assign_lessons, mark_progress_completed


class LessonViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndNotVisitor]
    serializer_class = LessonSerializer
    
    def get_permissions(self):
        """
        Override to set permissions based on action.
        """
        if self.action in ["list", "retrieve", "commitment_form"]:
            # Read operations: All authenticated non-visitors
            return [IsAuthenticatedAndNotVisitor(), IsMemberOrAbove()]
        else:
            # Write operations: ADMIN, PASTOR, or Lessons Coordinator
            return [IsAuthenticatedAndNotVisitor(), HasModuleAccess('LESSONS', 'write')]

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
        # Lessons Coordinator: All progress
        elif user.is_module_coordinator(
            ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR
        ):
            pass  # No filtering
        # Lessons Teacher: Only progress for their students
        elif user.is_module_coordinator(
            ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER
        ):
            # Get all students where this user is the teacher
            student_ids = LessonSessionReport.objects.filter(
                teacher=user
            ).values_list('student_id', flat=True).distinct()
            queryset = queryset.filter(person_id__in=student_ids)
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

        created_count = bulk_assign_lessons(lesson, persons, assigned_by=assigned_by)

        return Response(
            {"created": created_count},
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.get_queryset()

        lesson_id = request.query_params.get("lesson")
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)

        version_label = request.query_params.get("version_label")
        if version_label:
            queryset = queryset.filter(lesson__version_label=version_label)

        include_superseded_param = request.query_params.get("include_superseded")
        include_superseded = (
            str(include_superseded_param).lower() in {"1", "true", "yes"}
            if include_superseded_param is not None
            else False
        )
        if not include_superseded:
            queryset = queryset.filter(lesson__is_latest=True)

        # Backward-compatible raw record totals.
        record_status_totals = {
            status: 0 for status, _ in PersonLessonProgress.Status.choices
        }
        for entry in queryset.values("status").annotate(total=Count("id")):
            record_status_totals[entry["status"]] = entry["total"]

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

        if timezone.is_aware(timezone.now()):
            year_start = timezone.make_aware(
                datetime(target_year, 1, 1, 0, 0, 0),
                timezone.get_current_timezone(),
            )
            year_end = timezone.make_aware(
                datetime(target_year, 12, 31, 23, 59, 59, 999999),
                timezone.get_current_timezone(),
            )
        else:
            year_start = datetime(target_year, 1, 1, 0, 0, 0)
            year_end = datetime(target_year, 12, 31, 23, 59, 59, 999999)

        active_latest_queryset = queryset.filter(
            lesson__is_latest=True,
            lesson__is_active=True,
        ).select_related("lesson")

        # Include participants active in the selected year, including carry-over
        # assignments from prior years that are still not completed in-year.
        cohort_person_ids = list(
            active_latest_queryset.filter(
                assigned_at__lte=year_end
            )
            .filter(Q(completed_at__isnull=True) | Q(completed_at__gte=year_start))
            .values_list("person_id", flat=True)
            .distinct()
        )

        cohort_records = active_latest_queryset.filter(person_id__in=cohort_person_ids)
        records_by_person = {}
        for progress in cohort_records:
            records_by_person.setdefault(progress.person_id, []).append(progress)

        lessons_in_scope_count = (
            active_latest_queryset.values("lesson_id").distinct().count()
        )
        person_status_totals = {
            status: 0 for status, _ in PersonLessonProgress.Status.choices
        }

        for person_id in cohort_person_ids:
            person_records = records_by_person.get(person_id, [])
            completed_count = sum(
                1
                for record in person_records
                if record.status == PersonLessonProgress.Status.COMPLETED
            )

            if completed_count == 0:
                person_status_totals[PersonLessonProgress.Status.ASSIGNED] += 1
            elif lessons_in_scope_count > 0 and completed_count >= lessons_in_scope_count:
                person_status_totals[PersonLessonProgress.Status.COMPLETED] += 1
            else:
                person_status_totals[PersonLessonProgress.Status.IN_PROGRESS] += 1

        lesson_breakdown = (
            queryset.values(
                "lesson_id",
                "lesson__title",
                "lesson__version_label",
                "lesson__is_latest",
                "lesson__order",
            )
            .annotate(
                total=Count("id"),
                completed=Count("id", filter=Q(status="COMPLETED")),
                in_progress=Count("id", filter=Q(status="IN_PROGRESS")),
                assigned=Count("id", filter=Q(status="ASSIGNED")),
                skipped=Count("id", filter=Q(status="SKIPPED")),
            )
            .order_by("lesson__order", "lesson__version_label")
        )

        # Person-level total used by yearly summary cards.
        total_participants = len(cohort_person_ids)

        unassigned_visitors = (
            Person.objects.filter(role="VISITOR")
            .filter(lesson_progress__isnull=True)
            .distinct()
            .count()
        )

        return Response(
            {
                # Person-level status buckets for cards.
                "overall": person_status_totals,
                "total_participants": total_participants,
                "year": target_year,
                # Backward-compatible record-level totals.
                "overall_records": record_status_totals,
                "total_records": queryset.count(),
                "lessons": [
                    {
                        "lesson_id": row["lesson_id"],
                        "lesson_title": row["lesson__title"],
                        "version_label": row["lesson__version_label"],
                        "is_latest": row["lesson__is_latest"],
                        "order": row["lesson__order"],
                        "total": row["total"],
                        "completed": row["completed"],
                        "in_progress": row["in_progress"],
                        "assigned": row["assigned"],
                        "skipped": row["skipped"],
                    }
                    for row in lesson_breakdown
                ],
                "unassigned_visitors": unassigned_visitors,
            }
        )


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
        # Lessons Coordinator: All reports
        elif user.is_module_coordinator(
            ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.COORDINATOR
        ):
            pass  # No filtering
        # Lessons Teacher: Only reports where they are the teacher
        elif user.is_module_coordinator(
            ModuleCoordinator.ModuleType.LESSONS,
            level=ModuleCoordinator.CoordinatorLevel.TEACHER
        ):
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

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(session_date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(session_date__lte=date_to)

        return queryset.order_by("-session_date", "-session_start")
    
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

    def perform_create(self, serializer):
        request = self.request
        validated = serializer.validated_data
        teacher = validated.get("teacher")
        if (
            teacher is None
            and isinstance(request.user, Person)
            and request.user.role != "VISITOR"
        ):
            teacher = request.user

        if teacher is None:
            raise ValidationError({"teacher": "Teacher is required."})

        report = serializer.save(
            teacher=teacher,
            submitted_by=request.user if isinstance(request.user, Person) else None,
        )
        self._sync_progress(report)

    def perform_update(self, serializer):
        report = serializer.save(
            submitted_by=self.request.user
            if isinstance(self.request.user, Person)
            else None
        )
        self._sync_progress(report)

    def _sync_progress(self, report: LessonSessionReport) -> None:
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
        )

        if report.progress_id != progress.id:
            report.progress = progress
            report.save(update_fields=["progress", "updated_at"])

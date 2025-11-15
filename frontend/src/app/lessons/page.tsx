"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import LessonList from "@/src/components/lessons/LessonList";
import LessonDetailPanel from "@/src/components/lessons/LessonDetailPanel";
import LessonProgressTable from "@/src/components/lessons/LessonProgressTable";
import LessonForm, {
  LessonFormValues,
} from "@/src/components/lessons/LessonForm";
import LessonStatsCards from "@/src/components/lessons/LessonStatsCards";
import LessonSessionReportForm from "@/src/components/lessons/LessonSessionReportForm";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Card from "@/src/components/ui/Card";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import NoteInputModal from "@/src/components/ui/NoteInputModal";
import Pagination from "@/src/components/ui/Pagination";
import { lessonsApi } from "@/src/lib/api";
import {
  Lesson,
  LessonCommitmentSettings,
  LessonProgressStatus,
  LessonProgressSummary,
  LessonSessionReport,
  LessonSessionReportInput,
  PersonLessonProgress,
} from "@/src/types/lesson";
import { usePeople } from "@/src/hooks/usePeople";
import { formatPersonName } from "@/src/lib/name";

type LessonPersonLike = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
};

type SessionFilterValues = {
  teacherId: string;
  studentId: string;
  dateFrom: string;
  dateTo: string;
};

const createEmptySessionFilters = (): SessionFilterValues => ({
  teacherId: "",
  studentId: "",
  dateFrom: "",
  dateTo: "",
});

function sanitizeNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  const needsEscaping = /[",\n]/.test(stringValue);
  const sanitized = stringValue.replace(/"/g, '""');
  return needsEscaping ? `"${sanitized}"` : sanitized;
}

function extractErrorMessage(error: unknown, defaultMessage: string): string {
  if (error && typeof error === "object") {
    if ("response" in error && error.response) {
      const response = error.response as { data?: { detail?: string; message?: string } };
      if (response.data?.detail) {
        return response.data.detail;
      }
      if (response.data?.message) {
        return response.data.message;
      }
    }
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }
  return defaultMessage;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const [progress, setProgress] = useState<PersonLessonProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressActionError, setProgressActionError] = useState<string | null>(
    null
  );
  const [isProgressUpdating, setIsProgressUpdating] = useState(false);

  const [summary, setSummary] = useState<LessonProgressSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [commitmentSettings, setCommitmentSettings] =
    useState<LessonCommitmentSettings | null>(null);
  const [commitmentLoading, setCommitmentLoading] = useState(true);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);
  const [isCommitmentModalOpen, setCommitmentModalOpen] = useState(false);
  const [commitmentFile, setCommitmentFile] = useState<File | null>(null);
  const [commitmentUploading, setCommitmentUploading] = useState(false);
  const [commitmentUploadError, setCommitmentUploadError] = useState<
    string | null
  >(null);
  const [commitmentConfirm, setCommitmentConfirm] = useState<{
    record: PersonLessonProgress;
    nextValue: boolean;
  } | null>(null);
  const [noteInputModal, setNoteInputModal] = useState<{
    isOpen: boolean;
    record: PersonLessonProgress | null;
  }>({
    isOpen: false,
    record: null,
  });
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
  }>({
    isOpen: false,
    message: "",
  });

  const [isLessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonFormSubmitting, setLessonFormSubmitting] = useState(false);
  const [lessonFormError, setLessonFormError] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [activeContentTab, setActiveContentTab] =
    useState<LessonContentTab>("lesson");

  const [sessionReports, setSessionReports] = useState<LessonSessionReport[]>(
    []
  );
  const [sessionReportsLoading, setSessionReportsLoading] = useState(false);
  const [sessionReportsError, setSessionReportsError] = useState<string | null>(
    null
  );
  const [isSessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionFormSubmitting, setSessionFormSubmitting] = useState(false);
  const [sessionFormError, setSessionFormError] = useState<string | null>(null);
  const [editingSessionReport, setEditingSessionReport] =
    useState<LessonSessionReport | null>(null);
  const [sessionDeleteTarget, setSessionDeleteTarget] =
    useState<LessonSessionReport | null>(null);
  const [sessionDeleteLoading, setSessionDeleteLoading] = useState(false);
  const [sessionDeleteError, setSessionDeleteError] = useState<string | null>(
    null
  );
  const [lessonDeleteTarget, setLessonDeleteTarget] = useState<Lesson | null>(
    null
  );
  const [lessonDeleteLoading, setLessonDeleteLoading] = useState(false);
  const [lessonDeleteError, setLessonDeleteError] = useState<string | null>(
    null
  );
  const [sessionFormDefaults, setSessionFormDefaults] = useState<{
    studentId?: string | number | null;
    teacherId?: string | number | null;
    lessonId?: string | number | null;
    progressId?: string | number | null;
  }>({});
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [sessionFilters, setSessionFilters] = useState(
    createEmptySessionFilters
  );
  const [sessionFilterDraft, setSessionFilterDraft] = useState(
    createEmptySessionFilters
  );

  const { people, loading: peopleLoading, error: peopleError } = usePeople();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("currentUserId");
    if (stored) {
      setCurrentTeacherId(stored);
    }
  }, []);

  useEffect(() => {
    if (currentTeacherId) {
      return;
    }
    const firstTeacher = people.find((person) => person.role !== "VISITOR");
    if (firstTeacher) {
      setCurrentTeacherId(firstTeacher.id);
    }
  }, [people, currentTeacherId]);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  const progressSummary = useMemo(() => {
    const summary: Record<LessonProgressStatus, number> = {
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      SKIPPED: 0,
    };
    progress.forEach((record) => {
      summary[record.status] += 1;
    });
    return summary;
  }, [progress]);

  const formatDateOnly = (value?: string | null) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const teacherChoices = useMemo(() => {
    return [...people]
      .filter((person) => person.role !== "VISITOR")
      .sort((first, second) =>
        formatPersonName(first).localeCompare(
          formatPersonName(second)
        )
      );
  }, [people]);

  const studentChoices = useMemo(() => {
    return [...people].sort((first, second) =>
      formatPersonName(first).localeCompare(
        formatPersonName(second)
      )
    );
  }, [people]);

  useEffect(() => {
    fetchLessons();
    fetchSummary();
    fetchCommitmentForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLessonId) {
      fetchProgress(selectedLessonId);
      const defaults = createEmptySessionFilters();
      setSessionFilters(defaults);
      setSessionFilterDraft(defaults);
    } else {
      setProgress([]);
      setSessionReports([]);
      const defaults = createEmptySessionFilters();
      setSessionFilters(defaults);
      setSessionFilterDraft(defaults);
    }
  }, [selectedLessonId]);

  useEffect(() => {
    setActiveContentTab("lesson");
  }, [selectedLessonId]);

  useEffect(() => {
    if (!selectedLessonId) {
      return;
    }
    fetchSessionReports(selectedLessonId, sessionFilters);
  }, [sessionFilters, selectedLessonId]);

  const fetchLessons = async () => {
    try {
      setLessonsLoading(true);
      const response = await lessonsApi.getAll({ include_superseded: true });
      setLessons(response.data);
      setLessonsError(null);

      if (response.data.length > 0) {
        const existingSelection = response.data.find(
          (lesson) => lesson.id === selectedLessonId
        );
        setSelectedLessonId(
          existingSelection ? existingSelection.id : response.data[0].id
        );
      } else {
        setSelectedLessonId(null);
      }
    } catch (error) {
      setLessonsError(extractErrorMessage(error, "Failed to load lessons."));
    } finally {
      setLessonsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await lessonsApi.summary({ include_superseded: true });
      setSummary(response.data);
      setSummaryError(null);
    } catch (error) {
      setSummaryError(extractErrorMessage(error, "Failed to load lesson summary."));
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchSessionReports = async (
    lessonId: number,
    filtersOverride?: {
      teacherId?: string;
      studentId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    try {
      setSessionReportsLoading(true);
      const activeFilters = filtersOverride ?? sessionFilters;
      const params: {
        lesson: number;
        teacher?: number;
        student?: number;
        date_from?: string;
        date_to?: string;
      } = {
        lesson: lessonId,
      };

      const teacherValue = sanitizeNumericValue(activeFilters.teacherId);
      if (teacherValue) {
        params.teacher = teacherValue;
      }

      const studentValue = sanitizeNumericValue(activeFilters.studentId);
      if (studentValue) {
        params.student = studentValue;
      }

      if (activeFilters.dateFrom) {
        params.date_from = activeFilters.dateFrom;
      }

      if (activeFilters.dateTo) {
        params.date_to = activeFilters.dateTo;
      }

      const response = await lessonsApi.listSessionReports(params);
      const sorted = [...response.data].sort((first, second) => {
        const firstTime = new Date(first.session_start).getTime();
        const secondTime = new Date(second.session_start).getTime();
        return secondTime - firstTime;
      });
      setSessionReports(sorted);
      setSessionReportsError(null);
    } catch (error) {
      setSessionReportsError(extractErrorMessage(error, "Failed to load session reports."));
    } finally {
      setSessionReportsLoading(false);
    }
  };

  const fetchCommitmentForm = async () => {
    try {
      setCommitmentLoading(true);
      const response = await lessonsApi.getCommitmentForm();
      setCommitmentSettings(response.data);
      setCommitmentError(null);
    } catch (error) {
      setCommitmentError(extractErrorMessage(error, "Failed to load commitment form."));
    } finally {
      setCommitmentLoading(false);
    }
  };

  const fetchProgress = async (lessonId: number) => {
    try {
      setProgressLoading(true);
      const response = await lessonsApi.getProgress({ lesson: lessonId });
      setProgress(response.data);
      setProgressError(null);
    } catch (error) {
      setProgressError(extractErrorMessage(error, "Failed to load lesson progress."));
    } finally {
      setProgressLoading(false);
      setIsProgressUpdating(false);
    }
  };

  const handleSelectLesson = (lesson: Lesson) => {
    setSelectedLessonId(lesson.id);
  };

  const openCreateLesson = () => {
    setEditingLesson(null);
    setLessonFormError(null);
    setLessonFormOpen(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonFormError(null);
    setLessonFormOpen(true);
  };

  const requestDeleteLesson = (lesson: Lesson) => {
    setLessonDeleteTarget(lesson);
    setLessonDeleteError(null);
  };

  const confirmDeleteLesson = async () => {
    if (!lessonDeleteTarget) {
      return;
    }
    try {
      setLessonDeleteLoading(true);
      setLessonDeleteError(null);
      await lessonsApi.delete(lessonDeleteTarget.id);
      await fetchLessons();
      fetchSummary();
      setLessonFormOpen(false);
      setEditingLesson(null);
      setLessonDeleteTarget(null);
    } catch (error) {
      setLessonDeleteError(extractErrorMessage(error, "Failed to delete the lesson."));
    } finally {
      setLessonDeleteLoading(false);
    }
  };

  const closeLessonForm = () => {
    setLessonFormOpen(false);
    setLessonFormSubmitting(false);
    setLessonFormError(null);
    setEditingLesson(null);
  };

  const handleLessonFormSubmit = async (values: LessonFormValues) => {
    try {
      setLessonFormSubmitting(true);
      setLessonFormError(null);

      if (editingLesson) {
        await lessonsApi.update(editingLesson.id, values);
      } else {
        const response = await lessonsApi.create(values);
        setSelectedLessonId(response.data.id);
      }

      await fetchLessons();
      closeLessonForm();
    } catch (error) {
      setLessonFormError(extractErrorMessage(error, "There was a problem saving the lesson."));
    } finally {
      setLessonFormSubmitting(false);
    }
  };

  const updateProgressRecord = (updated: PersonLessonProgress) => {
    setProgress((prev) =>
      prev.map((record) => (record.id === updated.id ? updated : record))
    );
  };

  const handleMarkCompleted = (record: PersonLessonProgress) => {
    if (isProgressUpdating) return;
    setNoteInputModal({
      isOpen: true,
      record,
    });
  };

  const handleNoteInputConfirm = async (note: string) => {
    if (!noteInputModal.record) return;
    try {
      setIsProgressUpdating(true);
      setProgressActionError(null);
      const response = await lessonsApi.complete(noteInputModal.record.id, {
        note: note || undefined,
      });
      updateProgressRecord(response.data);
      setProgressError(null);
      fetchSummary();
      setNoteInputModal({ isOpen: false, record: null });
    } catch (error) {
      setProgressActionError(extractErrorMessage(error, "Failed to mark the lesson as completed."));
    } finally {
      setIsProgressUpdating(false);
    }
  };

  const handleUpdateStatus = async (
    record: PersonLessonProgress,
    status: LessonProgressStatus
  ) => {
    if (isProgressUpdating) return;
    try {
      setIsProgressUpdating(true);
      setProgressActionError(null);
      const response = await lessonsApi.updateProgress(record.id, { status });
      updateProgressRecord(response.data);
      setProgressError(null);
      fetchSummary();
    } catch (error) {
      setProgressActionError(extractErrorMessage(error, "Failed to update the lesson status."));
    } finally {
      setIsProgressUpdating(false);
    }
  };

  const requestCommitmentToggle = (record: PersonLessonProgress) => {
    if (isProgressUpdating) return;
    setCommitmentConfirm({
      record,
      nextValue: !record.commitment_signed,
    });
  };


  const confirmCommitmentToggle = async () => {
    if (!commitmentConfirm) return;
    const { record, nextValue } = commitmentConfirm;
    try {
      setIsProgressUpdating(true);
      setProgressActionError(null);
      const response = await lessonsApi.updateProgress(record.id, {
        commitment_signed: nextValue,
      });
      updateProgressRecord(response.data);
      setProgressError(null);
      fetchSummary();
    } catch (error) {
      setProgressActionError(extractErrorMessage(error, "Failed to update commitment status."));
    } finally {
      setIsProgressUpdating(false);
      setCommitmentConfirm(null);
    }
  };

  const handleCommitmentUpload = async () => {
    if (!commitmentFile) {
      setCommitmentUploadError("Please choose a PDF to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("commitment_form", commitmentFile);

    try {
      setCommitmentUploading(true);
      setCommitmentUploadError(null);
      const response = await lessonsApi.uploadCommitmentForm(formData);
      setCommitmentSettings(response.data);
      setCommitmentModalOpen(false);
      setCommitmentFile(null);
    } catch (error) {
      setCommitmentUploadError(extractErrorMessage(error, "Failed to upload the commitment form."));
    } finally {
      setCommitmentUploading(false);
    }
  };

  const togglePersonSelection = (personId: string) => {
    setSelectedPersonIds((previous) =>
      previous.includes(personId)
        ? previous.filter((id) => id !== personId)
        : [...previous, personId]
    );
  };

  const [assignSearch, setAssignSearch] = useState("");

  const filteredPeople = useMemo(() => {
    if (!assignSearch.trim()) {
      return people;
    }
    const term = assignSearch.trim().toLowerCase();
    return people.filter((person) => {
      const fullname = `${person.first_name ?? ""} ${
        person.last_name ?? ""
      }`.toLowerCase();
      return (
        fullname.includes(term) ||
        person.username.toLowerCase().includes(term) ||
        (person.member_id ?? "").toLowerCase().includes(term)
      );
    });
  }, [people, assignSearch]);

  const handleAssignSubmit = async () => {
    if (!selectedLesson) {
      setAssignError("Select a lesson before assigning participants.");
      return;
    }
    if (selectedPersonIds.length === 0) {
      setAssignError("Choose at least one person to assign.");
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      const personIds = selectedPersonIds
        .map((id) => Number(id))
        .filter((value) => !Number.isNaN(value));
      await lessonsApi.assign({
        lesson_id: selectedLesson.id,
        person_ids: personIds,
      });
      setAssignModalOpen(false);
      setSelectedPersonIds([]);
      await fetchProgress(selectedLesson.id);
      fetchSummary();
    } catch (error) {
      setAssignError(extractErrorMessage(error, "Failed to assign the lesson."));
    } finally {
      setAssigning(false);
    }
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignError(null);
    setSelectedPersonIds([]);
    setAssignSearch("");
  };

  const updateSessionFilterDraft = (
    field: keyof SessionFilterValues,
    value: string
  ) => {
    setSessionFilterDraft((previous) => ({ ...previous, [field]: value }));
  };

  const applySessionFilters = () => {
    setSessionFilters(sessionFilterDraft);
  };

  const resetSessionFilters = () => {
    const defaults = createEmptySessionFilters();
    setSessionFilterDraft(defaults);
    setSessionFilters(defaults);
  };

  const handleExportSessionReports = () => {
    if (sessionReports.length === 0) {
      setAlertModal({
        isOpen: true,
        message: "No session reports to export.",
        title: "Export Error",
      });
      return;
    }

    const headers = [
      "Lesson",
      "Student",
      "Teacher",
      "Session Date",
      "Session Start",
      "Score",
      "Next Session",
      "Remarks",
      "Progress ID",
    ];

    const rows = sessionReports.map((report) => [
      report.lesson?.title ?? "",
      formatPersonName(report.student),
      formatPersonName(report.teacher),
      formatDateOnly(report.session_date),
      formatDateTime(report.session_start),
      report.score ?? "",
      formatDateOnly(report.next_session_date),
      report.remarks ?? "",
      report.progress ? String(report.progress) : "",
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const lessonSlug = (selectedLesson?.title ?? "lesson-session")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    link.setAttribute(
      "download",
      `${lessonSlug || "lesson-session"}-reports.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openSessionReportModal = (defaults?: {
    studentId?: string | number | null;
    progressId?: string | number | null;
  }) => {
    if (!selectedLessonId) {
      return;
    }
    setEditingSessionReport(null);
    setSessionFormError(null);
    setSessionFormDefaults({
      studentId: defaults?.studentId ?? null,
      teacherId: currentTeacherId,
      lessonId: selectedLessonId,
      progressId: defaults?.progressId ?? null,
    });
    setSessionModalOpen(true);
  };

  const openSessionReportForEdit = (report: LessonSessionReport) => {
    setEditingSessionReport(report);
    setSessionFormError(null);
    setSessionFormDefaults({
      studentId: report.student?.id ?? null,
      teacherId: report.teacher?.id ?? currentTeacherId,
      lessonId: report.lesson?.id ?? selectedLessonId,
      progressId: report.progress ?? null,
    });
    setSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    setSessionModalOpen(false);
    setSessionFormSubmitting(false);
    setSessionFormError(null);
    setEditingSessionReport(null);
    setSessionFormDefaults({});
  };

  const handleSessionFormSubmit = async (values: LessonSessionReportInput) => {
    if (!selectedLessonId) {
      setSessionFormError("Select a lesson before logging a session.");
      return;
    }

    try {
      setSessionFormSubmitting(true);
      setSessionFormError(null);

      const payload: LessonSessionReportInput = {
        ...values,
      };

      const normalizedLessonId =
        sanitizeNumericValue(payload.lesson_id) ??
        sanitizeNumericValue(selectedLessonId);
      if (!normalizedLessonId) {
        setSessionFormError("The lesson could not be determined.");
        return;
      }
      payload.lesson_id = normalizedLessonId;
      const lessonIdForRefresh = normalizedLessonId;

      const normalizedStudentId = sanitizeNumericValue(payload.student_id);
      if (!normalizedStudentId) {
        setSessionFormError("Select a student for this session.");
        return;
      }
      payload.student_id = normalizedStudentId;

      let normalizedTeacherId = sanitizeNumericValue(payload.teacher_id);
      if (!normalizedTeacherId) {
        normalizedTeacherId = sanitizeNumericValue(currentTeacherId);
      }
      if (!normalizedTeacherId) {
        setSessionFormError("Select a teacher for this session.");
        return;
      }
      payload.teacher_id = normalizedTeacherId;

      const normalizedProgressId =
        sanitizeNumericValue(payload.progress_id) ??
        sanitizeNumericValue(sessionFormDefaults.progressId ?? null);
      if (normalizedProgressId) {
        payload.progress_id = normalizedProgressId;
      } else {
        delete payload.progress_id;
      }

      if (!payload.session_start) {
        setSessionFormError("Provide the start time for the session.");
        return;
      }

      if (editingSessionReport) {
        await lessonsApi.updateSessionReport(editingSessionReport.id, payload);
      } else {
        await lessonsApi.createSessionReport(payload);
      }

      closeSessionModal();
      await fetchSessionReports(lessonIdForRefresh);
      await fetchProgress(lessonIdForRefresh);
      fetchSummary();
    } catch (error) {
      setSessionFormError(extractErrorMessage(error, "Failed to save the session report."));
    } finally {
      setSessionFormSubmitting(false);
    }
  };

  const handleLogSessionFromProgress = (record: PersonLessonProgress) => {
    if (!record.person) {
      setAlertModal({
        isOpen: true,
        message:
          "This participant record is missing person details. Please refresh and try again.",
        title: "Missing Information",
      });
      return;
    }
    openSessionReportModal({
      studentId: record.person.id,
      progressId: record.id,
    });
  };

  const requestDeleteSessionReport = (report: LessonSessionReport) => {
    setSessionDeleteError(null);
    setSessionDeleteTarget(report);
  };

  const confirmDeleteSessionReport = async () => {
    if (!sessionDeleteTarget) {
      return;
    }
    try {
      setSessionDeleteLoading(true);
      setSessionDeleteError(null);
      await lessonsApi.deleteSessionReport(sessionDeleteTarget.id);
      if (selectedLessonId) {
        await fetchSessionReports(selectedLessonId);
        await fetchProgress(selectedLessonId);
        fetchSummary();
      }
      setSessionDeleteTarget(null);
    } catch (error) {
      setSessionDeleteError(extractErrorMessage(error, "Failed to delete the session report."));
    } finally {
      setSessionDeleteLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#2D3748]">
              New Converts Course
            </h1>
            <p className="text-sm text-gray-600">
              Track lesson content, version labels, and participant milestones
              across the conversion journey.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => openSessionReportModal()}
            disabled={!selectedLesson}
            className="self-start md:self-auto"
          >
            Log Session
          </Button>
        </div>

        {lessonsError && <ErrorMessage message={lessonsError} />}

        <LessonStatsCards
          summary={summary}
          visitorsAwaitingCount={summary?.unassigned_visitors ?? 0}
          loading={summaryLoading}
          error={summaryError}
        />

        <div className="mt-10 border-t border-gray-200 pt-7 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2">
            <div className="space-y-4 lg:sticky lg:top-24">
              {lessonsLoading ? (
                <Card>
                  <LoadingSpinner />
                </Card>
              ) : (
                <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 lg:pr-2">
                  <LessonList
                    lessons={lessons}
                    selectedLessonId={selectedLessonId}
                    onSelect={handleSelectLesson}
                    onEdit={openEditLesson}
                    onCreateNew={openCreateLesson}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <LessonContentTabs
              activeTab={activeContentTab}
              onTabChange={setActiveContentTab}
              disableProgress={!selectedLesson}
              disableSessions={!selectedLesson}
            />

            <div
              className={activeContentTab === "lesson" ? "space-y-6" : "hidden"}
            >
              <LessonDetailPanel
                lesson={selectedLesson}
                onEdit={openEditLesson}
              />
            </div>

            <div
              className={
                activeContentTab === "progress" ? "space-y-6" : "hidden"
              }
            >
              <MemberProgressSection
                selectedLesson={selectedLesson}
                onAssignClick={() => setAssignModalOpen(true)}
                progressSummary={progressSummary}
                progress={progress}
                progressLoading={progressLoading}
                progressError={progressError}
                progressActionError={progressActionError}
                isProgressUpdating={isProgressUpdating}
                onMarkCompleted={handleMarkCompleted}
                onUpdateStatus={handleUpdateStatus}
                onCommitmentToggleRequest={requestCommitmentToggle}
                onLogSession={handleLogSessionFromProgress}
              />
            </div>

            <div
              className={
                activeContentTab === "sessions" ? "space-y-6" : "hidden"
              }
            >
              <SessionReportsSection
                selectedLesson={selectedLesson}
                sessionReports={sessionReports}
                sessionReportsLoading={sessionReportsLoading}
                sessionReportsError={sessionReportsError}
                sessionFilterDraft={sessionFilterDraft}
                teacherChoices={teacherChoices}
                studentChoices={studentChoices}
                onFilterChange={updateSessionFilterDraft}
                onApplyFilters={applySessionFilters}
                onResetFilters={resetSessionFilters}
                onExport={handleExportSessionReports}
                onOpenSessionModal={() => openSessionReportModal()}
                onEditSession={openSessionReportForEdit}
                onRequestDelete={requestDeleteSessionReport}
                formatPersonName={formatPersonName}
                formatDateOnly={formatDateOnly}
                formatDateTime={formatDateTime}
                canLogSession={Boolean(selectedLesson)}
                canExport={sessionReports.length > 0}
              />
            </div>

            <div
              className={
                activeContentTab === "commitment" ? "space-y-6" : "hidden"
              }
            >
              <CommitmentFormSection
                commitmentSettings={commitmentSettings}
                commitmentLoading={commitmentLoading}
                commitmentError={commitmentError}
                onOpenModal={() => setCommitmentModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isLessonFormOpen}
        onClose={closeLessonForm}
        title={editingLesson ? "Edit Lesson" : "New Lesson"}
      >
        {lessonFormError && (
          <div className="mb-4">
            <ErrorMessage message={lessonFormError} />
          </div>
        )}
        <LessonForm
          lesson={editingLesson}
          submitting={lessonFormSubmitting}
          deleteDisabled={lessonDeleteLoading}
          onSubmit={handleLessonFormSubmit}
          onCancel={closeLessonForm}
          onDelete={
            editingLesson ? () => requestDeleteLesson(editingLesson) : undefined
          }
        />
      </Modal>

      <Modal
        isOpen={Boolean(commitmentConfirm)}
        onClose={() => setCommitmentConfirm(null)}
        title={
          commitmentConfirm?.nextValue
            ? "Confirm Commitment Signature"
            : "Remove Commitment Signature"
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {commitmentConfirm?.nextValue
              ? `Mark ${formatPersonName(commitmentConfirm.record.person)} as having signed the commitment form? This will add a milestone to the conversion timeline.`
              : commitmentConfirm
              ? `Remove the commitment signature for ${formatPersonName(commitmentConfirm.record.person)}? This will clear the milestone entry.`
              : ""}
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="tertiary"
            onClick={() => setCommitmentConfirm(null)}
            disabled={isProgressUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmCommitmentToggle}
            disabled={isProgressUpdating}
          >
            {isProgressUpdating ? "Updating..." : "Confirm"}
          </Button>
        </div>
      </Modal>

      <NoteInputModal
        isOpen={noteInputModal.isOpen}
        onClose={() => setNoteInputModal({ isOpen: false, record: null })}
        onConfirm={handleNoteInputConfirm}
        title="Add Note for Milestone"
        message="Add a note for this milestone (optional):"
        initialValue={noteInputModal.record?.notes ?? ""}
        loading={isProgressUpdating}
      />

      <ConfirmationModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, message: "" })}
        onConfirm={() => setAlertModal({ isOpen: false, message: "" })}
        title={alertModal.title || "Information"}
        message={alertModal.message}
        confirmText="OK"
        variant="info"
      />

      <Modal
        isOpen={isCommitmentModalOpen}
        onClose={() => {
          setCommitmentModalOpen(false);
          setCommitmentFile(null);
          setCommitmentUploadError(null);
        }}
        title="Upload Commitment Form"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a PDF version of the commitment form that students will sign
            after completing the course.
          </p>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              setCommitmentFile(event.target.files?.[0] ?? null)
            }
            className="block w-full text-sm text-gray-700"
          />
          {commitmentUploadError && (
            <ErrorMessage message={commitmentUploadError} />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="tertiary"
              onClick={() => {
                setCommitmentModalOpen(false);
                setCommitmentFile(null);
                setCommitmentUploadError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommitmentUpload}
              disabled={commitmentUploading || !commitmentFile}
            >
              {commitmentUploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(lessonDeleteTarget)}
        onClose={() => {
          if (lessonDeleteLoading) return;
          setLessonDeleteTarget(null);
          setLessonDeleteError(null);
        }}
        onConfirm={confirmDeleteLesson}
        title="Delete Lesson"
        message={
          lessonDeleteError
            ? `${lessonDeleteError} Please try again.`
            : `Are you sure you want to delete the "${lessonDeleteTarget?.title}" lesson? This action cannot be undone and will remove it from the catalog for all users.`
        }
        confirmText="Delete Lesson"
        cancelText="Cancel"
        variant="danger"
        loading={lessonDeleteLoading}
      />

      <Modal
        isOpen={isSessionModalOpen}
        onClose={closeSessionModal}
        title={
          editingSessionReport ? "Edit Lesson Session" : "Log Lesson Session"
        }
      >
        <LessonSessionReportForm
          report={editingSessionReport}
          submitting={sessionFormSubmitting}
          onSubmit={handleSessionFormSubmit}
          onCancel={closeSessionModal}
          people={people}
          lessons={lessons}
          defaultLessonId={
            sessionFormDefaults.lessonId ?? selectedLessonId ?? undefined
          }
          defaultTeacherId={
            sessionFormDefaults.teacherId ?? currentTeacherId ?? undefined
          }
          defaultStudentId={sessionFormDefaults.studentId ?? undefined}
          error={sessionFormError}
        />
      </Modal>

      <Modal
        isOpen={Boolean(sessionDeleteTarget)}
        onClose={() => setSessionDeleteTarget(null)}
        title="Delete Session Report"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete the session report for{" "}
            <span className="font-semibold text-gray-800">
              {formatPersonName(sessionDeleteTarget?.student)}
            </span>{" "}
            recorded on {formatDateTime(sessionDeleteTarget?.session_start)}?
            This action cannot be undone.
          </p>
          {sessionDeleteError && <ErrorMessage message={sessionDeleteError} />}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="tertiary"
            onClick={() => setSessionDeleteTarget(null)}
            disabled={sessionDeleteLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteSessionReport}
            disabled={sessionDeleteLoading}
          >
            {sessionDeleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isAssignModalOpen}
        onClose={closeAssignModal}
        title="Assign Lesson"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select the people who should take{" "}
            <span className="font-semibold text-gray-800">
              {selectedLesson?.title ?? "this lesson"}
            </span>
            .
          </p>

          {assignError && <ErrorMessage message={assignError} />}
          {peopleError && <ErrorMessage message={peopleError} />}

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={assignSearch}
                onChange={(event) => setAssignSearch(event.target.value)}
                placeholder="Search people by name, username, or member ID..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y divide-gray-200">
              {peopleLoading ? (
                <LoadingSpinner />
              ) : filteredPeople.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {people.length === 0
                    ? "No people available to assign."
                    : "No people match your search."}
                </div>
              ) : (
                filteredPeople.map((person) => {
                  const fullName = `${person.first_name ?? ""} ${
                    person.last_name ?? ""
                  }`.trim();
                  const displayName = fullName || person.username;

                  return (
                    <label
                      key={person.id}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedPersonIds.includes(person.id)}
                        onChange={() => togglePersonSelection(person.id)}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-[#2D3748]">
                          {displayName}
                        </span>
                        <span className="text-xs text-gray-500">
                          Role: {person.role}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="tertiary" onClick={closeAssignModal}>
              Cancel
            </Button>
            <Button onClick={handleAssignSubmit} disabled={assigning}>
              {assigning ? "Assigning..." : "Assign Selected"}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

type LessonContentTab = "lesson" | "progress" | "sessions" | "commitment";

interface LessonContentTabsProps {
  activeTab: LessonContentTab;
  onTabChange: (tab: LessonContentTab) => void;
  disableProgress?: boolean;
  disableSessions?: boolean;
  disableCommitment?: boolean;
}

function LessonContentTabs({
  activeTab,
  onTabChange,
  disableProgress,
  disableSessions,
  disableCommitment,
}: LessonContentTabsProps) {
  const tabs: Array<{
    id: LessonContentTab;
    label: string;
    disabled: boolean;
  }> = [
    { id: "lesson", label: "Lesson Content", disabled: false },
    {
      id: "progress",
      label: "Member Progress",
      disabled: Boolean(disableProgress),
    },
    {
      id: "sessions",
      label: "Session Reports",
      disabled: Boolean(disableSessions),
    },
    {
      id: "commitment",
      label: "Commitment Forms",
      disabled: Boolean(disableCommitment),
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-blue-50 p-1 shadow-inner">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!tab.disabled) {
                  onTabChange(tab.id);
                }
              }}
              disabled={tab.disabled}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[#1D4ED8] shadow-sm border border-[#2563EB]"
                  : "text-[#1E40AF] hover:text-[#1D4ED8]"
              } ${tab.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MemberProgressSectionProps {
  selectedLesson: Lesson | null;
  onAssignClick: () => void;
  progressSummary: Record<LessonProgressStatus, number>;
  progress: PersonLessonProgress[];
  progressLoading: boolean;
  progressError: string | null;
  progressActionError: string | null;
  isProgressUpdating: boolean;
  onMarkCompleted: (record: PersonLessonProgress) => void;
  onUpdateStatus: (
    record: PersonLessonProgress,
    status: LessonProgressStatus
  ) => void;
  onCommitmentToggleRequest: (record: PersonLessonProgress) => void;
  onLogSession: (record: PersonLessonProgress) => void;
}

function MemberProgressSection({
  selectedLesson,
  onAssignClick,
  progressSummary,
  progress,
  progressLoading,
  progressError,
  progressActionError,
  isProgressUpdating,
  onMarkCompleted,
  onUpdateStatus,
  onCommitmentToggleRequest,
  onLogSession,
}: MemberProgressSectionProps) {
  if (!selectedLesson) {
    return (
      <Card title="Participant Progress">
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center text-gray-500">
          Select a lesson to view assignments and milestone updates.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Participant Progress">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 sm:max-w-md">
            Assign participants and update milestones as they move through this
            lesson.
          </p>
          <Button
            variant="primary"
            onClick={onAssignClick}
            className="sm:w-auto"
          >
            Assign Lesson
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label="Assigned"
            count={progressSummary.ASSIGNED}
            colorClass="bg-gray-100 text-gray-700"
          />
          <StatusBadge
            label="In Progress"
            count={progressSummary.IN_PROGRESS}
            colorClass="bg-blue-100 text-blue-700"
          />
          <StatusBadge
            label="Completed"
            count={progressSummary.COMPLETED}
            colorClass="bg-green-100 text-green-700"
          />
          <StatusBadge
            label="Skipped"
            count={progressSummary.SKIPPED}
            colorClass="bg-yellow-100 text-yellow-700"
          />
        </div>

        {progressActionError && <ErrorMessage message={progressActionError} />}

        <div className="-mx-6 overflow-x-auto">
          <div className="min-w-[720px] px-6">
            <LessonProgressTable
              progress={progress}
              loading={progressLoading}
              error={progressError}
              onMarkCompleted={onMarkCompleted}
              onUpdateStatus={onUpdateStatus}
              onCommitmentToggleRequest={onCommitmentToggleRequest}
              isUpdating={isProgressUpdating}
              onLogSession={onLogSession}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

interface SessionReportsSectionProps {
  selectedLesson: Lesson | null;
  sessionReports: LessonSessionReport[];
  sessionReportsLoading: boolean;
  sessionReportsError: string | null;
  sessionFilterDraft: SessionFilterValues;
  teacherChoices: LessonPersonLike[];
  studentChoices: LessonPersonLike[];
  onFilterChange: (field: keyof SessionFilterValues, value: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onExport: () => void;
  onOpenSessionModal: () => void;
  onEditSession: (report: LessonSessionReport) => void;
  onRequestDelete: (report: LessonSessionReport) => void;
  formatPersonName: (person?: LessonPersonLike | null) => string;
  formatDateOnly: (value?: string | null) => string;
  formatDateTime: (value?: string | null) => string;
  canLogSession: boolean;
  canExport: boolean;
}

const DEFAULT_SESSION_ITEMS_PER_PAGE = 10;

function SessionReportsSection({
  selectedLesson,
  sessionReports,
  sessionReportsLoading,
  sessionReportsError,
  sessionFilterDraft,
  teacherChoices,
  studentChoices,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  onExport,
  onOpenSessionModal,
  onEditSession,
  onRequestDelete,
  formatPersonName,
  formatDateOnly,
  formatDateTime,
  canLogSession,
  canExport,
}: SessionReportsSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_SESSION_ITEMS_PER_PAGE);

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sessionReports.slice(startIndex, endIndex);
  }, [sessionReports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sessionReports.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (!selectedLesson) {
    return (
      <Card title="Session Reports">
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center text-gray-500">
          Select a lesson to review and log coaching sessions.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Session Reports">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-gray-500 sm:max-w-lg">
            Log 1-on-1 lesson sessions to capture coaching notes beyond
            milestone updates and export them for follow-up.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={onExport}
              disabled={!canExport}
              className="text-sm !py-1.5 !px-3"
            >
              Download CSV
            </Button>
            <Button
              variant="primary"
              onClick={onOpenSessionModal}
              disabled={!canLogSession}
              className="text-sm !py-1.5 !px-3"
            >
              Log Session
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Teacher
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sessionFilterDraft.teacherId}
                onChange={(event) =>
                  onFilterChange("teacherId", event.target.value)
                }
              >
                <option value="">All teachers</option>
                {teacherChoices.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPersonName(person)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Student
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sessionFilterDraft.studentId}
                onChange={(event) =>
                  onFilterChange("studentId", event.target.value)
                }
              >
                <option value="">All students</option>
                {studentChoices.map((person) => (
                  <option key={person.id} value={person.id}>
                    {formatPersonName(person)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date From
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sessionFilterDraft.dateFrom}
                onChange={(event) =>
                  onFilterChange("dateFrom", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date To
              </label>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sessionFilterDraft.dateTo}
                onChange={(event) =>
                  onFilterChange("dateTo", event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="tertiary" onClick={onResetFilters}>
              Reset Filters
            </Button>
            <Button variant="secondary" onClick={onApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>

        {sessionReportsError && <ErrorMessage message={sessionReportsError} />}

        {sessionReportsLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : sessionReports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-gray-500">
            No session reports recorded for this lesson yet.
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedReports.map((report) => (
              <div
                key={report.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#2D3748]">
                      {formatPersonName(report.student)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Teacher: {formatPersonName(report.teacher)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Lesson:{" "}
                      {report.lesson?.title ??
                        selectedLesson?.title ??
                        "Unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className="text-xs font-medium text-gray-600">
                      {formatDateTime(report.session_start)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="tertiary"
                        className="text-xs"
                        onClick={() => onEditSession(report)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        className="text-xs"
                        onClick={() => onRequestDelete(report)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-4">
                  <div>
                    <span className="block text-xs font-semibold uppercase text-gray-500">
                      Score / Rating
                    </span>
                    <span>{report.score || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase text-gray-500">
                      Session Date
                    </span>
                    <span>{formatDateOnly(report.session_date)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase text-gray-500">
                      Next Session
                    </span>
                    <span>{formatDateOnly(report.next_session_date)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase text-gray-500">
                      Linked Progress
                    </span>
                    <span>
                      {report.progress ? `Record #${report.progress}` : "—"}
                    </span>
                  </div>
                </div>
                {report.remarks && (
                  <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">
                    {report.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sessionReports.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            showItemsPerPage={true}
          />
        )}
      </div>
    </Card>
  );
}

interface CommitmentFormSectionProps {
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  onOpenModal: () => void;
}

function CommitmentFormSection({
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  onOpenModal,
}: CommitmentFormSectionProps) {
  const commitmentUrl = commitmentSettings?.commitment_form_url ?? "";
  const hasCommitmentForm = Boolean(commitmentUrl && !commitmentLoading);

  return (
    <Card title="Commitment Forms">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Share and update the latest commitment PDF for teachers to download
          and mark participants as signed.
        </p>

        {commitmentError && <ErrorMessage message={commitmentError} />}

        {commitmentLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {hasCommitmentForm ? (
              <a href={commitmentUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="sm:w-auto text-sm">
                  Download Current PDF
                </Button>
              </a>
            ) : (
              <span className="text-sm text-gray-500">
                No commitment form uploaded yet.
              </span>
            )}
            <Button onClick={onOpenModal} className="sm:w-auto text-sm">
              {hasCommitmentForm
                ? "Replace Commitment Form"
                : "Upload Commitment Form"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

interface StatusBadgeProps {
  label: string;
  count: number;
  colorClass: string;
}

function StatusBadge({ label, count, colorClass }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${colorClass}`}
    >
      {label}: {count}
    </span>
  );
}

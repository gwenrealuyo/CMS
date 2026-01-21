"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  createEmptySessionFilters,
  extractErrorMessage,
  sanitizeNumericValue,
  escapeCsvValue,
  SessionFilterValues,
  LessonPersonLike,
  groupProgressByPerson,
} from "@/src/lib/lessonsUtils";
import { PersonProgressSummary, LessonPersonSummary } from "@/src/types/lesson";
import { LessonFormValues } from "@/src/components/lessons/LessonForm";
import { LessonContentTab } from "@/src/components/lessons/LessonContentTabs";
import LessonsPageView from "./LessonsPageView";

export default function LessonsPageContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const [progress, setProgress] = useState<PersonLessonProgress[]>([]);
  const [allProgress, setAllProgress] = useState<PersonLessonProgress[]>([]);
  const [allProgressLoading, setAllProgressLoading] = useState(false);
  const [allProgressError, setAllProgressError] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressActionError, setProgressActionError] = useState<string | null>(
    null
  );
  const [isProgressUpdating, setIsProgressUpdating] = useState(false);
  const [progressFilterLessonId, setProgressFilterLessonId] = useState<
    number | null
  >(null);

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

  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [personProgressModal, setPersonProgressModal] = useState<{
    isOpen: boolean;
    person: LessonPersonSummary | null;
  }>({
    isOpen: false,
    person: null,
  });

  const [activeContentTab, setActiveContentTab] =
    useState<LessonContentTab>("progress");

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
  const [autoOpenSessionReport, setAutoOpenSessionReport] = useState(false);
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
        formatPersonName(first).localeCompare(formatPersonName(second))
      );
  }, [people]);

  const studentChoices = useMemo(() => {
    return [...people].sort((first, second) =>
      formatPersonName(first).localeCompare(formatPersonName(second))
    );
  }, [people]);

  // Get active latest lessons for grouping
  const activeLatestLessons = useMemo(() => {
    return lessons.filter((lesson) => lesson.is_latest && lesson.is_active);
  }, [lessons]);

  // Group progress by person
  const groupedProgress = useMemo(() => {
    if (allProgressLoading || allProgress.length === 0) {
      return [];
    }
    return groupProgressByPerson(allProgress, lessons);
  }, [allProgress, lessons, allProgressLoading]);

  // Filter grouped progress by lesson if filter is set
  const filteredGroupedProgress = useMemo(() => {
    if (!progressFilterLessonId) {
      return groupedProgress;
    }
    return groupedProgress.filter((summary) =>
      summary.allProgress.some((p) => p.lesson.id === progressFilterLessonId)
    );
  }, [groupedProgress, progressFilterLessonId]);

  useEffect(() => {
    fetchLessons();
    fetchSummary();
    fetchCommitmentForm();
    fetchAllProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (action === "log-session") {
      setActiveContentTab("sessions");
      setAutoOpenSessionReport(true);
      router.replace(pathname);
    }
  }, [action, pathname, router]);

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
      setSummaryError(
        extractErrorMessage(error, "Failed to load lesson summary.")
      );
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
      setSessionReportsError(
        extractErrorMessage(error, "Failed to load session reports.")
      );
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
      setCommitmentError(
        extractErrorMessage(error, "Failed to load commitment form.")
      );
    } finally {
      setCommitmentLoading(false);
    }
  };

  const fetchAllProgress = async () => {
    try {
      setAllProgressLoading(true);
      const response = await lessonsApi.getProgress();
      setAllProgress(response.data);
      setAllProgressError(null);
    } catch (error) {
      setAllProgressError(
        extractErrorMessage(error, "Failed to load all progress.")
      );
    } finally {
      setAllProgressLoading(false);
    }
  };

  const fetchProgress = async (lessonId: number) => {
    try {
      setProgressLoading(true);
      const response = await lessonsApi.getProgress({ lesson: lessonId });
      setProgress(response.data);
      setProgressError(null);
    } catch (error) {
      setProgressError(
        extractErrorMessage(error, "Failed to load lesson progress.")
      );
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
      setLessonDeleteError(
        extractErrorMessage(error, "Failed to delete the lesson.")
      );
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
      setLessonFormError(
        extractErrorMessage(error, "There was a problem saving the lesson.")
      );
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
      setProgressActionError(
        extractErrorMessage(error, "Failed to mark the lesson as completed.")
      );
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
      setProgressActionError(
        extractErrorMessage(error, "Failed to update the lesson status.")
      );
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
      setProgressActionError(
        extractErrorMessage(error, "Failed to update commitment status.")
      );
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
      setCommitmentUploadError(
        extractErrorMessage(error, "Failed to upload the commitment form.")
      );
    } finally {
      setCommitmentUploading(false);
    }
  };

  const handleAssignLessons = async (
    personIds: string[],
    lessonIds: number[]
  ) => {
    if (personIds.length === 0) {
      setAssignError("Choose at least one person to assign.");
      return;
    }
    if (lessonIds.length === 0) {
      setAssignError("Choose at least one lesson to assign.");
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      const numericPersonIds = personIds
        .map((id) => Number(id))
        .filter((value) => !Number.isNaN(value));

      // Assign each lesson to all selected people
      for (const lessonId of lessonIds) {
        await lessonsApi.assign({
          lesson_id: lessonId,
          person_ids: numericPersonIds,
        });
      }

      // Refresh all progress and summary
      await fetchAllProgress();
      if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      fetchSummary();
    } catch (error) {
      setAssignError(extractErrorMessage(error, "Failed to assign lessons."));
    } finally {
      setAssigning(false);
    }
  };

  const handleProgressFilterChange = (lessonId: number | null) => {
    setProgressFilterLessonId(lessonId);
  };

  const openPersonProgressModal = (person: LessonPersonSummary) => {
    setPersonProgressModal({
      isOpen: true,
      person,
    });
  };

  const closePersonProgressModal = () => {
    setPersonProgressModal({
      isOpen: false,
      person: null,
    });
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

  const openSessionReportModal = useCallback((defaults?: {
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
  }, [currentTeacherId, selectedLessonId]);

  useEffect(() => {
    if (!autoOpenSessionReport) {
      return;
    }
    if (!selectedLessonId) {
      return;
    }
    openSessionReportModal();
    setAutoOpenSessionReport(false);
  }, [autoOpenSessionReport, openSessionReportModal, selectedLessonId]);

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
      setSessionFormError(
        extractErrorMessage(error, "Failed to save the session report.")
      );
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
      setSessionDeleteError(
        extractErrorMessage(error, "Failed to delete the session report.")
      );
    } finally {
      setSessionDeleteLoading(false);
    }
  };

  return (
    <LessonsPageView
      // Lessons state
      lessons={lessons}
      lessonsLoading={lessonsLoading}
      lessonsError={lessonsError}
      selectedLessonId={selectedLessonId}
      selectedLesson={selectedLesson}
      onSelectLesson={handleSelectLesson}
      // Progress state
      progress={progress}
      progressLoading={progressLoading}
      progressError={progressError}
      progressActionError={progressActionError}
      isProgressUpdating={isProgressUpdating}
      progressSummary={progressSummary}
      // Summary state
      summary={summary}
      summaryLoading={summaryLoading}
      summaryError={summaryError}
      // Commitment state
      commitmentSettings={commitmentSettings}
      commitmentLoading={commitmentLoading}
      commitmentError={commitmentError}
      isCommitmentModalOpen={isCommitmentModalOpen}
      commitmentFile={commitmentFile}
      commitmentUploading={commitmentUploading}
      commitmentUploadError={commitmentUploadError}
      commitmentConfirm={commitmentConfirm}
      // Note input modal
      noteInputModal={noteInputModal}
      // Alert modal
      alertModal={alertModal}
      // Lesson form state
      isLessonFormOpen={isLessonFormOpen}
      lessonFormSubmitting={lessonFormSubmitting}
      lessonFormError={lessonFormError}
      editingLesson={editingLesson}
      // Assign state
      assigning={assigning}
      assignError={assignError}
      peopleLoading={peopleLoading}
      peopleError={peopleError}
      // Grouped progress state
      allProgress={allProgress}
      allProgressLoading={allProgressLoading}
      allProgressError={allProgressError}
      groupedProgress={filteredGroupedProgress}
      progressFilterLessonId={progressFilterLessonId}
      activeLatestLessons={activeLatestLessons}
      // Person progress modal
      personProgressModal={personProgressModal}
      // Content tab state
      activeContentTab={activeContentTab}
      // Session reports state
      sessionReports={sessionReports}
      sessionReportsLoading={sessionReportsLoading}
      sessionReportsError={sessionReportsError}
      isSessionModalOpen={isSessionModalOpen}
      sessionFormSubmitting={sessionFormSubmitting}
      sessionFormError={sessionFormError}
      editingSessionReport={editingSessionReport}
      sessionDeleteTarget={sessionDeleteTarget}
      sessionDeleteLoading={sessionDeleteLoading}
      sessionDeleteError={sessionDeleteError}
      sessionFormDefaults={sessionFormDefaults}
      sessionFilters={sessionFilters}
      sessionFilterDraft={sessionFilterDraft}
      // Delete lesson state
      lessonDeleteTarget={lessonDeleteTarget}
      lessonDeleteLoading={lessonDeleteLoading}
      lessonDeleteError={lessonDeleteError}
      // People data
      people={people}
      teacherChoices={teacherChoices}
      studentChoices={studentChoices}
      currentTeacherId={currentTeacherId}
      // Format functions
      formatDateOnly={formatDateOnly}
      formatDateTime={formatDateTime}
      // Handlers
      onOpenCreateLesson={openCreateLesson}
      onOpenEditLesson={openEditLesson}
      onRequestDeleteLesson={requestDeleteLesson}
      onConfirmDeleteLesson={confirmDeleteLesson}
      onCloseLessonForm={closeLessonForm}
      onLessonFormSubmit={handleLessonFormSubmit}
      onMarkCompleted={handleMarkCompleted}
      onNoteInputConfirm={handleNoteInputConfirm}
      onUpdateStatus={handleUpdateStatus}
      onRequestCommitmentToggle={requestCommitmentToggle}
      onConfirmCommitmentToggle={confirmCommitmentToggle}
      onOpenCommitmentModal={() => setCommitmentModalOpen(true)}
      onCloseCommitmentModal={() => {
        setCommitmentModalOpen(false);
        setCommitmentFile(null);
        setCommitmentUploadError(null);
      }}
      onCommitmentUpload={handleCommitmentUpload}
      onSetCommitmentFile={(file) => setCommitmentFile(file)}
      onCloseNoteInputModal={() =>
        setNoteInputModal({ isOpen: false, record: null })
      }
      onCloseAlertModal={() => setAlertModal({ isOpen: false, message: "" })}
      onSetCommitmentConfirm={(confirm) => setCommitmentConfirm(confirm)}
      onAssignLessons={handleAssignLessons}
      onProgressFilterChange={handleProgressFilterChange}
      onOpenPersonProgressModal={openPersonProgressModal}
      onClosePersonProgressModal={closePersonProgressModal}
      onSetActiveContentTab={setActiveContentTab}
      onUpdateSessionFilterDraft={updateSessionFilterDraft}
      onApplySessionFilters={applySessionFilters}
      onResetSessionFilters={resetSessionFilters}
      onExportSessionReports={handleExportSessionReports}
      onOpenSessionReportModal={() => openSessionReportModal()}
      onOpenSessionReportForEdit={openSessionReportForEdit}
      onCloseSessionModal={closeSessionModal}
      onSessionFormSubmit={handleSessionFormSubmit}
      onLogSessionFromProgress={handleLogSessionFromProgress}
      onRequestDeleteSessionReport={requestDeleteSessionReport}
      onConfirmDeleteSessionReport={confirmDeleteSessionReport}
      onSetSessionDeleteTarget={(target) => setSessionDeleteTarget(target)}
      onSetLessonDeleteTarget={(target) => setLessonDeleteTarget(target)}
      onSetLessonDeleteError={(error) => setLessonDeleteError(error)}
    />
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { branchesApi, lessonsApi } from "@/src/lib/api";
import { canChangeLessonsBranchFilter as canChangeLessonsBranchFilterForUser } from "@/src/lib/lessonsBranchFilter";
import {
  Lesson,
  LessonCommitmentSettings,
  LessonProgressStatus,
  LessonProgressSummary,
  LessonSessionReport,
  LessonSessionReportInput,
  LessonStudentEnrollment,
  PersonLessonProgress,
} from "@/src/types/lesson";
import { usePeople } from "@/src/hooks/usePeople";
import { formatPersonName } from "@/src/lib/name";
import { formatDisplayDate } from "@/src/lib/date";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  createDefaultSessionFilters,
  extractErrorMessage,
  sanitizeNumericValue,
  escapeCsvValue,
  SessionFilterValues,
  LessonPersonLike,
  groupProgressByPerson,
  buildStudentTeacherMapFromEnrollments,
  enrollmentByStudentId,
  isLessonTeacherCandidate,
} from "@/src/lib/lessonsUtils";
import { formatSessionTopicLabel } from "@/src/lib/sessionTopic";
import { PersonProgressSummary, LessonPersonSummary } from "@/src/types/lesson";
import { LessonFormValues } from "@/src/components/lessons/LessonForm";
import { LessonContentTab } from "@/src/components/lessons/LessonContentTabs";
import LessonsPageView from "./LessonsPageView";

type ProgressSortField =
  | "person"
  | "teacher"
  | "previousLesson"
  | "progress"
  | "nextLesson"
  | "status";
type ProgressStatusFilter = "ALL" | LessonProgressStatus;

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
  const [progressSearchQuery, setProgressSearchQuery] = useState("");
  const [progressStatusFilter, setProgressStatusFilter] =
    useState<ProgressStatusFilter>("ALL");
  const [progressSortField, setProgressSortField] =
    useState<ProgressSortField>("person");
  const [progressSortDirection, setProgressSortDirection] = useState<
    "asc" | "desc"
  >("asc");

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
    enrollment: LessonStudentEnrollment;
    person: LessonPersonSummary | null;
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
  const [enrollments, setEnrollments] = useState<LessonStudentEnrollment[]>([]);
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
  const [sessionFilters, setSessionFilters] = useState(
    createDefaultSessionFilters
  );
  const [sessionFilterDraft, setSessionFilterDraft] = useState(
    createDefaultSessionFilters
  );
  const [sessionYearOptions, setSessionYearOptions] = useState<string[]>([
    String(new Date().getFullYear()),
  ]);

  const { people, loading: peopleLoading, error: peopleError } = usePeople();
  const { user, isSeniorCoordinator } = useAuth();

  const lessonsBranchCanChangeFilter = useMemo(
    () => canChangeLessonsBranchFilterForUser(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const lessonsBranchUserIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setSelectedBranchId("");
      lessonsBranchUserIdRef.current = undefined;
      return;
    }
    if (lessonsBranchUserIdRef.current !== user.id) {
      lessonsBranchUserIdRef.current = user.id;
      setSelectedBranchId(
        user.branch != null && user.branch !== undefined
          ? String(user.branch)
          : "",
      );
      return;
    }
    if (user.branch != null && user.branch !== undefined) {
      setSelectedBranchId((previous) =>
        previous === "" ? String(user.branch) : previous,
      );
    }
  }, [user]);

  useEffect(() => {
    if (!lessonsBranchCanChangeFilter) {
      setBranchPickerOptions([]);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .getAll({ is_active: true })
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setBranchPickerOptions(
          rows.map((branch) => ({
            value: String(branch.id),
            label: branch.name,
          })),
        );
      })
      .catch((error) => {
        console.error("Failed to load branches", error);
        if (!cancelled) setBranchPickerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonsBranchCanChangeFilter]);

  const lessonsBranchEditableOptions = useMemo(
    () => [{ value: "", label: "All branches" }, ...branchPickerOptions],
    [branchPickerOptions],
  );

  const lessonsBranchFilterLabel = useMemo(() => {
    if (!selectedBranchId) return "All branches";
    if (
      user?.branch_name &&
      user.branch != null &&
      String(user.branch) === selectedBranchId
    ) {
      return user.branch_name;
    }
    const match = branchPickerOptions.find(
      (option) => option.value === selectedBranchId,
    );
    return match?.label ?? `Branch #${selectedBranchId}`;
  }, [
    selectedBranchId,
    user?.branch,
    user?.branch_name,
    branchPickerOptions,
  ]);

  const lessonsBranchReadonlyOptions = useMemo(() => {
    if (selectedBranchId) {
      return [{ value: selectedBranchId, label: lessonsBranchFilterLabel }];
    }
    return [{ value: "", label: "No branch" }];
  }, [selectedBranchId, lessonsBranchFilterLabel]);

  const branchApiParams = useMemo(
    () => (selectedBranchId ? { branch_id: selectedBranchId } : {}),
    [selectedBranchId],
  );

  const peopleInBranchScope = useMemo(() => {
    if (!selectedBranchId) {
      return people;
    }
    return people.filter(
      (person) =>
        person.branch != null && String(person.branch) === selectedBranchId,
    );
  }, [people, selectedBranchId]);

  const sessionLoggedInTeacherId = useMemo(() => {
    if (!user?.id || !isLessonTeacherCandidate(user)) {
      return null;
    }
    return String(user.id);
  }, [user]);

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
    const formatted = formatDisplayDate(value);
    return formatted ?? value;
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
    return [...peopleInBranchScope]
      .filter((person) => isLessonTeacherCandidate(person))
      .sort((first, second) =>
        formatPersonName(first).localeCompare(formatPersonName(second))
      );
  }, [peopleInBranchScope]);

  const studentChoices = useMemo(() => {
    return [...peopleInBranchScope]
      .filter(isSelectablePerson)
      .sort((first, second) =>
      formatPersonName(first).localeCompare(formatPersonName(second))
      );
  }, [peopleInBranchScope]);

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

  const nextLessonIdByStudent = useMemo(() => {
    const map = new Map<number, number>();
    groupedProgress.forEach((summary) => {
      if (summary.person?.id && summary.nextLesson?.id) {
        map.set(summary.person.id, summary.nextLesson.id);
      }
    });
    return map;
  }, [groupedProgress]);

  const studentTeacherById = useMemo(
    () => buildStudentTeacherMapFromEnrollments(enrollments),
    [enrollments],
  );

  const enrollmentByStudent = useMemo(
    () => enrollmentByStudentId(enrollments),
    [enrollments],
  );

  const assignedStudentIds = useMemo(() => {
    const ids = new Set<number>();
    allProgress.forEach((record) => {
      if (record.person?.id != null) {
        ids.add(record.person.id);
      }
    });
    return ids;
  }, [allProgress]);

  const getLifecycleStatus = useCallback(
    (summary: PersonProgressSummary): LessonProgressStatus | "ASSIGNED" => {
      if (summary.totalLessons <= 0 || summary.completedCount <= 0) {
        return "ASSIGNED";
      }
      if (summary.completedCount >= summary.totalLessons) {
        return "COMPLETED";
      }
      return "IN_PROGRESS";
    },
    []
  );

  const getStatusForSort = useCallback(
    (summary: PersonProgressSummary): LessonProgressStatus | "ASSIGNED" => {
      return getLifecycleStatus(summary);
    },
    [getLifecycleStatus]
  );

  const displayedGroupedProgress = useMemo(() => {
    const normalizedQuery = progressSearchQuery.trim().toLowerCase();
    const statusRank: Record<LessonProgressStatus | "ASSIGNED", number> = {
      SKIPPED: 0,
      ASSIGNED: 1,
      IN_PROGRESS: 2,
      COMPLETED: 3,
    };

    const filtered = groupedProgress.filter((summary) => {
      if (
        progressFilterLessonId &&
        summary.nextLesson?.id !== progressFilterLessonId
      ) {
        return false;
      }

      if (progressStatusFilter !== "ALL") {
        if (progressStatusFilter === "SKIPPED") {
          if (!summary.allProgress.some((record) => record.status === "SKIPPED")) {
            return false;
          }
        } else if (getLifecycleStatus(summary) !== progressStatusFilter) {
          return false;
        }
      }

      if (!normalizedQuery) {
        return true;
      }

      const fullName = formatPersonName(summary.person).toLowerCase();
      const memberId = (summary.person.member_id || "").toLowerCase();
      return fullName.includes(normalizedQuery) || memberId.includes(normalizedQuery);
    });

    return [...filtered].sort((first, second) => {
      const direction = progressSortDirection === "asc" ? 1 : -1;
      switch (progressSortField) {
        case "person":
          return (
            formatPersonName(first.person).localeCompare(
              formatPersonName(second.person)
            ) * direction
          );
        case "teacher": {
          const firstTeacher = studentTeacherById.get(first.person.id);
          const secondTeacher = studentTeacherById.get(second.person.id);
          const firstName = firstTeacher
            ? formatPersonName(firstTeacher)
            : "";
          const secondName = secondTeacher
            ? formatPersonName(secondTeacher)
            : "";
          return firstName.localeCompare(secondName) * direction;
        }
        case "previousLesson": {
          const firstOrder = first.previousLesson?.order ?? Number.POSITIVE_INFINITY;
          const secondOrder = second.previousLesson?.order ?? Number.POSITIVE_INFINITY;
          if (firstOrder !== secondOrder) {
            return (firstOrder - secondOrder) * direction;
          }
          return (
            (first.previousLesson?.title || "").localeCompare(
              second.previousLesson?.title || ""
            ) * direction
          );
        }
        case "progress":
          if (first.progressPercentage !== second.progressPercentage) {
            return (first.progressPercentage - second.progressPercentage) * direction;
          }
          return (first.completedCount - second.completedCount) * direction;
        case "nextLesson": {
          const firstOrder = first.nextLesson?.order ?? Number.POSITIVE_INFINITY;
          const secondOrder = second.nextLesson?.order ?? Number.POSITIVE_INFINITY;
          if (firstOrder !== secondOrder) {
            return (firstOrder - secondOrder) * direction;
          }
          return (
            (first.nextLesson?.title || "").localeCompare(
              second.nextLesson?.title || ""
            ) * direction
          );
        }
        case "status":
          return (
            (statusRank[getStatusForSort(first)] -
              statusRank[getStatusForSort(second)]) *
            direction
          );
        default:
          return 0;
      }
    });
  }, [
    getLifecycleStatus,
    getStatusForSort,
    groupedProgress,
    progressFilterLessonId,
    progressSearchQuery,
    progressSortDirection,
    progressSortField,
    progressStatusFilter,
    studentTeacherById,
  ]);

  const ongoingStudentsCount = useMemo(() => {
    return groupedProgress.filter((summary) => {
      if (summary.totalLessons <= 0) {
        return false;
      }
      return summary.completedCount < summary.totalLessons;
    }).length;
  }, [groupedProgress]);

  useEffect(() => {
    fetchLessons();
    fetchSummary();
    fetchCommitmentForm();
    fetchAllProgress();
    fetchEnrollments();
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
    } else {
      setProgress([]);
    }
  }, [selectedLessonId]);

  useEffect(() => {
    if (activeContentTab !== "sessions") {
      return;
    }
    fetchSessionReports(sessionFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContentTab, sessionFilters]);

  useEffect(() => {
    fetchSummary();
    fetchAllProgress();
    fetchEnrollments();
    if (activeContentTab === "sessions") {
      fetchSessionReports(sessionFilters);
    }
    if (selectedLessonId) {
      fetchProgress(selectedLessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

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
      const response = await lessonsApi.summary({
        include_superseded: true,
        year: new Date().getFullYear(),
        ...branchApiParams,
      });
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
    filtersOverride?: SessionFilterValues
  ) => {
    try {
      setSessionReportsLoading(true);
      const activeFilters = filtersOverride ?? sessionFilters;
      const params: {
        lesson?: number;
        teacher?: number;
        student?: number;
        date_from?: string;
        date_to?: string;
      } = {};

      const lessonValue = sanitizeNumericValue(activeFilters.lessonId);
      if (lessonValue) {
        params.lesson = lessonValue;
      }

      const teacherValue = sanitizeNumericValue(activeFilters.teacherId);
      if (teacherValue) {
        params.teacher = teacherValue;
      }

      const studentValue = sanitizeNumericValue(activeFilters.studentId);
      if (studentValue) {
        params.student = studentValue;
      }

      const monthValue = sanitizeNumericValue(activeFilters.month);
      const yearValue = sanitizeNumericValue(activeFilters.year);
      if (
        yearValue &&
        monthValue &&
        monthValue >= 1 &&
        monthValue <= 12
      ) {
        const start = new Date(yearValue, monthValue - 1, 1);
        const end = new Date(yearValue, monthValue, 0);
        params.date_from = start.toISOString().slice(0, 10);
        params.date_to = end.toISOString().slice(0, 10);
      } else if (yearValue) {
        const start = new Date(yearValue, 0, 1);
        const end = new Date(yearValue, 11, 31);
        params.date_from = start.toISOString().slice(0, 10);
        params.date_to = end.toISOString().slice(0, 10);
      }

      const response = await lessonsApi.listSessionReports({
        ...params,
        ...branchApiParams,
      });
      const sorted = [...response.data].sort((first, second) => {
        const firstTime = new Date(first.session_start).getTime();
        const secondTime = new Date(second.session_start).getTime();
        return secondTime - firstTime;
      });
      const yearsFromReports = Array.from(
        new Set(
          sorted
            .map((report) => {
              const source = report.session_start || report.session_date;
              const date = source ? new Date(source) : null;
              if (!date || Number.isNaN(date.getTime())) {
                return null;
              }
              return String(date.getFullYear());
            })
            .filter((year): year is string => Boolean(year))
        )
      );
      setSessionYearOptions((previous) => {
        const merged = new Set([
          ...previous,
          ...yearsFromReports,
          activeFilters.year,
          String(new Date().getFullYear()),
        ]);
        return Array.from(merged)
          .filter(Boolean)
          .sort((a, b) => Number(b) - Number(a));
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
      const response = await lessonsApi.getProgress(branchApiParams);
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

  const fetchEnrollments = async () => {
    try {
      const response = await lessonsApi.listEnrollments(branchApiParams);
      setEnrollments(response.data);
    } catch {
      setEnrollments([]);
    }
  };

  const fetchProgress = async (lessonId: number) => {
    try {
      setProgressLoading(true);
      const response = await lessonsApi.getProgress({
        lesson: lessonId,
        ...branchApiParams,
      });
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

  const requestCommitmentToggle = (
    enrollment: LessonStudentEnrollment,
    person: LessonPersonSummary | null
  ) => {
    if (isProgressUpdating) return;
    setCommitmentConfirm({
      enrollment,
      person,
      nextValue: !enrollment.commitment_signed,
    });
  };

  const confirmCommitmentToggle = async () => {
    if (!commitmentConfirm) return;
    const { enrollment, nextValue } = commitmentConfirm;
    try {
      setIsProgressUpdating(true);
      setProgressActionError(null);
      const response = await lessonsApi.setEnrollmentCommitment(enrollment.id, {
        commitment_signed: nextValue,
      });
      setEnrollments((previous) =>
        previous.map((entry) => (entry.id === response.data.id ? response.data : entry))
      );
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
    lessonIds: number[],
    teacherId: string
  ) => {
    if (personIds.length === 0) {
      setAssignError("Choose at least one person to assign.");
      return;
    }
    if (lessonIds.length === 0) {
      setAssignError("Choose at least one lesson to assign.");
      return;
    }
    const numericTeacherId = Number(teacherId);
    const needsTeacher = personIds.some(
      (personId) => !enrollmentByStudent.has(Number(personId))
    );
    if (needsTeacher && Number.isNaN(numericTeacherId)) {
      setAssignError("Select a teacher for students without one assigned.");
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      const numericPersonIds = personIds
        .map((id) => Number(id))
        .filter((value) => !Number.isNaN(value));

      const assignPayload: {
        lesson_id: number;
        person_ids: number[];
        teacher_id?: number;
      } = {
        lesson_id: 0,
        person_ids: numericPersonIds,
      };
      if (needsTeacher && !Number.isNaN(numericTeacherId)) {
        assignPayload.teacher_id = numericTeacherId;
      }

      for (const lessonId of lessonIds) {
        await lessonsApi.assign({
          ...assignPayload,
          lesson_id: lessonId,
        });
      }

      await fetchEnrollments();
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

  const handleProgressSearchQueryChange = (value: string) => {
    setProgressSearchQuery(value);
  };

  const handleProgressStatusFilterChange = (value: ProgressStatusFilter) => {
    setProgressStatusFilter(value);
  };

  const handleResetProgressFilters = () => {
    setProgressFilterLessonId(null);
    setProgressStatusFilter("ALL");
    setProgressSearchQuery("");
  };

  const handleProgressSortChange = (field: ProgressSortField) => {
    if (progressSortField === field) {
      setProgressSortDirection((previous) =>
        previous === "asc" ? "desc" : "asc"
      );
      return;
    }
    setProgressSortField(field);
    setProgressSortDirection("asc");
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
    setSessionFilterDraft((previous) => {
      const next = { ...previous, [field]: value };
      setSessionFilters(next);
      return next;
    });
  };

  const resetSessionFilters = () => {
    const defaults = createDefaultSessionFilters();
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
      "Scheduled Session Date",
      "Actual Session Date",
      "Score",
      "Next Scheduled Session Date",
      "Remarks",
      "Progress ID",
    ];

    const rows = sessionReports.map((report) => [
      formatSessionTopicLabel(
        report.session_type,
        report.pre_lesson_kind,
        report.lesson?.title ?? null
      ),
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
    link.setAttribute("download", "session-reports.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openSessionReportModal = useCallback((defaults?: {
    studentId?: string | number | null;
    progressId?: string | number | null;
  }) => {
    const studentNumericId =
      defaults?.studentId != null ? Number(defaults.studentId) : null;
    const enrollmentTeacherId =
      studentNumericId != null && !Number.isNaN(studentNumericId)
        ? enrollmentByStudent.get(studentNumericId)?.teacher?.id ?? null
        : null;
    const suggestedLessonId =
      studentNumericId != null && !Number.isNaN(studentNumericId)
        ? nextLessonIdByStudent.get(studentNumericId) ?? selectedLessonId
        : selectedLessonId;
    setEditingSessionReport(null);
    setSessionFormError(null);
    setSessionFormDefaults({
      studentId: defaults?.studentId ?? null,
      teacherId: defaults?.studentId
        ? enrollmentTeacherId != null
          ? enrollmentTeacherId.toString()
          : null
        : sessionLoggedInTeacherId,
      lessonId: suggestedLessonId ?? null,
      progressId: defaults?.progressId ?? null,
    });
    setSessionModalOpen(true);
  }, [sessionLoggedInTeacherId, enrollmentByStudent, selectedLessonId, nextLessonIdByStudent]);

  useEffect(() => {
    if (!autoOpenSessionReport) {
      return;
    }
    openSessionReportModal();
    setAutoOpenSessionReport(false);
  }, [autoOpenSessionReport, openSessionReportModal]);

  const openSessionReportForEdit = (report: LessonSessionReport) => {
    setEditingSessionReport(report);
    setSessionFormError(null);
    setSessionFormDefaults({
      studentId: report.student?.id ?? null,
      teacherId: report.teacher?.id ?? sessionLoggedInTeacherId,
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

  const handleSessionFormSubmit = async (
    values: LessonSessionReportInput,
    options?: { markCommitmentSigned?: boolean }
  ) => {
    const isPreLesson = values.session_type === "PRE_LESSON";

    try {
      setSessionFormSubmitting(true);
      setSessionFormError(null);

      const payload: LessonSessionReportInput = {
        ...values,
      };

      let lessonIdForRefresh: number | null = null;
      if (isPreLesson) {
        delete payload.lesson_id;
        delete payload.progress_id;
      } else {
        const normalizedLessonId =
          sanitizeNumericValue(payload.lesson_id) ??
          sanitizeNumericValue(selectedLessonId);
        if (!normalizedLessonId) {
          setSessionFormError("Select a lesson for this session.");
          return;
        }
        payload.lesson_id = normalizedLessonId;
        lessonIdForRefresh = normalizedLessonId;
      }

      const normalizedStudentId = sanitizeNumericValue(payload.student_id);
      if (!normalizedStudentId) {
        setSessionFormError("Select a student for this session.");
        return;
      }
      payload.student_id = normalizedStudentId;

      let normalizedTeacherId = sanitizeNumericValue(payload.teacher_id);
      if (!normalizedTeacherId) {
        normalizedTeacherId = sanitizeNumericValue(sessionLoggedInTeacherId);
      }
      if (!normalizedTeacherId) {
        setSessionFormError("Select a teacher for this session.");
        return;
      }
      payload.teacher_id = normalizedTeacherId;

      if (!isPreLesson) {
        const normalizedProgressId =
          sanitizeNumericValue(payload.progress_id) ??
          sanitizeNumericValue(sessionFormDefaults.progressId ?? null);
        if (normalizedProgressId) {
          payload.progress_id = normalizedProgressId;
        } else {
          delete payload.progress_id;
        }
      }

      if (!payload.session_start) {
        setSessionFormError("Provide the actual session date.");
        return;
      }

      if (editingSessionReport) {
        await lessonsApi.updateSessionReport(editingSessionReport.id, payload);
      } else {
        await lessonsApi.createSessionReport(payload);
      }

      if (
        !editingSessionReport &&
        options?.markCommitmentSigned &&
        payload.student_id != null
      ) {
        const enrollment = enrollmentByStudent.get(Number(payload.student_id));
        if (enrollment?.id) {
          await lessonsApi.setEnrollmentCommitment(enrollment.id, {
            commitment_signed: true,
          });
          await fetchEnrollments();
        }
      }

      closeSessionModal();
      if (activeContentTab === "sessions") {
        await fetchSessionReports(sessionFilters);
      }
      if (lessonIdForRefresh != null) {
        await fetchProgress(lessonIdForRefresh);
      } else if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      await fetchAllProgress();
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
      if (activeContentTab === "sessions") {
        await fetchSessionReports(sessionFilters);
      }
      if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      await fetchAllProgress();
      fetchSummary();
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
      ongoingStudentsCount={ongoingStudentsCount}
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
      groupedProgress={displayedGroupedProgress}
      assignedStudentIds={assignedStudentIds}
      studentTeacherById={studentTeacherById}
      enrollmentByStudent={enrollmentByStudent}
      teacherChoices={teacherChoices}
      onTransferTeacher={async (enrollmentId, teacherId, note) => {
        await lessonsApi.transferEnrollment(enrollmentId, {
          teacher_id: teacherId,
          note,
        });
        await fetchEnrollments();
      }}
      progressFilterLessonId={progressFilterLessonId}
      progressSearchQuery={progressSearchQuery}
      progressStatusFilter={progressStatusFilter}
      progressSortField={progressSortField}
      progressSortDirection={progressSortDirection}
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
      sessionYearOptions={sessionYearOptions}
      // Delete lesson state
      lessonDeleteTarget={lessonDeleteTarget}
      lessonDeleteLoading={lessonDeleteLoading}
      lessonDeleteError={lessonDeleteError}
      // Branch filter
      lessonsBranchSelectedId={selectedBranchId}
      onLessonsBranchChange={setSelectedBranchId}
      lessonsBranchCanChangeFilter={lessonsBranchCanChangeFilter}
      lessonsBranchEditableOptions={lessonsBranchEditableOptions}
      lessonsBranchReadonlyOptions={lessonsBranchReadonlyOptions}
      lessonsBranchesLoading={branchesLoading}
      // People data
      people={peopleInBranchScope}
      studentChoices={studentChoices}
      enrollmentByStudentForAssign={enrollmentByStudent}
      defaultAssignTeacherId={sessionLoggedInTeacherId}
      currentTeacherId={sessionLoggedInTeacherId}
      nextLessonIdByStudent={nextLessonIdByStudent}
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
      onProgressSearchQueryChange={handleProgressSearchQueryChange}
      onProgressStatusFilterChange={handleProgressStatusFilterChange}
      onResetProgressFilters={handleResetProgressFilters}
      onProgressSortChange={handleProgressSortChange}
      onOpenPersonProgressModal={openPersonProgressModal}
      onClosePersonProgressModal={closePersonProgressModal}
      onSetActiveContentTab={setActiveContentTab}
      onUpdateSessionFilterDraft={updateSessionFilterDraft}
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

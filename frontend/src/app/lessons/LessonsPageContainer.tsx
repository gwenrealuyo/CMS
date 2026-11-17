"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  branchesApi,
  lessonsApi,
  unwrapList,
} from "@/src/lib/api";
import { canChangeLessonsBranchFilter as canChangeLessonsBranchFilterForUser } from "@/src/lib/lessonsBranchFilter";
import {
  Lesson,
  LessonAssignmentRequest,
  LessonCommitmentSettings,
  LessonFollowUpInput,
  LessonTimelinePayload,
  LessonProgressStatus,
  LessonProgressSummary,
  LessonSessionReport,
  LessonSessionReportInput,
  LessonStudentEnrollment,
  PersonLessonProgress,
} from "@/src/types/lesson";
import { usePeopleDirectory } from "@/src/hooks/usePeopleDirectory";
import { useLessonStudentSummaries } from "@/src/hooks/useLessonStudentSummaries";
import { useLessonSessionReports } from "@/src/hooks/useLessonSessionReports";
import {
  useLessonTimeline,
  type LessonTimelineFilterMode,
} from "@/src/hooks/useLessonTimeline";
import { useVisitorsAwaitingTeacher } from "@/src/hooks/useVisitorsAwaitingTeacher";
import { formatPersonName } from "@/src/lib/name";
import { formatDisplayDate, getChurchCalendarYear } from "@/src/lib/date";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import {
  canWriteLessons,
  canManageLessonCatalog,
  canBrowseAllLessonStudents,
  canViewLessonTimeline,
  isLessonsTeacherScoped,
} from "@/src/lib/lessons/lessonsPermissions";
import {
  createDefaultSessionFilters,
  extractErrorMessage,
  sanitizeNumericValue,
  escapeCsvValue,
  SessionFilterValues,
  enrollmentByStudentId,
  studentsAssignedToTeacher,
  TeacherProgressGroup,
} from "@/src/lib/lessonsUtils";
import {
  compareSessionReportsByStartThenLessonOrder,
  formatSessionTopicLabel,
} from "@/src/lib/sessionTopic";
import {
  PersonProgressSummary,
  LessonPersonSummary,
  LessonTeacherRosterEntry,
  ProgressSortField,
  VisitorAwaitingTeacher,
} from "@/src/types/lesson";
import { LessonFormValues } from "@/src/components/lessons/LessonForm";
import { LessonContentTab } from "@/src/components/lessons/LessonContentTabs";
import LessonsPageView from "./LessonsPageView";

type ProgressStatusFilter = "ALL" | LessonProgressStatus;

export default function LessonsPageContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const tabParam = searchParams.get("tab");
  const approvalParam = searchParams.get("approval");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const [progress, setProgress] = useState<PersonLessonProgress[]>([]);
  const [progressBrowsePage, setProgressBrowsePage] = useState(1);
  const [progressBrowsePageSize, setProgressBrowsePageSize] = useState(25);
  const [teacherOverviewRows, setTeacherOverviewRows] = useState<
    TeacherProgressGroup[]
  >([]);
  const [teacherOverviewLoading, setTeacherOverviewLoading] = useState(false);
  const [teacherOverviewError, setTeacherOverviewError] = useState<
    string | null
  >(null);
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
  const [progressTeacherFilterKey, setProgressTeacherFilterKey] = useState("");
  const [focusTeacherKey, setFocusTeacherKey] = useState<string | null>(null);
  const [progressStatusFilter, setProgressStatusFilter] =
    useState<ProgressStatusFilter>("ALL");
  const [progressSortField, setProgressSortField] =
    useState<ProgressSortField>("recentActivity");
  const [progressSortDirection, setProgressSortDirection] = useState<
    "asc" | "desc"
  >("desc");

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
  const [isNccLessonsPdfModalOpen, setNccLessonsPdfModalOpen] = useState(false);
  const [nccLessonsPdfFile, setNccLessonsPdfFile] = useState<File | null>(null);
  const [nccLessonsPdfUploading, setNccLessonsPdfUploading] = useState(false);
  const [nccLessonsPdfUploadError, setNccLessonsPdfUploadError] = useState<
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
  const [lessonTimelineSaving, setLessonTimelineSaving] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState("");
  const [timelineFilter, setTimelineFilter] =
    useState<LessonTimelineFilterMode>("follow-up");
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelinePageSize, setTimelinePageSize] = useState(10);
  const [timelineOrdering, setTimelineOrdering] = useState<string | undefined>(
    undefined,
  );
  const [awaitingSearch, setAwaitingSearch] = useState("");
  const [awaitingStatus, setAwaitingStatus] = useState("ONGOING");
  const [awaitingPage, setAwaitingPage] = useState(1);
  const [awaitingPageSize, setAwaitingPageSize] = useState(10);
  const [awaitingOrdering, setAwaitingOrdering] = useState<string | undefined>(
    undefined,
  );
  const [sessionReportsPage, setSessionReportsPage] = useState(1);
  const [sessionReportsPageSize, setSessionReportsPageSize] = useState(10);

  const [personProgressModal, setPersonProgressModal] = useState<{
    isOpen: boolean;
    person: LessonPersonSummary | null;
  }>({
    isOpen: false,
    person: null,
  });

  const [activeContentTab, setActiveContentTab] =
    useState<LessonContentTab>("progress");

  const [enrollments, setEnrollments] = useState<LessonStudentEnrollment[]>([]);
  const [assignmentRequests, setAssignmentRequests] = useState<
    LessonAssignmentRequest[]
  >([]);
  const [assignmentRequestsLoading, setAssignmentRequestsLoading] =
    useState(false);
  const [assignmentRequestsError, setAssignmentRequestsError] = useState<
    string | null
  >(null);
  const [reviewingAssignmentRequestId, setReviewingAssignmentRequestId] =
    useState<number | null>(null);
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
  const [lessonHardDeleteTarget, setLessonHardDeleteTarget] =
    useState<Lesson | null>(null);
  const [lessonHardDeleteLoading, setLessonHardDeleteLoading] = useState(false);
  const [lessonHardDeleteError, setLessonHardDeleteError] = useState<
    string | null
  >(null);
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

  const [assignPeopleSearch, setAssignPeopleSearch] = useState("");
  const { user } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const userCanHardDelete = canHardDelete(user);
  const canWriteLessonsAccess = useMemo(
    () => canWriteLessons({ user, moduleEnabled }),
    [user, moduleEnabled],
  );
  const canManageLessonCatalogAccess = useMemo(
    () => canManageLessonCatalog({ user, moduleEnabled }),
    [user, moduleEnabled],
  );
  const isTeacherScopedSessionView = useMemo(
    () => isLessonsTeacherScoped(user),
    [user],
  );
  const showStudentWorkflowTabs = Boolean(user) && canWriteLessonsAccess;
  const { people, loading: peopleLoading, error: peopleError } =
    usePeopleDirectory({
      enabled: Boolean(user) && showStudentWorkflowTabs,
      search: assignPeopleSearch,
      filters: { for_lessons: true },
      page: 1,
      pageSize: 50,
    });

  const defaultSessionTeacherId = useMemo(() => {
    if (!isTeacherScopedSessionView || user?.id == null) {
      return "";
    }
    return String(user.id);
  }, [isTeacherScopedSessionView, user?.id]);

  const lessonsBranchCanChangeFilter = useMemo(
    () => canChangeLessonsBranchFilterForUser(user),
    [user],
  );

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const lessonsBranchUserIdRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
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

  const branchApiParams = useMemo((): { branch_id: string } | Record<
    string,
    never
  > | null => {
    if (!user) {
      return null;
    }

    const userBranchId =
      user.branch != null && user.branch !== undefined
        ? String(user.branch)
        : "";

    let branchId: string;
    if (lessonsBranchCanChangeFilter) {
      const branchSyncedForUser = lessonsBranchUserIdRef.current === user.id;
      branchId = branchSyncedForUser ? selectedBranchId : userBranchId;
    } else {
      branchId = userBranchId;
    }

    return branchId ? { branch_id: branchId } : {};
  }, [user, lessonsBranchCanChangeFilter, selectedBranchId]);

  const progressBrowseEnabled =
    showStudentWorkflowTabs && branchApiParams !== null;

  const {
    summaries: studentSummaries,
    totalCount: progressTotalCount,
    loading: allProgressLoading,
    error: allProgressError,
    refetch: refetchStudentSummaries,
  } = useLessonStudentSummaries({
    branchParams: branchApiParams,
    search: progressSearchQuery,
    teacherKey: progressTeacherFilterKey,
    status:
      progressStatusFilter === "ALL" ? undefined : progressStatusFilter,
    nextLessonId: progressFilterLessonId,
    sortField: progressSortField,
    sortDirection: progressSortDirection,
    page: progressBrowsePage,
    pageSize: progressBrowsePageSize,
    enabled: progressBrowseEnabled,
  });

  const sessionsTabActive =
    showStudentWorkflowTabs && activeContentTab === "sessions";
  const {
    reports: sessionReports,
    totalCount: sessionReportsTotalCount,
    loading: sessionReportsLoading,
    error: sessionReportsError,
    refetch: refetchSessionReports,
  } = useLessonSessionReports({
    branchParams: branchApiParams,
    filters: sessionFilters,
    page: sessionReportsPage,
    pageSize: sessionReportsPageSize,
    enabled: sessionsTabActive && branchApiParams !== null,
  });

  const timelineTabActive =
    showStudentWorkflowTabs &&
    canViewLessonTimeline(user) &&
    activeContentTab === "timeline";

  const {
    timeline: lessonTimeline,
    loading: lessonTimelineLoading,
    error: lessonTimelineError,
    refetch: refetchLessonTimeline,
  } = useLessonTimeline({
    branchParams: branchApiParams,
    search: timelineSearch,
    filterMode: timelineFilter,
    ordering: timelineOrdering,
    page: timelinePage,
    pageSize: timelinePageSize,
    enabled: timelineTabActive && branchApiParams !== null,
  });

  const visitorsEnabled =
    Boolean(user) &&
    canBrowseAllLessonStudents(user) &&
    branchApiParams !== null &&
    activeContentTab === "awaiting-teacher";

  const {
    visitors: visitorsAwaitingTeacher,
    totalCount: visitorsTotalCount,
    loading: visitorsAwaitingTeacherLoading,
    error: visitorsAwaitingTeacherError,
    loaded: visitorsAwaitingTeacherLoaded,
    refetch: refetchVisitorsAwaitingTeacher,
    exportAll: exportVisitorsAwaitingTeacher,
  } = useVisitorsAwaitingTeacher({
    branchParams: branchApiParams,
    search: awaitingSearch,
    status: awaitingStatus,
    ordering: awaitingOrdering,
    page: awaitingPage,
    pageSize: awaitingPageSize,
    enabled: visitorsEnabled,
  });

  const peopleInBranchScope = useMemo(() => {
    if (!selectedBranchId) {
      return people;
    }
    return people.filter(
      (person) =>
        person.branch != null && String(person.branch) === selectedBranchId,
    );
  }, [people, selectedBranchId]);

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

  const [teacherRoster, setTeacherRoster] = useState<LessonTeacherRosterEntry[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const loadTeachers = async () => {
      if (!branchApiParams) {
        if (!cancelled) {
          setTeacherRoster([]);
        }
        return;
      }
      try {
        const params =
          "branch_id" in branchApiParams && branchApiParams.branch_id != null
            ? { branch_id: branchApiParams.branch_id }
            : undefined;
        const response = await lessonsApi.listTeachers(params);
        if (!cancelled) {
          setTeacherRoster(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load lesson teachers", error);
          setTeacherRoster([]);
        }
      }
    };
    loadTeachers();
    return () => {
      cancelled = true;
    };
  }, [branchApiParams]);

  const teacherChoices = useMemo(() => {
    return [...teacherRoster].sort((first, second) =>
      formatPersonName(first).localeCompare(formatPersonName(second)),
    );
  }, [teacherRoster]);

  const sessionLoggedInTeacherId = useMemo(() => {
    if (!user?.id) {
      return null;
    }
    const userId = String(user.id);
    const onRoster = teacherRoster.some((entry) => String(entry.id) === userId);
    return onRoster ? userId : null;
  }, [user, teacherRoster]);

  const sessionTeacherChoices = useMemo(() => {
    if (!defaultSessionTeacherId) {
      return teacherChoices;
    }
    const self = teacherChoices.find(
      (entry) => String(entry.id) === defaultSessionTeacherId,
    );
    if (self) {
      return [self];
    }
    if (!user) {
      return [];
    }
    return [
      {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
      },
    ];
  }, [defaultSessionTeacherId, teacherChoices, user]);

  const studentChoices = useMemo(() => {
    const source = defaultSessionTeacherId
      ? studentsAssignedToTeacher(enrollments, defaultSessionTeacherId)
      : [...peopleInBranchScope].filter(isSelectablePerson);
    return [...source].sort((first, second) =>
      formatPersonName(first).localeCompare(formatPersonName(second)),
    );
  }, [defaultSessionTeacherId, enrollments, peopleInBranchScope]);

  const sessionFormPeople = useMemo(() => {
    if (!defaultSessionTeacherId) {
      return peopleInBranchScope;
    }
    const allowedIds = new Set(
      studentChoices.map((student) => String(student.id)),
    );
    return peopleInBranchScope.filter((person) =>
      allowedIds.has(String(person.id)),
    );
  }, [defaultSessionTeacherId, peopleInBranchScope, studentChoices]);

  // Get active latest lessons for grouping
  const activeLatestLessons = useMemo(() => {
    return lessons.filter((lesson) => lesson.is_latest && lesson.is_active);
  }, [lessons]);

  const studentTeacherById = useMemo(() => {
    const map = new Map<number, LessonPersonSummary>();
    studentSummaries.forEach((summary) => {
      if (summary.teacher?.id != null) {
        map.set(summary.person.id, summary.teacher);
      }
    });
    return map;
  }, [studentSummaries]);

  const upsertEnrollment = useCallback((enrollment: LessonStudentEnrollment) => {
    if (!enrollment.student?.id) {
      return;
    }
    const studentId = enrollment.student.id;
    setEnrollments((previous) => {
      const next = previous.filter((entry) => entry.student?.id !== studentId);
      return [...next, enrollment];
    });
  }, []);

  const fetchEnrollmentForStudent = useCallback(
    async (studentId: number): Promise<LessonStudentEnrollment | null> => {
      try {
        const response = await lessonsApi.listEnrollments({
          student: studentId,
          page_size: 10,
          ...(branchApiParams ?? {}),
        });
        return unwrapList(response.data)[0] ?? null;
      } catch {
        return null;
      }
    },
    [branchApiParams],
  );

  const refreshEnrollmentsForStudents = useCallback(
    async (studentIds: number[]) => {
      const results = await Promise.all(
        studentIds.map((id) => fetchEnrollmentForStudent(id)),
      );
      results.forEach((enrollment) => {
        if (enrollment) {
          upsertEnrollment(enrollment);
        }
      });
    },
    [fetchEnrollmentForStudent, upsertEnrollment],
  );

  const fetchTeacherScopedEnrollments = useCallback(async () => {
    if (!defaultSessionTeacherId) {
      return [];
    }
    const all: LessonStudentEnrollment[] = [];
    let page = 1;
    for (let i = 0; i < 50; i += 1) {
      const response = await lessonsApi.listEnrollments({
        teacher: defaultSessionTeacherId,
        page_size: 100,
        page,
        ...(branchApiParams ?? {}),
      });
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload;
      }
      all.push(...(payload.results ?? []));
      if (!payload.next) {
        break;
      }
      page += 1;
    }
    return all;
  }, [branchApiParams, defaultSessionTeacherId]);

  const enrollmentByStudent = useMemo(
    () => enrollmentByStudentId(enrollments),
    [enrollments],
  );

  const groupedProgress = useMemo(
    () =>
      studentSummaries.map((summary) => ({
        ...summary,
        allProgress: summary.allProgress ?? [],
      })),
    [studentSummaries],
  );

  const nextLessonIdByStudent = useMemo(() => {
    const map = new Map<number, number>();
    groupedProgress.forEach((summary) => {
      if (summary.person?.id && summary.nextLesson?.id) {
        map.set(summary.person.id, summary.nextLesson.id);
      }
    });
    return map;
  }, [groupedProgress]);

  const ongoingStudentsCount = useMemo(() => {
    if (!summary?.overall) {
      return 0;
    }
    return (
      (summary.overall.ASSIGNED ?? 0) + (summary.overall.IN_PROGRESS ?? 0)
    );
  }, [summary]);

  useEffect(() => {
    if (branchApiParams === null || !showStudentWorkflowTabs) {
      setTeacherOverviewRows([]);
      return;
    }
    let cancelled = false;
    setTeacherOverviewLoading(true);
    lessonsApi
      .getTeacherOverview(branchApiParams ?? {})
      .then((response) => {
        if (cancelled) return;
        const rows: TeacherProgressGroup[] = (response.data ?? []).map(
          (row) => ({
            key: row.key,
            teacher: row.teacher,
            students: [],
            total: row.total,
            inProgress: row.in_progress,
            completed: row.completed,
            notStarted: row.not_started,
            number: row.number,
            isActive: row.is_active,
          }),
        );
        setTeacherOverviewRows(rows);
        setTeacherOverviewError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setTeacherOverviewRows([]);
        setTeacherOverviewError(
          extractErrorMessage(error, "Failed to load teacher overview."),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setTeacherOverviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchApiParams, showStudentWorkflowTabs]);

  useEffect(() => {
    setProgressBrowsePage(1);
  }, [
    progressSearchQuery,
    progressTeacherFilterKey,
    progressStatusFilter,
    progressFilterLessonId,
    progressSortField,
    progressSortDirection,
    selectedBranchId,
  ]);

  useEffect(() => {
    setSessionReportsPage(1);
  }, [sessionFilters, selectedBranchId]);

  useEffect(() => {
    fetchLessons();
    fetchCommitmentForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (action === "log-session") {
      if (canWriteLessonsAccess) {
        setActiveContentTab("sessions");
        setAutoOpenSessionReport(true);
      }
      router.replace(pathname);
    }
  }, [action, canWriteLessonsAccess, pathname, router]);

  useEffect(() => {
    if (
      tabParam === "teachers" &&
      canBrowseAllLessonStudents(user)
    ) {
      setActiveContentTab("teachers");
    }
    if (tabParam === "timeline" && canViewLessonTimeline(user)) {
      setActiveContentTab("timeline");
    }
  }, [tabParam, user]);

  useEffect(() => {
    if (
      tabParam !== "teachers" ||
      approvalParam !== "pending" ||
      !canBrowseAllLessonStudents(user)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("lessons-for-approval")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tabParam, approvalParam, user, activeContentTab]);

  useEffect(() => {
    if (
      !showStudentWorkflowTabs &&
      (activeContentTab === "progress" ||
        activeContentTab === "teachers" ||
        activeContentTab === "awaiting-teacher" ||
        activeContentTab === "timeline" ||
        activeContentTab === "sessions")
    ) {
      setActiveContentTab("lesson");
      return;
    }
    if (
      showStudentWorkflowTabs &&
      !canBrowseAllLessonStudents(user) &&
      (activeContentTab === "teachers" ||
        activeContentTab === "awaiting-teacher")
    ) {
      setActiveContentTab("progress");
    }
    if (
      showStudentWorkflowTabs &&
      !canViewLessonTimeline(user) &&
      activeContentTab === "timeline"
    ) {
      setActiveContentTab("progress");
    }
  }, [showStudentWorkflowTabs, activeContentTab, user]);

  useEffect(() => {
    if (!defaultSessionTeacherId) {
      return;
    }
    setSessionFilterDraft((previous) => {
      if (previous.teacherId === defaultSessionTeacherId) {
        return previous;
      }
      const next = { ...previous, teacherId: defaultSessionTeacherId };
      setSessionFilters(next);
      return next;
    });
  }, [defaultSessionTeacherId]);

  useEffect(() => {
    if (!showStudentWorkflowTabs) {
      setProgress([]);
      return;
    }
    if (selectedLessonId) {
      fetchProgress(selectedLessonId);
    } else {
      setProgress([]);
    }
  }, [selectedLessonId, showStudentWorkflowTabs]);

  const handleSaveLessonFollowUp = useCallback(
    async (input: LessonFollowUpInput) => {
      setLessonTimelineSaving(true);
      try {
        await lessonsApi.saveFollowUp(input);
        await refetchLessonTimeline();
      } finally {
        setLessonTimelineSaving(false);
      }
    },
    [refetchLessonTimeline],
  );

  useEffect(() => {
    if (branchApiParams === null) {
      return;
    }
    if (!showStudentWorkflowTabs) {
      return;
    }
    fetchSummary();
    fetchAssignmentRequests();
    if (selectedLessonId) {
      fetchProgress(selectedLessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchApiParams, selectedBranchId, showStudentWorkflowTabs]);

  useEffect(() => {
    if (branchApiParams === null || !showStudentWorkflowTabs) {
      setEnrollments([]);
      return;
    }
    if (!defaultSessionTeacherId) {
      setEnrollments([]);
      return;
    }
    let cancelled = false;
    fetchTeacherScopedEnrollments()
      .then((rows) => {
        if (!cancelled) {
          setEnrollments(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnrollments([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    branchApiParams,
    selectedBranchId,
    showStudentWorkflowTabs,
    defaultSessionTeacherId,
    fetchTeacherScopedEnrollments,
  ]);

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
        year: getChurchCalendarYear(),
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

  useEffect(() => {
    const yearsFromReports = Array.from(
      new Set(
        sessionReports
          .map((report) => {
            const source = report.session_start || report.session_date;
            const date = source ? new Date(source) : null;
            if (!date || Number.isNaN(date.getTime())) {
              return null;
            }
            return String(date.getFullYear());
          })
          .filter((year): year is string => Boolean(year)),
      ),
    );
    setSessionYearOptions((previous) => {
      const merged = new Set([
        ...previous,
        ...yearsFromReports,
        sessionFilters.year,
        String(new Date().getFullYear()),
      ]);
      return Array.from(merged)
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a));
    });
  }, [sessionReports, sessionFilters.year]);

  const fetchCommitmentForm = async () => {
    try {
      setCommitmentLoading(true);
      const response = await lessonsApi.getCommitmentForm();
      setCommitmentSettings(response.data);
      setCommitmentError(null);
    } catch (error) {
      setCommitmentError(
        extractErrorMessage(error, "Failed to load lesson resources.")
      );
    } finally {
      setCommitmentLoading(false);
    }
  };

  const fetchAssignmentRequests = async () => {
    if (!isTeacherScopedSessionView && !canBrowseAllLessonStudents(user)) {
      setAssignmentRequests([]);
      return;
    }
    try {
      setAssignmentRequestsLoading(true);
      const collected: LessonAssignmentRequest[] = [];
      for (let page = 1; page <= 2; page += 1) {
        const response = await lessonsApi.listAssignmentRequests({
          status: "pending",
          page_size: 100,
          page,
          ...(branchApiParams ?? {}),
        });
        const payload = response.data;
        const rows = unwrapList(payload);
        collected.push(...rows);
        if (Array.isArray(payload) || !payload.next || rows.length === 0) {
          break;
        }
        if (collected.length >= payload.count) {
          break;
        }
      }
      setAssignmentRequests(collected);
      setAssignmentRequestsError(null);
    } catch (error) {
      setAssignmentRequestsError(
        extractErrorMessage(error, "Failed to load assignment requests.")
      );
    } finally {
      setAssignmentRequestsLoading(false);
    }
  };

  const fetchProgress = async (lessonId: number) => {
    try {
      setProgressLoading(true);
      const response = await lessonsApi.getProgress({
        lesson: lessonId,
        ...(branchApiParams ?? {}),
        page_size: 100,
      });
      setProgress(unwrapList(response.data));
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
    if (!canManageLessonCatalogAccess) {
      return;
    }
    setEditingLesson(null);
    setLessonFormError(null);
    setLessonFormOpen(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    if (!canManageLessonCatalogAccess) {
      return;
    }
    setEditingLesson(lesson);
    setLessonFormError(null);
    setLessonFormOpen(true);
  };

  const requestDeleteLesson = (lesson: Lesson) => {
    if (!canManageLessonCatalogAccess) {
      return;
    }
    setLessonDeleteTarget(lesson);
    setLessonDeleteError(null);
  };

  const requestHardDeleteLesson = (lesson: Lesson) => {
    setLessonHardDeleteTarget(lesson);
    setLessonHardDeleteError(null);
  };

  const confirmDeleteLesson = async () => {
    if (!lessonDeleteTarget) {
      return;
    }
    if (!canManageLessonCatalogAccess) {
      setLessonDeleteError(
        "You do not have permission to deactivate lessons.",
      );
      return;
    }
    try {
      setLessonDeleteLoading(true);
      setLessonDeleteError(null);
      await lessonsApi.patch(lessonDeleteTarget.id, { is_active: false });
      await fetchLessons();
      fetchSummary();
      setLessonFormOpen(false);
      setEditingLesson(null);
      setLessonDeleteTarget(null);
    } catch (error) {
      setLessonDeleteError(
        extractErrorMessage(error, "Failed to deactivate the lesson."),
      );
    } finally {
      setLessonDeleteLoading(false);
    }
  };

  const confirmHardDeleteLesson = async () => {
    if (!lessonHardDeleteTarget) {
      return;
    }
    try {
      setLessonHardDeleteLoading(true);
      setLessonHardDeleteError(null);
      await lessonsApi.delete(lessonHardDeleteTarget.id);
      await fetchLessons();
      fetchSummary();
      setLessonFormOpen(false);
      setEditingLesson(null);
      setLessonHardDeleteTarget(null);
    } catch (error) {
      setLessonHardDeleteError(
        extractErrorMessage(error, "Failed to delete the lesson."),
      );
    } finally {
      setLessonHardDeleteLoading(false);
    }
  };

  const closeLessonForm = () => {
    setLessonFormOpen(false);
    setLessonFormSubmitting(false);
    setLessonFormError(null);
    setEditingLesson(null);
  };

  const handleLessonFormSubmit = async (values: LessonFormValues) => {
    if (!canManageLessonCatalogAccess) {
      setLessonFormError("You do not have permission to manage lesson content.");
      return;
    }
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
    if (!canManageLessonCatalogAccess) {
      setCommitmentUploadError(
        "You do not have permission to upload the commitment form.",
      );
      return;
    }
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

  const handleNccLessonsPdfUpload = async () => {
    if (!canManageLessonCatalogAccess) {
      setNccLessonsPdfUploadError(
        "You do not have permission to upload the NCC lessons PDF.",
      );
      return;
    }
    if (!nccLessonsPdfFile) {
      setNccLessonsPdfUploadError("Please choose a PDF to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("ncc_lessons_pdf", nccLessonsPdfFile);

    try {
      setNccLessonsPdfUploading(true);
      setNccLessonsPdfUploadError(null);
      const response = await lessonsApi.uploadNccLessonsPdf(formData);
      setCommitmentSettings(response.data);
      setNccLessonsPdfModalOpen(false);
      setNccLessonsPdfFile(null);
    } catch (error) {
      setNccLessonsPdfUploadError(
        extractErrorMessage(error, "Failed to upload the NCC lessons PDF.")
      );
    } finally {
      setNccLessonsPdfUploading(false);
    }
  };

  const handleAssignLessons = async (
    personIds: string[],
    lessonIds: number[],
    teacherId: string
  ) => {
    if (!canWriteLessonsAccess) {
      setAssignError("You do not have permission to assign lessons.");
      return;
    }
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
    if (
      needsTeacher &&
      !Number.isNaN(numericTeacherId) &&
      personIds.some((personId) => Number(personId) === numericTeacherId)
    ) {
      setAssignError(
        "A person cannot be assigned as their own lessons teacher."
      );
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      const numericPersonIds = personIds
        .map((id) => Number(id))
        .filter((value) => !Number.isNaN(value));

      if (isTeacherScopedSessionView) {
        if (
          user?.id == null ||
          Number.isNaN(numericTeacherId) ||
          numericTeacherId !== Number(user.id)
        ) {
          setAssignError("You can only request students for yourself.");
          return;
        }
        for (const personId of numericPersonIds) {
          await lessonsApi.createAssignmentRequest({
            student_id: personId,
            lesson_ids: lessonIds,
            teacher_id: numericTeacherId,
          });
        }
        await fetchAssignmentRequests();
        const requestedNames = personIds
          .map((personId) =>
            people.find((person) => String(person.id) === personId)
          )
          .filter((person): person is NonNullable<typeof person> =>
            Boolean(person)
          )
          .map((person) => formatPersonName(person));
        if (requestedNames.length === 1) {
          toast.success(
            `Submitted ${requestedNames[0]} for coordinator approval.`
          );
        } else {
          toast.success("Submitted for coordinator approval.");
        }
        return;
      }

      const assignPayload: {
        lesson_id: number;
        person_ids: number[];
        teacher_id?: number;
      } = {
        lesson_id: 0,
        person_ids: numericPersonIds,
      };
      // Always send a selected teacher id so students without an enrollment
      // never hit "Teacher is required" when the local enrollment map is stale.
      if (!Number.isNaN(numericTeacherId)) {
        assignPayload.teacher_id = numericTeacherId;
      }

      for (const lessonId of lessonIds) {
        await lessonsApi.assign({
          ...assignPayload,
          lesson_id: lessonId,
        });
      }

      await refreshEnrollmentsForStudents(numericPersonIds);
      await refetchStudentSummaries();
      if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      fetchSummary();

      const lessonLabel =
        lessonIds.length === 1 ? "1 lesson" : `${lessonIds.length} lessons`;
      const assignedNames = personIds
        .map((personId) => people.find((person) => String(person.id) === personId))
        .filter((person): person is NonNullable<typeof person> => Boolean(person))
        .map((person) => formatPersonName(person));
      if (assignedNames.length === 1) {
        toast.success(`Assigned ${lessonLabel} to ${assignedNames[0]}.`);
      } else {
        toast.success(`Assigned ${lessonLabel} successfully.`);
      }
    } catch (error) {
      setAssignError(extractErrorMessage(error, "Failed to assign lessons."));
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignAwaitingTeacher = async (
    personId: string,
    teacherId: string,
    enrollmentId: number | null,
  ) => {
    const lessonIds = activeLatestLessons.map((lesson) => lesson.id);
    if (lessonIds.length === 0) {
      setAssignError("No active lessons are available to assign.");
      return;
    }
    if (enrollmentId != null) {
      try {
        setAssigning(true);
        setAssignError(null);
        const transferResponse = await lessonsApi.transferEnrollment(
          enrollmentId,
          {
            teacher_id: teacherId,
          },
        );
        upsertEnrollment(transferResponse.data);
      } catch (error) {
        setAssignError(
          extractErrorMessage(error, "Failed to assign a lessons teacher."),
        );
        setAssigning(false);
        return;
      }
    }
    await handleAssignLessons([personId], lessonIds, teacherId);
    await refetchVisitorsAwaitingTeacher();
  };

  const handleApproveAssignmentRequest = async (id: number) => {
    const pendingRequest = assignmentRequests.find((request) => request.id === id);
    try {
      setReviewingAssignmentRequestId(id);
      setAssignmentRequestsError(null);
      await lessonsApi.approveAssignmentRequest(id);
      toast.success("Assignment approved.");
      await fetchAssignmentRequests();
      if (pendingRequest?.student?.id != null) {
        const enrollment = await fetchEnrollmentForStudent(
          pendingRequest.student.id,
        );
        if (enrollment) {
          upsertEnrollment(enrollment);
        }
      }
      await refetchStudentSummaries();
      await refetchVisitorsAwaitingTeacher();
      fetchSummary();
    } catch (error) {
      setAssignmentRequestsError(
        extractErrorMessage(error, "Failed to approve the assignment request.")
      );
    } finally {
      setReviewingAssignmentRequestId(null);
    }
  };

  const handleRejectAssignmentRequest = async (id: number, note: string) => {
    try {
      setReviewingAssignmentRequestId(id);
      setAssignmentRequestsError(null);
      await lessonsApi.rejectAssignmentRequest(id, note);
      toast.success("Assignment request rejected.");
      await fetchAssignmentRequests();
      await refetchVisitorsAwaitingTeacher();
    } catch (error) {
      setAssignmentRequestsError(
        extractErrorMessage(error, "Failed to reject the assignment request.")
      );
    } finally {
      setReviewingAssignmentRequestId(null);
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

  const handleProgressTeacherFilterChange = (value: string) => {
    setProgressTeacherFilterKey(value);
    setFocusTeacherKey(value || null);
  };

  const handleProgressSortChange = (field: ProgressSortField) => {
    if (progressSortField === field) {
      setProgressSortDirection((previous) =>
        previous === "asc" ? "desc" : "asc"
      );
      return;
    }
    setProgressSortField(field);
    setProgressSortDirection(field === "recentActivity" ? "desc" : "asc");
  };

  const openPersonProgressModal = (person: LessonPersonSummary) => {
    setPersonProgressModal({
      isOpen: true,
      person,
    });
    void fetchEnrollmentForStudent(person.id).then((enrollment) => {
      if (enrollment) {
        upsertEnrollment(enrollment);
      }
    });
  };

  const closePersonProgressModal = () => {
    setPersonProgressModal({
      isOpen: false,
      person: null,
    });
  };

  const resetProgressBrowseState = () => {
    setProgressSearchQuery("");
    setProgressFilterLessonId(null);
    setProgressStatusFilter("ALL");
    setProgressTeacherFilterKey("");
    setFocusTeacherKey(null);
    closePersonProgressModal();
  };

  const handleTeacherOverviewClick = (group: TeacherProgressGroup) => {
    resetProgressBrowseState();
    setProgressTeacherFilterKey(group.key);
    setFocusTeacherKey(group.key);
    setActiveContentTab("progress");
  };

  const updateSessionFilterDraft = (
    field: keyof SessionFilterValues,
    value: string
  ) => {
    if (field === "teacherId" && defaultSessionTeacherId) {
      return;
    }
    setSessionFilterDraft((previous) => {
      const next = { ...previous, [field]: value };
      setSessionFilters(next);
      return next;
    });
  };

  const resetSessionFilters = () => {
    const defaults = createDefaultSessionFilters(defaultSessionTeacherId);
    setSessionFilterDraft(defaults);
    setSessionFilters(defaults);
  };

  const handleExportSessionReports = async () => {
    const exportResponse = await lessonsApi.listSessionReportsAll({
      ...(branchApiParams ?? {}),
    });
    const exportRows = [...exportResponse.data].sort(
      compareSessionReportsByStartThenLessonOrder,
    );
    if (exportRows.length === 0) {
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

    const rows = exportRows.map((report) => [
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
    if (!canWriteLessonsAccess) {
      return;
    }
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
  }, [
    canWriteLessonsAccess,
    sessionLoggedInTeacherId,
    enrollmentByStudent,
    selectedLessonId,
    nextLessonIdByStudent,
  ]);

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

      const wasEditing = Boolean(editingSessionReport);
      if (
        !wasEditing &&
        options?.markCommitmentSigned &&
        payload.student_id != null
      ) {
        const enrollment = enrollmentByStudent.get(Number(payload.student_id));
        if (enrollment?.id) {
          const commitmentResponse = await lessonsApi.setEnrollmentCommitment(
            enrollment.id,
            {
              commitment_signed: true,
            },
          );
          upsertEnrollment(commitmentResponse.data);
        }
      }

      const student =
        peopleInBranchScope.find(
          (person) => Number(person.id) === Number(payload.student_id),
        ) ?? editingSessionReport?.student;
      const studentName = formatPersonName(student);
      closeSessionModal();
      resetProgressBrowseState();
      toast.success(
        wasEditing
          ? `Session report for ${studentName} updated.`
          : `Session report logged for ${studentName}.`,
        { duration: 4000 },
      );
      await refetchStudentSummaries();
      if (activeContentTab === "sessions") {
        await refetchSessionReports();
      }
      if (lessonIdForRefresh != null) {
        await fetchProgress(lessonIdForRefresh);
      } else if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      await refetchStudentSummaries();
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
      const studentName = formatPersonName(sessionDeleteTarget.student);
      setSessionDeleteTarget(null);
      resetProgressBrowseState();
      toast.success(`Session report for ${studentName} deleted.`, {
        duration: 4000,
      });
      await refetchStudentSummaries();
      if (activeContentTab === "sessions") {
        await refetchSessionReports();
      }
      if (selectedLessonId) {
        await fetchProgress(selectedLessonId);
      }
      await refetchStudentSummaries();
      fetchSummary();
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
      isNccLessonsPdfModalOpen={isNccLessonsPdfModalOpen}
      nccLessonsPdfFile={nccLessonsPdfFile}
      nccLessonsPdfUploading={nccLessonsPdfUploading}
      nccLessonsPdfUploadError={nccLessonsPdfUploadError}
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
      onPeopleSearchChange={setAssignPeopleSearch}
      // Grouped progress state
      allProgressLoading={allProgressLoading}
      allProgressError={allProgressError}
      groupedProgress={groupedProgress}
      progressTotalCount={progressTotalCount}
      progressBrowsePage={progressBrowsePage}
      progressBrowsePageSize={progressBrowsePageSize}
      onProgressBrowsePageChange={setProgressBrowsePage}
      onProgressBrowsePageSizeChange={setProgressBrowsePageSize}
      teacherOverviewRows={teacherOverviewRows}
      teacherOverviewLoading={teacherOverviewLoading}
      teacherOverviewError={teacherOverviewError}
      visitorsAwaitingTeacher={visitorsAwaitingTeacher}
      visitorsAwaitingTeacherLoading={visitorsAwaitingTeacherLoading}
      visitorsAwaitingTeacherError={visitorsAwaitingTeacherError}
      visitorsAwaitingTeacherLoaded={visitorsAwaitingTeacherLoaded}
      lessonTimeline={lessonTimeline}
      lessonTimelineLoading={lessonTimelineLoading}
      lessonTimelineError={lessonTimelineError}
      lessonTimelineSaving={lessonTimelineSaving}
      onSaveLessonFollowUp={handleSaveLessonFollowUp}
      studentTeacherById={studentTeacherById}
      focusTeacherKey={focusTeacherKey}
      enrollmentByStudent={enrollmentByStudent}
      teacherChoices={teacherChoices}
      currentUserId={user?.id ?? null}
      onAssignTeacher={async (studentId, teacherId, note) => {
        const response = await lessonsApi.createEnrollment({
          student_id: studentId,
          teacher_id: teacherId,
          note,
        });
        upsertEnrollment(response.data);
      }}
      onTransferTeacher={async (enrollmentId, teacherId, note) => {
        const response = await lessonsApi.transferEnrollment(enrollmentId, {
          teacher_id: teacherId,
          note,
        });
        upsertEnrollment(response.data);
      }}
      progressFilterLessonId={progressFilterLessonId}
      progressSearchQuery={progressSearchQuery}
      progressTeacherFilterKey={progressTeacherFilterKey}
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
      sessionReportsTotalCount={sessionReportsTotalCount}
      sessionReportsPage={sessionReportsPage}
      sessionReportsPageSize={sessionReportsPageSize}
      onSessionReportsPageChange={setSessionReportsPage}
      onSessionReportsPageSizeChange={setSessionReportsPageSize}
      timelinePage={timelinePage}
      timelinePageSize={timelinePageSize}
      timelineTotalCount={lessonTimeline?.count}
      onTimelinePageChange={setTimelinePage}
      onTimelinePageSizeChange={setTimelinePageSize}
      onTimelineSearchChange={(query) => {
        setTimelineSearch(query);
        setTimelinePage(1);
      }}
      onTimelineFilterChange={(filter) => {
        setTimelineFilter(filter);
        setTimelinePage(1);
      }}
      onTimelineSortChange={(field, direction) => {
        const prefix = direction === "desc" ? "-" : "";
        setTimelineOrdering(`${prefix}${field}`);
        setTimelinePage(1);
      }}
      visitorsPage={awaitingPage}
      visitorsPageSize={awaitingPageSize}
      visitorsTotalCount={visitorsTotalCount}
      onVisitorsPageChange={setAwaitingPage}
      onVisitorsPageSizeChange={setAwaitingPageSize}
      onVisitorsSearchChange={(query) => {
        setAwaitingSearch(query);
        setAwaitingPage(1);
      }}
      onVisitorsStatusChange={(status) => {
        setAwaitingStatus(status);
        setAwaitingPage(1);
      }}
      onVisitorsSortChange={(field, direction) => {
        const prefix = direction === "desc" ? "-" : "";
        setAwaitingOrdering(`${prefix}${field}`);
        setAwaitingPage(1);
      }}
      onExportVisitorsAll={exportVisitorsAwaitingTeacher}
      // Delete lesson state
      lessonDeleteTarget={lessonDeleteTarget}
      lessonDeleteLoading={lessonDeleteLoading}
      lessonDeleteError={lessonDeleteError}
      lessonHardDeleteTarget={lessonHardDeleteTarget}
      lessonHardDeleteLoading={lessonHardDeleteLoading}
      lessonHardDeleteError={lessonHardDeleteError}
      userCanHardDelete={userCanHardDelete}
      // Branch filter
      lessonsBranchSelectedId={selectedBranchId}
      onLessonsBranchChange={setSelectedBranchId}
      lessonsBranchCanChangeFilter={lessonsBranchCanChangeFilter}
      lessonsBranchEditableOptions={lessonsBranchEditableOptions}
      lessonsBranchReadonlyOptions={lessonsBranchReadonlyOptions}
      lessonsBranchesLoading={branchesLoading}
      // People data
      people={peopleInBranchScope}
      sessionFormPeople={sessionFormPeople}
      studentChoices={studentChoices}
      sessionTeacherChoices={sessionTeacherChoices}
      lockedSessionTeacherId={defaultSessionTeacherId || null}
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
      onRequestHardDeleteLesson={
        userCanHardDelete ? requestHardDeleteLesson : undefined
      }
      onConfirmDeleteLesson={confirmDeleteLesson}
      onConfirmHardDeleteLesson={
        userCanHardDelete ? confirmHardDeleteLesson : undefined
      }
      onCloseLessonForm={closeLessonForm}
      onLessonFormSubmit={handleLessonFormSubmit}
      onMarkCompleted={handleMarkCompleted}
      onNoteInputConfirm={handleNoteInputConfirm}
      onUpdateStatus={handleUpdateStatus}
      onRequestCommitmentToggle={requestCommitmentToggle}
      onConfirmCommitmentToggle={confirmCommitmentToggle}
      onOpenCommitmentModal={() => {
        if (!canManageLessonCatalogAccess) {
          return;
        }
        setCommitmentModalOpen(true);
      }}
      onCloseCommitmentModal={() => {
        setCommitmentModalOpen(false);
        setCommitmentFile(null);
        setCommitmentUploadError(null);
      }}
      onCommitmentUpload={handleCommitmentUpload}
      onSetCommitmentFile={(file) => setCommitmentFile(file)}
      onOpenNccLessonsPdfModal={() => {
        if (!canManageLessonCatalogAccess) {
          return;
        }
        setNccLessonsPdfModalOpen(true);
      }}
      onCloseNccLessonsPdfModal={() => {
        setNccLessonsPdfModalOpen(false);
        setNccLessonsPdfFile(null);
        setNccLessonsPdfUploadError(null);
      }}
      onNccLessonsPdfUpload={handleNccLessonsPdfUpload}
      onSetNccLessonsPdfFile={(file) => setNccLessonsPdfFile(file)}
      onCloseNoteInputModal={() =>
        setNoteInputModal({ isOpen: false, record: null })
      }
      onCloseAlertModal={() => setAlertModal({ isOpen: false, message: "" })}
      onSetCommitmentConfirm={(confirm) => setCommitmentConfirm(confirm)}
      onAssignLessons={handleAssignLessons}
      assignmentRequests={assignmentRequests}
      assignmentRequestsLoading={assignmentRequestsLoading}
      assignmentRequestsError={assignmentRequestsError}
      reviewingAssignmentRequestId={reviewingAssignmentRequestId}
      onApproveAssignmentRequest={handleApproveAssignmentRequest}
      onRejectAssignmentRequest={handleRejectAssignmentRequest}
      onProgressFilterChange={handleProgressFilterChange}
      onProgressSearchQueryChange={handleProgressSearchQueryChange}
      onProgressTeacherFilterChange={handleProgressTeacherFilterChange}
      onProgressStatusFilterChange={handleProgressStatusFilterChange}
      onProgressSortChange={handleProgressSortChange}
      onTeacherOverviewClick={handleTeacherOverviewClick}
      onAssignAwaitingTeacher={handleAssignAwaitingTeacher}
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
      onSetLessonHardDeleteTarget={(target) =>
        setLessonHardDeleteTarget(target)
      }
      onSetLessonDeleteError={(error) => setLessonDeleteError(error)}
      onSetLessonHardDeleteError={(error) => setLessonHardDeleteError(error)}
    />
  );
}

import { useState, useMemo, useEffect } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import {
  hasNonDefaultSessionDateFilters,
  SessionFilterValues,
} from "@/src/lib/lessonsUtils";
import { LessonSessionReport } from "@/src/types/lesson";
import { formatSessionTopicLabel } from "@/src/lib/sessionTopic";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonClusterLabel,
  formatPersonStatusLabel,
  getPersonClusterChipClass,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export type LessonPersonLike = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
};

const DEFAULT_SESSION_ITEMS_PER_PAGE = 10;
type SessionReportsViewMode = "cards" | "table";

function formatSessionDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function reportTopicLabel(report: LessonSessionReport): string {
  return formatSessionTopicLabel(
    report.session_type,
    report.pre_lesson_kind,
    report.lesson?.title ?? null,
  );
}

interface SessionReportCardProps {
  report: LessonSessionReport;
  formatDateOnly: (value?: string | null) => string;
  onEditSession: (report: LessonSessionReport) => void;
  onRequestDelete: (report: LessonSessionReport) => void;
  hideStudentHeader?: boolean;
}

function SessionReportCard({
  report,
  formatDateOnly,
  onEditSession,
  onRequestDelete,
  hideStudentHeader = false,
}: SessionReportCardProps) {
  const topicLabel = reportTopicLabel(report);
  const isPreLesson = report.session_type === "PRE_LESSON";

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {!hideStudentHeader && (
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  {formatPersonName(report.student)}
                </h4>
                {report.student && (
                  <>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPersonStatusColor(report.student.status)}`}
                    >
                      {formatPersonStatusLabel(report.student.status)}
                    </span>
                    <span
                      className={getPersonClusterChipClass(
                        (report.student.cluster_codes?.length ?? 0) > 0,
                      )}
                    >
                      {formatPersonClusterLabel(report.student.cluster_codes)}
                    </span>
                  </>
                )}
              </div>
            )}
            <span
              className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isPreLesson
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              } ${hideStudentHeader ? "" : "mt-2"}`}
            >
              <span className="truncate">{topicLabel}</span>
            </span>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="secondary"
              className="!text-primary min-h-[36px] px-3 py-1.5 text-xs font-normal bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 inline-flex items-center gap-1.5"
              onClick={() => onEditSession(report)}
            >
              <PencilSquareIcon className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="secondary"
              className="!text-red-600 min-h-[36px] px-3 py-1.5 text-xs font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 inline-flex items-center gap-1.5"
              onClick={() => onRequestDelete(report)}
              aria-label="Delete session report"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserIcon
              className="h-4 w-4 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <dt className="sr-only">Teacher</dt>
            <dd className="truncate">{formatPersonName(report.teacher)}</dd>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarIcon
              className="h-4 w-4 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <dt className="sr-only">Actual session</dt>
            <dd>{formatSessionDateTime(report.session_start)}</dd>
          </div>
        </dl>
        <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2.5 text-xs text-gray-600">
          <div className="inline-flex items-baseline gap-1">
            <dt className="text-gray-500">Score</dt>
            <dd className="text-gray-800">{report.score || "—"}</dd>
          </div>
          <div className="inline-flex items-baseline gap-1">
            <dt className="text-gray-500">Scheduled</dt>
            <dd className="text-gray-800">
              {formatDateOnly(report.session_date)}
            </dd>
          </div>
          <div className="inline-flex items-baseline gap-1">
            <dt className="text-gray-500">Next</dt>
            <dd className="text-gray-800">
              {formatDateOnly(report.next_session_date)}
            </dd>
          </div>
          <div className="inline-flex items-baseline gap-1">
            <dt className="text-gray-500">Progress</dt>
            <dd className="text-gray-800">
              {report.progress ? `#${report.progress}` : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {report.remarks ? (
        <div className="border-t border-gray-100 px-4 py-2.5 sm:px-5">
          <p className="text-xs text-gray-500">Notes</p>
          <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-line">
            {report.remarks}
          </p>
        </div>
      ) : null}
    </article>
  );
}

type SessionReportsSortField =
  | "student"
  | "teacher"
  | "scheduledDate"
  | "actualDate"
  | "nextScheduledDate"
  | "score"
  | "linkedProgress";

type StudentReportGroup = {
  key: string;
  student: LessonSessionReport["student"];
  reports: LessonSessionReport[];
  latestSessionStart: string | null;
  lessonCount: number;
  preLessonCount: number;
  latestLessonTopic: string;
};

interface SessionReportsSectionProps {
  lessonChoices: LessonPersonLike[];
  sessionReports: LessonSessionReport[];
  sessionReportsLoading: boolean;
  sessionReportsError: string | null;
  sessionFilterDraft: SessionFilterValues;
  sessionYearOptions: string[];
  teacherChoices: LessonPersonLike[];
  studentChoices: LessonPersonLike[];
  onFilterChange: (field: keyof SessionFilterValues, value: string) => void;
  onResetFilters: () => void;
  onExport: () => void;
  onOpenSessionModal: () => void;
  onEditSession: (report: LessonSessionReport) => void;
  onRequestDelete: (report: LessonSessionReport) => void;
  formatDateOnly: (value?: string | null) => string;
  formatDateTime: (value?: string | null) => string;
  canLogSession: boolean;
  canExport: boolean;
}

function hasActiveSessionFilters(filters: SessionFilterValues): boolean {
  return Boolean(
    filters.teacherId ||
      filters.studentId ||
      filters.lessonId ||
      hasNonDefaultSessionDateFilters(filters),
  );
}

export default function SessionReportsSection({
  lessonChoices,
  sessionReports,
  sessionReportsLoading,
  sessionReportsError,
  sessionFilterDraft,
  sessionYearOptions,
  teacherChoices,
  studentChoices,
  onFilterChange,
  onResetFilters,
  onExport,
  onOpenSessionModal,
  onEditSession,
  onRequestDelete,
  formatDateOnly,
  formatDateTime,
  canLogSession,
  canExport,
}: SessionReportsSectionProps) {
  const monthOptions = useMemo(
    () => [
      { value: "", label: "All months" },
      { value: "1", label: "January" },
      { value: "2", label: "February" },
      { value: "3", label: "March" },
      { value: "4", label: "April" },
      { value: "5", label: "May" },
      { value: "6", label: "June" },
      { value: "7", label: "July" },
      { value: "8", label: "August" },
      { value: "9", label: "September" },
      { value: "10", label: "October" },
      { value: "11", label: "November" },
      { value: "12", label: "December" },
    ],
    [],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(
    DEFAULT_SESSION_ITEMS_PER_PAGE,
  );
  const [viewMode, setViewMode] = useState<SessionReportsViewMode>("cards");
  const [sortField, setSortField] =
    useState<SessionReportsSortField>("actualDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);

  const sortedReports = useMemo(() => {
    if (viewMode !== "table") {
      return sessionReports;
    }

    return [...sessionReports].sort((first, second) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortField === "student") {
        return (
          formatPersonName(first.student).localeCompare(
            formatPersonName(second.student),
          ) * direction
        );
      }
      if (sortField === "teacher") {
        return (
          formatPersonName(first.teacher).localeCompare(
            formatPersonName(second.teacher),
          ) * direction
        );
      }
      if (sortField === "scheduledDate") {
        return (
          (new Date(first.session_date).getTime() -
            new Date(second.session_date).getTime()) *
          direction
        );
      }
      if (sortField === "actualDate") {
        return (
          (new Date(first.session_start).getTime() -
            new Date(second.session_start).getTime()) *
          direction
        );
      }
      if (sortField === "nextScheduledDate") {
        const firstValue = first.next_session_date
          ? new Date(first.next_session_date).getTime()
          : Number.POSITIVE_INFINITY;
        const secondValue = second.next_session_date
          ? new Date(second.next_session_date).getTime()
          : Number.POSITIVE_INFINITY;
        return (firstValue - secondValue) * direction;
      }
      if (sortField === "score") {
        return (
          ((first.score || "").localeCompare(second.score || "") || 0) *
          direction
        );
      }

      const firstProgress = first.progress ?? Number.POSITIVE_INFINITY;
      const secondProgress = second.progress ?? Number.POSITIVE_INFINITY;
      return (firstProgress - secondProgress) * direction;
    });
  }, [sessionReports, sortDirection, sortField, viewMode]);

  const handleSort = (field: SessionReportsSortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const SortIcon = ({ field }: { field: SessionReportsSortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const groupedReports = useMemo<StudentReportGroup[]>(() => {
    const groups = new Map<string, StudentReportGroup>();
    sessionReports.forEach((report) => {
      const student = report.student;
      const key = String(student?.id ?? `unknown-${report.id}`);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          student,
          reports: [],
          latestSessionStart: null,
          lessonCount: 0,
          preLessonCount: 0,
          latestLessonTopic: "—",
        });
      }
      const group = groups.get(key)!;
      group.reports.push(report);
      if (report.session_type === "LESSON") {
        group.lessonCount += 1;
        if (group.latestLessonTopic === "—") {
          group.latestLessonTopic = formatSessionTopicLabel(
            report.session_type,
            report.pre_lesson_kind,
            report.lesson?.title ?? null,
          );
        }
      } else {
        group.preLessonCount += 1;
      }
      if (
        !group.latestSessionStart ||
        new Date(report.session_start).getTime() >
          new Date(group.latestSessionStart).getTime()
      ) {
        group.latestSessionStart = report.session_start ?? null;
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        reports: [...group.reports].sort(
          (a, b) =>
            new Date(b.session_start).getTime() -
            new Date(a.session_start).getTime(),
        ),
      }))
      .sort(
        (a, b) =>
          new Date(b.latestSessionStart || 0).getTime() -
          new Date(a.latestSessionStart || 0).getTime(),
      );
  }, [sessionReports]);

  useEffect(() => {
    setExpandedGroupKeys(groupedReports.map((group) => group.key));
  }, [groupedReports]);

  const paginatedCardGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedReports.slice(startIndex, endIndex);
  }, [groupedReports, currentPage, itemsPerPage]);

  const groupedTableReports = useMemo<StudentReportGroup[]>(() => {
    const groups = new Map<string, StudentReportGroup>();
    sortedReports.forEach((report) => {
      const student = report.student;
      const key = String(student?.id ?? `unknown-${report.id}`);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          student,
          reports: [],
          latestSessionStart: null,
          lessonCount: 0,
          preLessonCount: 0,
          latestLessonTopic: "—",
        });
      }
      const group = groups.get(key)!;
      group.reports.push(report);
      if (report.session_type === "LESSON") {
        group.lessonCount += 1;
      } else {
        group.preLessonCount += 1;
      }
      if (
        !group.latestSessionStart ||
        new Date(report.session_start).getTime() >
          new Date(group.latestSessionStart).getTime()
      ) {
        group.latestSessionStart = report.session_start ?? null;
      }
      if (
        group.latestLessonTopic === "—" &&
        report.session_type === "LESSON"
      ) {
        group.latestLessonTopic = formatSessionTopicLabel(
          report.session_type,
          report.pre_lesson_kind,
          report.lesson?.title ?? null,
        );
      }
    });

    return Array.from(groups.values());
  }, [sortedReports]);

  const paginatedTableGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedTableReports.slice(startIndex, endIndex);
  }, [groupedTableReports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(
    (viewMode === "table" ? groupedTableReports.length : groupedReports.length) /
      itemsPerPage,
  );

  const toggleGroup = (groupKey: string) => {
    setExpandedGroupKeys((previous) =>
      previous.includes(groupKey)
        ? previous.filter((key) => key !== groupKey)
        : [...previous, groupKey],
    );
  };

  const expandAllGroups = () => {
    setExpandedGroupKeys(groupedReports.map((group) => group.key));
  };

  const collapseAllGroups = () => {
    setExpandedGroupKeys([]);
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <Card title="Session Reports">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-gray-500 sm:max-w-lg">
            View and log all lesson and pre-lesson sessions across the catalog.
            Use the filters below to narrow by teacher, student, lesson, or date.
          </p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.25">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "table"
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "bg-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <TableCellsIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  viewMode === "cards"
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "bg-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <Squares2X2Icon className="h-3.5 w-3.5" />
                Cards
              </button>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:ml-2">
              <Button
                variant="secondary"
                onClick={onExport}
                disabled={!canExport}
                className="w-full sm:w-auto min-h-[44px] text-sm"
              >
                Download CSV
              </Button>
              <Button
                variant="primary"
                onClick={onOpenSessionModal}
                disabled={!canLogSession}
                className="w-full sm:w-auto min-h-[44px] text-sm"
              >
                Log Session
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SearchableSelect
                value={sessionFilterDraft.lessonId}
                onChange={(value) => onFilterChange("lessonId", value)}
                options={lessonChoices}
                placeholder="Search lessons..."
                label="Lesson"
                emptyOptionLabel="All lessons"
                emptyMessage="No lessons found"
                controlClassName="h-10"
              />
              <SearchableSelect
                value={sessionFilterDraft.teacherId}
                onChange={(value) => onFilterChange("teacherId", value)}
                options={teacherChoices}
                placeholder="Search teachers..."
                label="Teacher"
                emptyOptionLabel="All teachers"
                emptyMessage="No teachers found"
                controlClassName="h-10"
              />
              <SearchableSelect
                value={sessionFilterDraft.studentId}
                onChange={(value) => onFilterChange("studentId", value)}
                options={studentChoices}
                placeholder="Search students..."
                label="Student"
                emptyOptionLabel="All students"
                emptyMessage="No students found"
                controlClassName="h-10"
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Month
                </label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  value={sessionFilterDraft.month}
                  onChange={(event) =>
                    onFilterChange("month", event.target.value)
                  }
                >
                  {monthOptions.map((month) => (
                    <option key={month.value || "all"} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Year
                </label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  value={sessionFilterDraft.year}
                  onChange={(event) =>
                    onFilterChange("year", event.target.value)
                  }
                >
                  <option value="">All years</option>
                  {sessionYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="tertiary"
                onClick={onResetFilters}
                className="w-full min-h-[44px] text-sm xl:w-auto"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {sessionReportsError && <ErrorMessage message={sessionReportsError} />}

        {sessionReportsLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : sessionReports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-gray-500">
            {hasActiveSessionFilters(sessionFilterDraft)
              ? "No session reports match the current filters."
              : "No session reports recorded yet."}
          </div>
        ) : viewMode === "table" ? (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="tertiary" className="text-xs" onClick={expandAllGroups}>
                Expand all
              </Button>
              <Button
                variant="tertiary"
                className="text-xs"
                onClick={collapseAllGroups}
              >
                Collapse all
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("student")}
                      >
                        Student
                        <SortIcon field="student" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("teacher")}
                      >
                        Teacher
                        <SortIcon field="teacher" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Session
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("scheduledDate")}
                      >
                        Scheduled Session
                        <SortIcon field="scheduledDate" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("actualDate")}
                      >
                        Actual Session
                        <SortIcon field="actualDate" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("nextScheduledDate")}
                      >
                        Next Schedule
                        <SortIcon field="nextScheduledDate" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("score")}
                      >
                        Score / Rating
                        <SortIcon field="score" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("linkedProgress")}
                      >
                        Linked Progress
                        <SortIcon field="linkedProgress" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedTableGroups.map((group) => {
                    const isExpanded = expandedGroupKeys.includes(group.key);
                    return (
                      <>
                        <tr
                          key={`${group.key}-header`}
                          className="border-t border-gray-200 bg-gray-50/70"
                        >
                          <td className="px-3 py-2 text-sm font-semibold text-foreground">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5"
                              onClick={() => toggleGroup(group.key)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              )}
                              {formatPersonName(group.student)}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {group.reports.length} session
                            {group.reports.length === 1 ? "" : "s"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {group.latestLessonTopic}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600" colSpan={2}>
                            Latest: {formatSessionDateTime(group.latestSessionStart)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600" colSpan={2}>
                            Lesson: {group.lessonCount} | Pre-lesson:{" "}
                            {group.preLessonCount}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">—</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">
                            Group
                          </td>
                        </tr>
                        {isExpanded &&
                          group.reports.map((report) => (
                            <tr
                              key={report.id}
                              className="border-t border-gray-100"
                            >
                              <td className="px-3 py-2 text-sm font-semibold text-primary">
                                <span className="pl-5">{formatPersonName(report.student)}</span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {formatPersonName(report.teacher)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {reportTopicLabel(report)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {formatDateOnly(report.session_date)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {formatSessionDateTime(report.session_start)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {formatDateOnly(report.next_session_date)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {report.score || "—"}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {report.progress ? `Record #${report.progress}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right text-sm">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    variant="secondary"
                                    className="!text-primary min-h-[32px] px-2.5 py-1 text-xs font-normal bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 inline-flex items-center gap-1.5"
                                    onClick={() => onEditSession(report)}
                                    aria-label="Edit session report"
                                    title="Edit session report"
                                  >
                                    <PencilSquareIcon className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    className="!text-red-600 min-h-[32px] px-2.5 py-1 text-xs font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 inline-flex items-center gap-1.5"
                                    onClick={() => onRequestDelete(report)}
                                    aria-label="Delete session report"
                                    title="Delete session report"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button variant="tertiary" className="text-xs" onClick={expandAllGroups}>
                Expand all
              </Button>
              <Button
                variant="tertiary"
                className="text-xs"
                onClick={collapseAllGroups}
              >
                Collapse all
              </Button>
            </div>
            {paginatedCardGroups.map((group) => {
              const isExpanded = expandedGroupKeys.includes(group.key);
              return (
                <article
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-left hover:bg-gray-50 sm:px-5"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          {formatPersonName(group.student)}
                        </h4>
                        {group.student && (
                          <>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPersonStatusColor(group.student.status)}`}
                            >
                              {formatPersonStatusLabel(group.student.status)}
                            </span>
                            <span
                              className={getPersonClusterChipClass(
                                (group.student.cluster_codes?.length ?? 0) > 0,
                              )}
                            >
                              {formatPersonClusterLabel(group.student.cluster_codes)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                          {group.reports.length} session
                          {group.reports.length === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          Lesson: {group.lessonCount}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                          Pre-lesson: {group.preLessonCount}
                        </span>
                        <span>
                          Latest: {formatSessionDateTime(group.latestSessionStart)}
                        </span>
                        <span>Latest topic: {group.latestLessonTopic}</span>
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {isExpanded ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-3 p-3 sm:p-4">
                      {group.reports.map((report) => (
                        <SessionReportCard
                          key={report.id}
                          report={report}
                          formatDateOnly={formatDateOnly}
                          onEditSession={onEditSession}
                          onRequestDelete={onRequestDelete}
                          hideStudentHeader
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={
              viewMode === "table"
                ? groupedTableReports.length
                : groupedReports.length
            }
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

import { useState, useMemo, useEffect } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { SessionFilterValues } from "@/src/lib/lessonsUtils";
import { Lesson, LessonSessionReport } from "@/src/types/lesson";
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

interface SessionReportCardProps {
  report: LessonSessionReport;
  selectedLesson: Lesson | null;
  formatDateOnly: (value?: string | null) => string;
  onEditSession: (report: LessonSessionReport) => void;
  onRequestDelete: (report: LessonSessionReport) => void;
}

function SessionReportCard({
  report,
  selectedLesson,
  formatDateOnly,
  onEditSession,
  onRequestDelete,
}: SessionReportCardProps) {
  const topicLabel = formatSessionTopicLabel(
    report.session_type,
    report.pre_lesson_kind,
    report.lesson?.title ?? selectedLesson?.title ?? null,
  );
  const isPreLesson = report.session_type === "PRE_LESSON";

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
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
            <span
              className={`mt-2 inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isPreLesson
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
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

interface SessionReportsSectionProps {
  selectedLesson: Lesson | null;
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

export default function SessionReportsSection({
  selectedLesson,
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

  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedReports.slice(startIndex, endIndex);
  }, [sortedReports, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedReports.length / itemsPerPage);

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
            Log 1-on-1 lesson sessions to capture coaching notes beyond journey
            updates and export them for follow-up.
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
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            No session reports recorded for this lesson yet.
          </div>
        ) : viewMode === "table" ? (
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
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedReports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-3 py-2 text-sm font-semibold text-primary">
                        {formatPersonName(report.student)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatPersonName(report.teacher)}
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
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedReports.map((report) => (
              <SessionReportCard
                key={report.id}
                report={report}
                selectedLesson={selectedLesson}
                formatDateOnly={formatDateOnly}
                onEditSession={onEditSession}
                onRequestDelete={onRequestDelete}
              />
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

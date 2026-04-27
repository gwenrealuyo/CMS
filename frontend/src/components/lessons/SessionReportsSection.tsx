import { useState, useMemo, useEffect } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { Lesson, LessonSessionReport } from "@/src/types/lesson";
import { formatPersonName } from "@/src/lib/name";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";

export type LessonPersonLike = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
};

export type SessionFilterValues = {
  teacherId: string;
  studentId: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_SESSION_ITEMS_PER_PAGE = 10;
type SessionReportsViewMode = "cards" | "table";
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
  teacherChoices: LessonPersonLike[];
  studentChoices: LessonPersonLike[];
  onFilterChange: (field: keyof SessionFilterValues, value: string) => void;
  onApplyFilters: () => void;
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
  teacherChoices,
  studentChoices,
  onFilterChange,
  onApplyFilters,
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_SESSION_ITEMS_PER_PAGE);
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
            formatPersonName(second.student)
          ) * direction
        );
      }
      if (sortField === "teacher") {
        return (
          formatPersonName(first.teacher).localeCompare(
            formatPersonName(second.teacher)
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
        return ((first.score || "").localeCompare(second.score || "") || 0) * direction;
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
            Log 1-on-1 lesson sessions to capture coaching notes beyond
            journey updates and export them for follow-up.
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

        <div className="space-y-3 rounded-lg border border-gray-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <SearchableSelect
              value={sessionFilterDraft.teacherId}
              onChange={(value) => onFilterChange("teacherId", value)}
              options={teacherChoices}
              placeholder="Search teachers..."
              label="Teacher"
              emptyOptionLabel="All teachers"
              emptyMessage="No teachers found"
            />
            <SearchableSelect
              value={sessionFilterDraft.studentId}
              onChange={(value) => onFilterChange("studentId", value)}
              options={studentChoices}
              placeholder="Search students..."
              label="Student"
              emptyOptionLabel="All students"
              emptyMessage="No students found"
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date From
              </label>
              <input
                type="date"
                className="w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sessionFilterDraft.dateTo}
                onChange={(event) =>
                  onFilterChange("dateTo", event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button 
              variant="tertiary" 
              onClick={onResetFilters}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Reset Filters
            </Button>
            <Button 
              variant="secondary" 
              onClick={onApplyFilters}
              className="w-full sm:w-auto min-h-[44px]"
            >
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
                        Scheduled Session Date
                        <SortIcon field="scheduledDate" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("actualDate")}
                      >
                        Actual Session Date
                        <SortIcon field="actualDate" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={() => handleSort("nextScheduledDate")}
                      >
                        Next Scheduled Session Date
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
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatPersonName(report.student)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatPersonName(report.teacher)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatDateOnly(report.session_date)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatDateTime(report.session_start)}
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
                            variant="tertiary"
                            className="min-h-[32px] px-2 py-1 text-xs"
                            onClick={() => onEditSession(report)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="tertiary"
                            className="min-h-[32px] px-2 py-1 text-xs"
                            onClick={() => onRequestDelete(report)}
                          >
                            Delete
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
                      Actual Session Date: {formatDateTime(report.session_start)}
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
                      Scheduled Session Date
                    </span>
                    <span>{formatDateOnly(report.session_date)}</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase text-gray-500">
                      Next Scheduled Session Date
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


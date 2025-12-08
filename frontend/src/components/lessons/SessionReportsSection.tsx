import { useState, useMemo, useEffect } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import SearchableSelect from "@/src/components/ui/SearchableSelect";
import { Lesson, LessonSessionReport } from "@/src/types/lesson";
import { formatPersonName } from "@/src/lib/name";

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
            journey updates and export them for follow-up.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
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


import { useState, useMemo, useEffect } from "react";
import {
  LessonProgressStatus,
  PersonProgressSummary,
  LessonPersonSummary,
} from "@/src/types/lesson";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Pagination from "@/src/components/ui/Pagination";
import { formatPersonName } from "@/src/lib/name";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

type ProgressSortField =
  | "person"
  | "previousLesson"
  | "progress"
  | "nextLesson"
  | "status";

interface LessonProgressTableProps {
  groupedProgress: PersonProgressSummary[];
  loading: boolean;
  error?: string | null;
  sortField: ProgressSortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: ProgressSortField) => void;
  onPersonClick: (person: LessonPersonSummary) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 25;

export default function LessonProgressTable({
  groupedProgress,
  loading,
  error,
  sortField,
  sortDirection,
  onSortChange,
  onPersonClick,
}: LessonProgressTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const paginatedProgress = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedProgress.slice(startIndex, endIndex);
  }, [groupedProgress, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(groupedProgress.length / itemsPerPage);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="border rounded-lg">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (groupedProgress.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-4 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
        No students have been assigned here yet.
      </div>
    );
  }

  const getSummaryStatus = (
    summary: PersonProgressSummary,
  ): LessonProgressStatus | "ASSIGNED" => {
    if (summary.totalLessons <= 0) {
      return "ASSIGNED";
    }
    if (summary.completedCount <= 0) {
      return "ASSIGNED";
    }
    if (summary.completedCount >= summary.totalLessons) {
      return "COMPLETED";
    }
    return "IN_PROGRESS";
  };

  const renderSortIcon = (field: ProgressSortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const statusBadgeStyles: Record<LessonProgressStatus | "ASSIGNED", string> = {
    ASSIGNED: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    SKIPPED: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full min-w-[900px] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%] hover:bg-gray-100"
                onClick={() => onSortChange("person")}
              >
                <div className="flex items-center gap-1">
                  <span>Person</span>
                  {renderSortIcon("person")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[26%] hover:bg-gray-100"
                onClick={() => onSortChange("previousLesson")}
              >
                <div className="flex items-center gap-1">
                  <span>Previous Lesson</span>
                  {renderSortIcon("previousLesson")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[20%] hover:bg-gray-100"
                onClick={() => onSortChange("progress")}
              >
                <div className="flex items-center gap-1">
                  <span>Progress</span>
                  {renderSortIcon("progress")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[22%] hover:bg-gray-100"
                onClick={() => onSortChange("nextLesson")}
              >
                <div className="flex items-center gap-1">
                  <span>Next Lesson</span>
                  {renderSortIcon("nextLesson")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%] hover:bg-gray-100"
                onClick={() => onSortChange("status")}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProgress.map((summary) => {
              const personName = formatPersonName(summary.person);
              const progressText = `Completed ${summary.completedCount} of ${summary.totalLessons}`;
              const summaryStatus = getSummaryStatus(summary);

              return (
                <tr key={summary.person.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-700">
                    <div className="flex flex-col min-w-0 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => onPersonClick(summary.person)}
                        className="text-left font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer break-words"
                      >
                        {personName}
                      </button>
                      <span className="text-xs text-gray-500">
                        Member ID:{" "}
                        {summary.person.member_id?.trim()
                          ? summary.person.member_id
                          : (summary.person.id ?? "N/A")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {summary.previousLesson ? (
                      <div className="min-w-0 space-y-1.5">
                        <div className="font-medium break-words">
                          {summary.previousLesson.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          Lesson {summary.previousLesson.order}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <div className="space-y-2 min-w-[120px]">
                      <div className="text-xs md:text-sm font-medium">
                        {progressText}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all"
                          style={{ width: `${summary.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {summary.nextLesson ? (
                      <div className="min-w-0 space-y-1.5">
                        <div className="font-medium break-words">
                          {summary.nextLesson.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          Lesson {summary.nextLesson.order}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">
                        All lessons completed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                        statusBadgeStyles[summaryStatus]
                      }`}
                    >
                      {summaryStatus.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={groupedProgress.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          showItemsPerPage={true}
        />
      )}
    </div>
  );
}

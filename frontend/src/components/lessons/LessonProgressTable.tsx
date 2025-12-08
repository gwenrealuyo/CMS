import { useState, useMemo, useEffect } from "react";
import { PersonProgressSummary, LessonPersonSummary } from "@/src/types/lesson";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import Pagination from "@/src/components/ui/Pagination";
import { formatPersonName } from "@/src/lib/name";
import { Squares2X2Icon, TableCellsIcon } from "@heroicons/react/24/outline";

interface LessonProgressTableProps {
  groupedProgress: PersonProgressSummary[];
  loading: boolean;
  error?: string | null;
  onPersonClick: (person: LessonPersonSummary) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 25;

export default function LessonProgressTable({
  groupedProgress,
  loading,
  error,
  onPersonClick,
}: LessonProgressTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  // View mode toggle - Initialize based on screen size (cards for mobile, table for desktop)
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });

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
        No participants have been assigned to lessons yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Toggle - Mobile Only */}
      <div className="md:hidden flex items-center justify-end">
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("cards")}
            className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
              viewMode === "cards"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Card View"
          >
            <Squares2X2Icon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
              viewMode === "table"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Table View"
          >
            <TableCellsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Card View - Mobile Only */}
      {viewMode === "cards" && (
        <div className="md:hidden space-y-3">
          {paginatedProgress.map((summary) => {
            const personName = formatPersonName(summary.person);
            const progressText = `Completed ${summary.completedCount} of ${summary.totalLessons}`;

            return (
              <div
                key={summary.person.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="space-y-3">
                  {/* Person Name */}
                  <div>
                    <button
                      type="button"
                      onClick={() => onPersonClick(summary.person)}
                      className="text-left font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-base break-words"
                    >
                      {personName}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Member ID:{" "}
                      {summary.person.member_id?.trim()
                        ? summary.person.member_id
                        : summary.person.id ?? "N/A"}
                    </p>
                  </div>

                  {/* Fields in Two Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">
                        Current Lesson
                      </span>
                      {summary.currentLesson ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {summary.currentLesson.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Lesson {summary.currentLesson.order}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">—</p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">
                        Next Lesson
                      </span>
                      {summary.nextLesson ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {summary.nextLesson.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Lesson {summary.nextLesson.order}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">
                          All lessons completed
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-500">
                        Progress
                      </span>
                      <span className="text-xs font-medium text-gray-900">
                        {progressText}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${summary.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View - Mobile when table selected, always on desktop */}
      <div
        className={`overflow-x-auto border rounded-lg ${
          viewMode === "cards" ? "hidden md:block" : ""
        }`}
      >
        <table className="w-full min-w-[900px] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[25%]">
                Person
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[30%]">
                Current Lesson
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[20%]">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[25%]">
                Next Lesson
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProgress.map((summary) => {
              const personName = formatPersonName(summary.person);
              const progressText = `Completed ${summary.completedCount} of ${summary.totalLessons}`;

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
                          : summary.person.id ?? "N/A"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {summary.currentLesson ? (
                      <div className="min-w-0 space-y-1.5">
                        <div className="font-medium break-words">
                          {summary.currentLesson.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          Lesson {summary.currentLesson.order}
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

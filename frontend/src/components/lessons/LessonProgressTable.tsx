import { useState, useMemo, useEffect } from "react";
import { PersonProgressSummary, LessonPersonSummary } from "@/src/types/lesson";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import Pagination from "@/src/components/ui/Pagination";
import { formatPersonName } from "@/src/lib/name";

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
      <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
        No participants have been assigned to lessons yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Person
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Current Lesson
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Next Lesson
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProgress.map((summary) => {
              const personName = formatPersonName(summary.person);
              const progressText = `Completed ${summary.completedCount} of ${summary.totalLessons}`;

              return (
                <tr key={summary.person.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => onPersonClick(summary.person)}
                        className="text-left font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
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
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {summary.currentLesson ? (
                      <div>
                        <div className="font-medium">
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
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{progressText}</div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${summary.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {summary.nextLesson ? (
                      <div>
                        <div className="font-medium">
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

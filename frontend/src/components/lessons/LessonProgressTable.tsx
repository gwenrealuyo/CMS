import { useState, useMemo, useEffect } from "react";
import { LessonProgressStatus, PersonLessonProgress } from "@/src/types/lesson";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import Pagination from "@/src/components/ui/Pagination";
import { formatPersonName } from "@/src/lib/name";

const STATUS_LABELS: Record<LessonProgressStatus, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

const STATUS_COLORS: Record<LessonProgressStatus, string> = {
  ASSIGNED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

interface LessonProgressTableProps {
  progress: PersonLessonProgress[];
  loading: boolean;
  error?: string | null;
  onMarkCompleted: (progress: PersonLessonProgress) => void;
  onUpdateStatus: (
    progress: PersonLessonProgress,
    status: LessonProgressStatus
  ) => void;
  onCommitmentToggleRequest: (progress: PersonLessonProgress) => void;
  isUpdating?: boolean;
  onLogSession?: (progress: PersonLessonProgress) => void;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 25;

export default function LessonProgressTable({
  progress,
  loading,
  error,
  onMarkCompleted,
  onUpdateStatus,
  onCommitmentToggleRequest,
  isUpdating = false,
  onLogSession,
}: LessonProgressTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const paginatedProgress = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return progress.slice(startIndex, endIndex);
  }, [progress, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(progress.length / itemsPerPage);

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

  if (progress.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
        No participants have been assigned to this lesson yet.
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
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Assigned
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Completed
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Commitment
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProgress.map((record) => {
            const personName = formatPersonName(record.person);
            const statusLabel = STATUS_LABELS[record.status];
            const badgeClass = STATUS_COLORS[record.status];

            return (
              <tr key={record.id}>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#2D3748]">
                      {personName}
                    </span>
                    <span className="text-xs text-gray-500">
                      Member ID:{" "}
                      {record.person?.member_id?.trim()
                        ? record.person.member_id
                        : record.person?.id ?? "N/A"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
                  >
                    {statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {record.assigned_at
                    ? new Date(record.assigned_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {record.completed_at
                    ? new Date(record.completed_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                  <span className="block truncate" title={record.notes}>
                    {record.notes || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      checked={record.commitment_signed}
                      onClick={(event) => {
                        event.preventDefault();
                        onCommitmentToggleRequest(record);
                      }}
                      disabled={isUpdating}
                    />
                    <span>Signed</span>
                  </label>
                  {record.commitment_signed_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(record.commitment_signed_at).toLocaleString()}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className="flex justify-end gap-2">
                    {onLogSession && (
                      <Button
                        variant="tertiary"
                        className="text-xs"
                        onClick={() => onLogSession(record)}
                      >
                        Log Session
                      </Button>
                    )}
                    {record.status !== "COMPLETED" && (
                      <Button
                        variant="primary"
                        className="text-xs"
                        onClick={() => onMarkCompleted(record)}
                        disabled={isUpdating}
                      >
                        Mark Completed
                      </Button>
                    )}
                    {record.status !== "IN_PROGRESS" &&
                      record.status !== "COMPLETED" && (
                        <Button
                          variant="tertiary"
                          className="text-xs"
                          onClick={() => onUpdateStatus(record, "IN_PROGRESS")}
                          disabled={isUpdating}
                        >
                          Start
                        </Button>
                      )}
                    {record.status !== "ASSIGNED" && (
                      <Button
                        variant="tertiary"
                        className="text-xs"
                        onClick={() => onUpdateStatus(record, "ASSIGNED")}
                        disabled={isUpdating}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
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
        totalItems={progress.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        showItemsPerPage={true}
      />
    )}
  </div>
  );
}

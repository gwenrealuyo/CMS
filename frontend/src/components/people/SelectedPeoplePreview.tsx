import React, { useState, useMemo } from "react";
import { Person } from "@/src/types/person";

interface SelectedPeoplePreviewProps {
  selectedPeople: Person[];
  onClearSelection: () => void;
}

export default function SelectedPeoplePreview({
  selectedPeople,
  onClearSelection,
}: SelectedPeoplePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Summary statistics - hooks must be called before any conditional returns
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPeople.forEach((person) => {
      counts[person.status] = (counts[person.status] || 0) + 1;
    });
    return counts;
  }, [selectedPeople]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPeople.forEach((person) => {
      counts[person.role] = (counts[person.role] || 0) + 1;
    });
    return counts;
  }, [selectedPeople]);

  // Early return after all hooks have been called
  if (selectedPeople.length === 0) return null;

  const getInitials = (person: Person) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(selectedPeople.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedPeople = selectedPeople.slice(startIndex, endIndex);

  const shouldShowPagination = selectedPeople.length > itemsPerPage;
  const shouldShowSummary = selectedPeople.length > 3;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-blue-900">
            Selected People ({selectedPeople.length})
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
          {shouldShowSummary && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center space-x-1 min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-0 rounded-lg sm:rounded-none bg-white sm:bg-transparent border border-blue-200 sm:border-0"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <span>{isExpanded ? "Hide Summary" : "Show Summary"}</span>
            </button>
          )}
          <button
            onClick={onClearSelection}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center justify-center space-x-1 min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-0 rounded-lg sm:rounded-none bg-white sm:bg-transparent border border-blue-200 sm:border-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Clear Selection</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      {shouldShowSummary && isExpanded && (
        <div className="mb-3 p-2 sm:p-3 bg-white rounded-lg border border-blue-100">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
            Selection Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-medium text-gray-600 mb-1">
                By Status
              </h5>
              <div className="space-y-1">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between text-xs"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full ${getStatusColor(
                        status
                      )}`}
                    >
                      {status.toLowerCase()}
                    </span>
                    <span className="text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h5 className="text-xs font-medium text-gray-600 mb-1">
                By Role
              </h5>
              <div className="space-y-1">
                {Object.entries(roleCounts).map(([role, count]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between text-xs"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full ${getRoleColor(
                        role
                      )}`}
                    >
                      {role.toLowerCase()}
                    </span>
                    <span className="text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* People Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {displayedPeople.map((person) => (
          <div
            key={person.id}
            className="bg-white rounded-lg p-2.5 sm:p-2.5 md:p-2.5 border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                {getInitials(person)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-gray-900 truncate">
                  {person.first_name} {person.last_name}
                </h4>
                {/* <p className="text-xs text-gray-500 truncate">{person.email || "-"}</p> */}
                <div className="flex flex-nowrap items-center gap-0.5 md:gap-1 mt-1">
                  <span
                    className={`px-1 md:px-1.5 py-0.5 rounded-full text-xs md:text-[10px] font-medium whitespace-nowrap ${getStatusColor(
                      person.status
                    )}`}
                  >
                    {person.status.toLowerCase()}
                  </span>
                  <span
                    className={`px-1 md:px-1.5 py-0.5 rounded-full text-xs md:text-[10px] font-medium whitespace-nowrap ${getRoleColor(
                      person.role
                    )}`}
                  >
                    {person.role.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {shouldShowPagination && (
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-blue-600 text-center sm:text-left">
            Showing {startIndex + 1}-{Math.min(endIndex, selectedPeople.length)}{" "}
            of {selectedPeople.length} selected people
          </div>
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1 text-xs rounded-md bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-2 sm:py-1 text-xs rounded-md bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

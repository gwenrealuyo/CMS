import React from "react";
import Button from "./Button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = false,
  className = "",
}: PaginationProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  if (totalPages <= 1 && !showItemsPerPage) {
    return null;
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
        <span className="font-medium">{endIndex}</span> of{" "}
        <span className="font-medium">{totalItems}</span> results
      </div>

      <div className="flex items-center gap-2">
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2 mr-0 md:mr-4">
            <label
              htmlFor="items-per-page"
              className="text-sm text-gray-600 hidden sm:inline"
            >
              Items per page:
            </label>
            <label
              htmlFor="items-per-page"
              className="text-sm text-gray-600 sm:hidden"
            >
              Per page:
            </label>
            <select
              id="items-per-page"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-2 md:py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px] md:min-h-0"
              aria-label="Items per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
            aria-label="Previous page"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <span className="px-3 py-2 text-sm text-gray-700 min-h-[44px] md:min-h-0 flex items-center">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
            aria-label="Next page"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | [string, string];
  label: string;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: FilterCondition[];
  onRemoveFilter: (filterId: string) => void;
  onClearAllFilters: () => void;
  onAddFilter: (anchorRect: DOMRect) => void;
  isSearching?: boolean;
}

export default function FilterBar({
  searchQuery,
  onSearchChange,
  activeFilters,
  onRemoveFilter,
  onClearAllFilters,
  onAddFilter,
  isSearching = false,
}: FilterBarProps) {
  const getFilterChipColor = (field: string) => {
    switch (field) {
      case "status":
        return "bg-green-100 text-green-800 border-green-200";
      case "role":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "date_first_attended":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "email":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "phone":
        return "bg-pink-100 text-pink-800 border-pink-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case "is":
        return "is";
      case "is_not":
        return "is not";
      case "contains":
        return "contains";
      case "between":
        return "between";
      case "before":
        return "before";
      case "after":
        return "after";
      default:
        return operator;
    }
  };

  const formatFilterValue = (filter: FilterCondition) => {
    if (Array.isArray(filter.value)) {
      return `${filter.value[0]} - ${filter.value[1]}`;
    }
    return filter.value;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`block w-full pl-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
              searchQuery ? "pr-10" : "pr-3"
            }`}
          />
          {isSearching ? (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="w-4 h-4 animate-spin text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Filters:</span>

          {activeFilters.length === 0 ? (
            <span className="text-sm text-gray-500 italic">
              No filters applied
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <div
                  key={filter.id}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getFilterChipColor(
                    filter.field
                  )}`}
                >
                  <span className="mr-1">
                    {filter.label} {getOperatorLabel(filter.operator)}{" "}
                    {formatFilterValue(filter)}
                  </span>
                  <button
                    onClick={() => onRemoveFilter(filter.id)}
                    className="ml-1 hover:opacity-75 transition-opacity"
                  >
                    <svg
                      className="w-3 h-3"
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
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {activeFilters.length > 0 && (
            <button
              onClick={onClearAllFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Clear All
            </button>
          )}

          <button
            onClick={(e) =>
              onAddFilter(
                (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
              )
            }
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Filter
          </button>
        </div>
      </div>
    </div>
  );
}

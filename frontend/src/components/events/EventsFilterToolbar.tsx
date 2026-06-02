"use client";

import React from "react";

export type EventTypeFilterOption = {
  value: string;
  label: string;
};

export type MonthFilterOption = {
  value: string;
  label: string;
};

export type YearFilterOption = {
  value: string;
  label: string;
};

export type EventsFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

interface EventsFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: string;
  typeOptions: EventTypeFilterOption[];
  onTypeChange: (value: string) => void;
  filterMonth: string;
  monthOptions: MonthFilterOption[];
  onMonthChange: (value: string) => void;
  filterYear: string;
  yearOptions: YearFilterOption[];
  onYearChange: (value: string) => void;
  chips: EventsFilterChip[];
  onClearAll: () => void;
  isSearching: boolean;
  showClearAll: boolean;
  resultCount?: number;
  totalCount?: number;
}

export default function EventsFilterToolbar({
  searchQuery,
  onSearchChange,
  filterType,
  typeOptions,
  onTypeChange,
  filterMonth,
  monthOptions,
  onMonthChange,
  filterYear,
  yearOptions,
  onYearChange,
  chips,
  onClearAll,
  isSearching,
  showClearAll,
  resultCount,
  totalCount,
}: EventsFilterToolbarProps) {
  const showResultCount =
    resultCount !== undefined &&
    (searchQuery ||
      filterType !== "all" ||
      chips.some(
        (c) => c.id === "date" || c.id === "month" || c.id === "year"
      ));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 shadow-sm mb-4 md:mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
        <div className="relative w-full md:flex-1 md:min-w-0">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-10 py-2.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0 ${
              searchQuery ? "pr-10" : "pr-4"
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
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
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row md:contents">
          <select
            value={filterMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full sm:flex-1 md:w-[9.5rem] md:flex-none py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            aria-label="Filter by month"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full sm:w-[6.5rem] md:w-[6.5rem] md:flex-none py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            aria-label="Filter by year"
          >
            {yearOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full sm:flex-1 md:w-[11rem] md:flex-none py-2.5 md:py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-base md:text-sm min-h-[44px] md:min-h-0"
            aria-label="Filter by event type"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {showClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-4 py-2.5 md:py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors min-h-[44px] md:min-h-0 w-full sm:w-auto md:flex-none shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium chip-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-2 text-primary hover:text-primary"
                aria-label={`Remove ${chip.label} filter`}
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
            </span>
          ))}
        </div>
      )}

      {showResultCount && (
        <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
          <span>
            {isSearching
              ? "Searching..."
              : `${resultCount} event${resultCount !== 1 ? "s" : ""} found`}
          </span>
          {totalCount !== undefined && resultCount !== totalCount && (
            <span className="text-gray-400">(of {totalCount} total)</span>
          )}
        </div>
      )}
    </div>
  );
}

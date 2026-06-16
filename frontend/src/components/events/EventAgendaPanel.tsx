"use client";

import Button from "@/src/components/ui/Button";
import { AgendaGroups, EventCardItem } from "@/src/lib/events/agenda";
import EventAgendaRow from "@/src/components/events/EventAgendaRow";

interface EventAgendaPanelProps {
  groups: AgendaGroups;
  loading: boolean;
  hasActiveFilters: boolean;
  selectedDate: Date | null;
  onView: (item: EventCardItem) => void;
  onClearDate?: () => void;
  onCreateEvent?: () => void;
}

export default function EventAgendaPanel({
  groups,
  loading,
  hasActiveFilters,
  selectedDate,
  onView,
  onClearDate,
  onCreateEvent,
}: EventAgendaPanelProps) {
  const totalItems = groups.totalCount;
  const isSparseDesktop = totalItems > 0 && totalItems <= 3;
  const rowSize = isSparseDesktop ? "comfortable" : "compact";

  return (
    <div
      className={[
        "bg-white rounded-xl border border-gray-200 shadow-sm lg:sticky lg:top-6 flex flex-col min-h-0",
        isSparseDesktop
          ? "lg:overflow-visible"
          : "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto",
      ].join(" ")}
    >
      <div className="px-4 md:px-6 py-4 border-b border-gray-100 shrink-0">
        <h2 className="text-base md:text-lg font-semibold text-foreground">
          {groups.title}
        </h2>
      </div>

      <div
        className={[
          "flex-1 px-2 md:px-4 py-2",
          isSparseDesktop ? "lg:flex lg:flex-col" : "",
        ].join(" ")}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-gray-500">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
              <span>Loading events...</span>
            </div>
          </div>
        ) : totalItems === 0 ? (
          <div className="px-2 py-8 text-center">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">
              {selectedDate
                ? "No events on this day"
                : groups.mode === "month"
                  ? "No events this month"
                  : groups.mode === "year"
                    ? "No events this year"
                    : hasActiveFilters
                      ? "No events found"
                      : "No upcoming events"}
            </p>
            <p className="text-gray-500 mb-6 text-sm">
              {selectedDate
                ? "Try selecting another date or clear the date filter."
                : hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Get started by creating your first church event."}
            </p>
            {selectedDate && onClearDate && (
              <Button
                variant="tertiary"
                onClick={onClearDate}
                className="w-full sm:w-auto min-h-[44px] mb-3"
              >
                Show upcoming events
              </Button>
            )}
            {!hasActiveFilters && !selectedDate && onCreateEvent && (
              <Button onClick={onCreateEvent} className="w-full min-h-[44px]">
                Create Event
              </Button>
            )}
          </div>
        ) : (
          <div
            className={[
              "space-y-3 pb-4",
              isSparseDesktop
                ? "lg:flex lg:flex-col lg:flex-1 lg:justify-center lg:gap-4 lg:space-y-0"
                : "",
            ].join(" ")}
          >
            {groups.sections.map((section) => (
              <div key={section.label}>
                {groups.mode !== "day" && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-1.5 px-3 sticky top-0 bg-white z-10">
                    {section.label}
                  </h3>
                )}
                <div
                  className={[
                    "flex flex-col gap-2",
                    isSparseDesktop ? "lg:gap-4" : "",
                  ].join(" ")}
                >
                  {section.items.map((item) => (
                    <EventAgendaRow
                      key={item.id}
                      event={item.event}
                      occurrenceStartDate={item.occurrence.start_date}
                      occurrenceEndDate={item.occurrence.end_date}
                      onClick={() => onView(item)}
                      size={rowSize}
                    />
                  ))}
                </div>
              </div>
            ))}
            {groups.truncated && (
              <p className="text-xs text-gray-500 text-center px-3 py-2">
                Showing the next 100 upcoming events within 90 days.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

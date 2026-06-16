"use client";

import { Event } from "@/src/types/event";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";

export type EventAgendaRowSize = "compact" | "comfortable";

interface EventAgendaRowProps {
  event: Event;
  occurrenceStartDate: string;
  occurrenceEndDate: string;
  onClick: () => void;
  size?: EventAgendaRowSize;
}

function shouldShowTypeChip(event: Event): boolean {
  const typeLabel = (event.type_display || event.type).trim().toLowerCase();
  return typeLabel !== event.title.trim().toLowerCase();
}

function EventMeta({
  event,
  size = "compact",
}: {
  event: Event;
  size?: EventAgendaRowSize;
}) {
  const { getChipStyle } = useEventTypeStyles();
  const showChip = shouldShowTypeChip(event);
  const metaTextClass =
    size === "comfortable" ? "text-xs lg:text-sm" : "text-xs";

  return (
    <>
      {showChip && (
        <span style={getChipStyle(event.type, "sm")}>
          {event.type_display || event.type}
        </span>
      )}
      {event.is_recurring && (
        <span
          className={`${metaTextClass} text-gray-400 shrink-0`}
          title="Recurring"
        >
          🔁
        </span>
      )}
      {event.location && (
        <span
          className={`${metaTextClass} text-gray-500 truncate max-w-[140px] sm:max-w-[180px] lg:max-w-none`}
        >
          {event.location}
        </span>
      )}
    </>
  );
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toOccurrenceDateKey(isoDateTime: string): string {
  return new Date(isoDateTime).toISOString().split("T")[0];
}

function getOccurrenceAttendanceCount(
  event: Event,
  occurrenceStartDate: string
): number {
  const dateKey = toOccurrenceDateKey(occurrenceStartDate);
  return (event.attendance_records ?? []).filter(
    (record) => record.occurrence_date === dateKey
  ).length;
}

function EventComfortableDetails({
  event,
  occurrenceStartDate,
}: {
  event: Event;
  occurrenceStartDate: string;
}) {
  const { getChipStyle } = useEventTypeStyles();
  const attendeeCount = getOccurrenceAttendanceCount(event, occurrenceStartDate);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={getChipStyle(event.type, "sm")}>
          {event.type_display || event.type}
        </span>
        {event.is_recurring && (
          <span className="text-sm text-gray-500">Recurring weekly</span>
        )}
      </div>

      {event.description?.trim() && (
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {event.description}
        </p>
      )}

      {event.location?.trim() && (
        <div className="flex items-start gap-1.5 text-sm text-gray-600 min-w-0">
          <svg
            className="w-4 h-4 mt-0.5 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="line-clamp-2">{event.location}</span>
        </div>
      )}

      <div
        className={`flex items-center gap-1.5 text-sm ${
          attendeeCount === 0 ? "text-gray-400" : "text-gray-500"
        }`}
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span>
          {attendeeCount} {attendeeCount === 1 ? "attendee" : "attendees"}
        </span>
      </div>
    </div>
  );
}

export default function EventAgendaRow({
  event,
  occurrenceStartDate,
  occurrenceEndDate,
  onClick,
  size = "compact",
}: EventAgendaRowProps) {
  const isComfortable = size === "comfortable";
  const startTime = formatTime(occurrenceStartDate);
  const endTime = formatTime(occurrenceEndDate);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={[
        "flex w-full gap-3 min-h-[44px] px-3 py-2.5 rounded-lg border border-gray-200 bg-white",
        "hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-colors text-left",
        isComfortable
          ? "lg:px-5 lg:py-4 lg:min-h-[112px] lg:gap-4 lg:items-start"
          : "sm:items-center sm:py-2",
      ].join(" ")}
    >
      <span
        className={[
          "shrink-0 w-16 pt-0.5 sm:pt-0 text-sm font-medium text-gray-700 tabular-nums",
          isComfortable ? "lg:w-24 lg:pt-1" : "",
        ].join(" ")}
      >
        <span className={isComfortable ? "lg:block lg:text-base" : ""}>
          {startTime}
        </span>
        {isComfortable && (
          <span className="hidden lg:block text-sm text-gray-500 mt-1">
            to {endTime}
          </span>
        )}
      </span>

      {/* Mobile: title + meta stacked */}
      <span className="flex-1 min-w-0 sm:hidden">
        <span className="block text-sm font-medium text-foreground line-clamp-2">
          {event.title}
        </span>
        <span className="flex items-center gap-2 mt-1 min-w-0 flex-wrap">
          <EventMeta event={event} size={size} />
        </span>
      </span>

      {/* Desktop compact: title + inline meta */}
      <span
        className={[
          "hidden sm:flex flex-1 min-w-0 items-center gap-2",
          isComfortable ? "lg:hidden" : "",
        ].join(" ")}
      >
        <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1">
          {event.title}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <EventMeta event={event} size={size} />
        </span>
      </span>

      {/* Desktop comfortable: title + meta stacked */}
      {isComfortable && (
        <span className="hidden lg:flex flex-1 flex-col min-w-0 gap-2">
          <span className="text-base font-semibold text-foreground line-clamp-2">
            {event.title}
          </span>
          <EventComfortableDetails
            event={event}
            occurrenceStartDate={occurrenceStartDate}
          />
        </span>
      )}
    </button>
  );
}

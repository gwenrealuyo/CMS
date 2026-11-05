"use client";

import { Event } from "@/src/types/event";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";
import EventRecurringChip from "@/src/components/events/EventRecurringChip";
import YouWerePresentChip from "@/src/components/events/YouWerePresentChip";
import {
  occurrenceDateKey,
  viewerAttendanceForOccurrence,
} from "@/src/lib/events/viewerAttendance";

export type EventAgendaRowSize = "compact" | "comfortable";

interface EventAgendaRowProps {
  event: Event;
  occurrenceStartDate: string;
  occurrenceEndDate: string;
  onClick: () => void;
  size?: EventAgendaRowSize;
  highlighted?: boolean;
  continues?: boolean;
}

function shouldShowTypeChip(event: Event): boolean {
  const typeLabel = (event.type_display || event.type).trim().toLowerCase();
  return typeLabel !== event.title.trim().toLowerCase();
}

function ContinuesChip() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-600 bg-white border border-dashed border-gray-400">
      Continues
    </span>
  );
}

function PendingChip({ size = "sm" }: { size?: "sm" | "md" }) {
  const className =
    size === "sm"
      ? "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
      : "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200";
  return <span className={className}>Pending</span>;
}

function EventMeta({
  event,
  size = "compact",
  viewerPresent = false,
  viewerMode = null,
  continues = false,
}: {
  event: Event;
  size?: EventAgendaRowSize;
  viewerPresent?: boolean;
  viewerMode?: ReturnType<typeof viewerAttendanceForOccurrence>["mode"];
  continues?: boolean;
}) {
  const { getChipStyle } = useEventTypeStyles();
  const showChip = shouldShowTypeChip(event);
  const metaTextClass =
    size === "comfortable" ? "text-xs lg:text-sm" : "text-xs";

  return (
    <>
      {continues && <ContinuesChip />}
      {showChip && (
        <span style={getChipStyle(event.type, "sm")}>
          {event.type_display || event.type}
        </span>
      )}
      {event.is_recurring && (
        <EventRecurringChip
          size="sm"
          pattern={event.recurrence_pattern}
        />
      )}
      {event.booking_status === "pending" && <PendingChip />}
      {viewerPresent && <YouWerePresentChip size="sm" mode={viewerMode} />}
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return "";
  if (Number.isNaN(end.getTime())) return formatTime(start);

  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (isSameLocalCalendarDay(start, end)) {
    const [startClock, startMeridiem = ""] = startTime.split(" ");
    const [, endMeridiem = ""] = endTime.split(" ");
    if (startMeridiem && startMeridiem === endMeridiem) {
      return `${startClock} – ${endTime}`;
    }
    return `${startTime} – ${endTime}`;
  }

  const endDate = end.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${startTime} – ${endDate}, ${endTime}`;
}

function getOccurrenceAttendanceCount(
  event: Event,
  occurrenceStartDate: string
): number {
  const dateKey = occurrenceDateKey(occurrenceStartDate);
  return (event.attendance_records ?? []).filter(
    (record) => record.occurrence_date === dateKey
  ).length;
}

function EventComfortableDetails({
  event,
  occurrenceStartDate,
  viewerPresent,
  viewerMode,
  continues = false,
}: {
  event: Event;
  occurrenceStartDate: string;
  viewerPresent: boolean;
  viewerMode: ReturnType<typeof viewerAttendanceForOccurrence>["mode"];
  continues?: boolean;
}) {
  const { getChipStyle } = useEventTypeStyles();
  const attendeeCount = getOccurrenceAttendanceCount(event, occurrenceStartDate);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        {continues && <ContinuesChip />}
        <span style={getChipStyle(event.type, "sm")}>
          {event.type_display || event.type}
        </span>
        {event.is_recurring && (
          <EventRecurringChip
            size="sm"
            pattern={event.recurrence_pattern}
          />
        )}
        {event.booking_status === "pending" && <PendingChip />}
        {viewerPresent && <YouWerePresentChip size="sm" mode={viewerMode} />}
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
  highlighted = false,
  continues = false,
}: EventAgendaRowProps) {
  const { user } = useAuth();
  const isComfortable = size === "comfortable";
  const timeRange = formatTimeRange(occurrenceStartDate, occurrenceEndDate);
  const viewerAttendance = viewerAttendanceForOccurrence(
    event,
    user?.id,
    occurrenceStartDate,
  );

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
        "flex w-full gap-3 min-h-[44px] px-3 py-2.5 rounded-lg border shadow-sm transition-colors text-left",
        continues && highlighted
          ? "border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10"
          : continues
            ? "border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            : highlighted
              ? "border-primary/30 bg-primary/10 hover:border-primary/40 hover:bg-primary/15"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
        isComfortable
          ? "lg:px-5 lg:py-4 lg:min-h-[112px] lg:gap-4 lg:items-start"
          : "sm:items-center sm:py-2",
      ].join(" ")}
    >
      <span
        className={[
          "shrink-0 self-center whitespace-nowrap text-sm font-medium text-gray-700 tabular-nums",
          isComfortable ? "lg:text-base" : "",
        ].join(" ")}
      >
        {timeRange}
      </span>

      {/* Mobile: title + meta stacked */}
      <span className="flex-1 min-w-0 sm:hidden">
        <span className="block text-sm font-medium text-foreground line-clamp-2">
          {event.title}
        </span>
        <span className="flex items-center gap-2 mt-1 min-w-0 flex-wrap">
          <EventMeta
            event={event}
            size={size}
            viewerPresent={viewerAttendance.present}
            viewerMode={viewerAttendance.mode}
            continues={continues}
          />
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
          <EventMeta
            event={event}
            size={size}
            viewerPresent={viewerAttendance.present}
            viewerMode={viewerAttendance.mode}
            continues={continues}
          />
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
            viewerPresent={viewerAttendance.present}
            viewerMode={viewerAttendance.mode}
            continues={continues}
          />
        </span>
      )}
    </button>
  );
}

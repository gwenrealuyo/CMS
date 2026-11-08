"use client";

import { Event } from "@/src/types/event";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";
import EventRecurringChip from "@/src/components/events/EventRecurringChip";
import YouWerePresentChip from "@/src/components/events/YouWerePresentChip";
import { formatRecurrenceSummary } from "@/src/lib/events/recurrenceLabel";
import {
  occurrenceDateKey,
  viewerAttendanceForOccurrence,
} from "@/src/lib/events/viewerAttendance";

function formatAgendaLocation(event: Event): string {
  const location = event.location?.trim() ?? "";
  const room = event.room_name?.trim() ?? "";
  const branch = event.branch_name?.trim() ?? "";
  const branchHasHq = branch ? /\bhq\b/i.test(branch) : false;
  const branchLabel =
    branch && event.branch_is_headquarters && !branchHasHq
      ? `${branch} (HQ)`
      : branch;

  const parts: string[] = [];
  if (room) parts.push(room);
  if (location && (!room || !location.toLowerCase().includes(room.toLowerCase()))) {
    parts.push(location);
  }
  let display = parts.join(" · ");
  if (
    branchLabel &&
    !display.toLowerCase().includes(branchLabel.toLowerCase())
  ) {
    display = display ? `${display} - ${branchLabel}` : branchLabel;
  }
  return display;
}

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

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole local calendar days between start and end (0 = same day). */
function localCalendarDayDiff(start: Date, end: Date): number {
  const ms =
    startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime();
  return Math.round(ms / 86_400_000);
}

function formatEndDateLabel(end: Date): string {
  return end.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type AgendaTimeLabel = {
  /** Compact single-line label (or primary line). */
  primary: string;
  /** Optional second line for comfortable / multi-day. */
  secondary?: string;
  /** True when the range fits a short same-day-style time column. */
  shortColumn: boolean;
};

/**
 * Same-day and overnight use a stacked start → end time so the title column
 * stays wide. Overnight adds a weekday on the end line; same-day does not.
 * Continuation rows show "until …" instead of repeating the full range.
 */
function formatAgendaTimeLabel(
  startIso: string,
  endIso: string,
  options?: { continues?: boolean }
): AgendaTimeLabel {
  const continues = Boolean(options?.continues);
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) {
    return { primary: "", shortColumn: true };
  }
  if (Number.isNaN(end.getTime())) {
    return { primary: formatTime(start), shortColumn: true };
  }

  const dayDiff = localCalendarDayDiff(start, end);
  const startTime = formatTime(start);
  const endTime = formatTime(end);

  if (continues) {
    if (dayDiff <= 1) {
      return { primary: `until ${endTime}`, shortColumn: true };
    }
    return {
      primary: `until ${formatEndDateLabel(end)}`,
      secondary: endTime,
      shortColumn: false,
    };
  }

  // Same calendar day: stacked times, no weekday.
  if (dayDiff === 0) {
    return {
      primary: startTime,
      secondary: `→ ${endTime}`,
      shortColumn: false,
    };
  }

  // Overnight: stacked times with weekday on the end line only.
  if (dayDiff === 1) {
    const endWeekday = end.toLocaleDateString("en-US", { weekday: "short" });
    return {
      primary: startTime,
      secondary: `→ ${endWeekday} ${endTime}`,
      shortColumn: false,
    };
  }

  return {
    primary: startTime,
    secondary: `${formatEndDateLabel(end)}, ${endTime}`,
    shortColumn: false,
  };
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
  const locationDisplay = formatAgendaLocation(event);
  const recurrenceSummary =
    event.is_recurring && event.recurrence_pattern
      ? formatRecurrenceSummary(event.recurrence_pattern)
      : "";
  const attendanceFormatLabel =
    event.attendance_format === "online_only"
      ? "Online only"
      : event.attendance_format === "onsite_only"
        ? "Onsite only"
        : event.attendance_format === "hybrid"
          ? "Hybrid"
          : null;

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
        {attendanceFormatLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200">
            {attendanceFormatLabel}
          </span>
        )}
        {viewerPresent && <YouWerePresentChip size="sm" mode={viewerMode} />}
      </div>

      {event.description?.trim() && (
        <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
          {event.description}
        </p>
      )}

      {locationDisplay && (
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
          <span className="line-clamp-2">{locationDisplay}</span>
        </div>
      )}

      {recurrenceSummary && (
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="line-clamp-2">{recurrenceSummary}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
        {event.estimated_headcount != null && (
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{event.estimated_headcount} estimated</span>
          </div>
        )}

        <div
          className={`flex items-center gap-1.5 ${
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
  const timeLabel = formatAgendaTimeLabel(
    occurrenceStartDate,
    occurrenceEndDate,
    { continues }
  );
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
        "w-full min-h-[44px] px-3 py-2.5 rounded-lg border shadow-sm transition-colors text-left",
        continues && highlighted
          ? "border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10"
          : continues
            ? "border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            : highlighted
              ? "border-primary/30 bg-primary/10 hover:border-primary/40 hover:bg-primary/15"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
        isComfortable
          ? "grid grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-x-3 sm:gap-x-5 px-4 py-3.5 sm:px-5 sm:py-4"
          : "flex gap-3 sm:items-center sm:py-2",
      ].join(" ")}
    >
      {isComfortable ? (
        <span className="min-w-0 text-sm sm:text-base font-medium text-gray-700 tabular-nums leading-6">
          <span
            className={[
              "block leading-6",
              timeLabel.shortColumn ? "whitespace-nowrap" : "",
            ].join(" ")}
          >
            {timeLabel.primary}
          </span>
          {timeLabel.secondary && (
            <span className="block mt-0.5 text-xs sm:text-sm font-normal text-gray-500 leading-5">
              {timeLabel.secondary}
            </span>
          )}
        </span>
      ) : (
        <span
          className={[
            "shrink-0 self-center text-sm font-medium text-gray-700 tabular-nums",
            timeLabel.shortColumn
              ? "whitespace-nowrap"
              : "w-[4.75rem] sm:w-[5.5rem] leading-snug",
          ].join(" ")}
        >
          <span className="block">{timeLabel.primary}</span>
          {timeLabel.secondary && (
            <span className="block text-xs font-normal text-gray-500">
              {timeLabel.secondary}
            </span>
          )}
        </span>
      )}

      {/* Compact: title + inline/stacked meta */}
      {!isComfortable && (
        <>
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

          <span className="hidden sm:flex flex-1 min-w-0 items-center gap-2">
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
        </>
      )}

      {/* Comfortable / expanded agenda: title + full details */}
      {isComfortable && (
        <span className="flex min-w-0 flex-col gap-2">
          <span className="text-sm sm:text-base font-semibold text-foreground leading-6 line-clamp-2">
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

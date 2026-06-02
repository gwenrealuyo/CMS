"use client";

import { Event } from "@/src/types/event";
import { getEventTypeAgendaChipClass } from "@/src/lib/events/eventTypeStyles";

interface EventAgendaRowProps {
  event: Event;
  occurrenceStartDate: string;
  onClick: () => void;
}

function shouldShowTypeChip(event: Event): boolean {
  const typeLabel = (event.type_display || event.type).trim().toLowerCase();
  return typeLabel !== event.title.trim().toLowerCase();
}

function EventMeta({ event }: { event: Event }) {
  const showChip = shouldShowTypeChip(event);

  return (
    <>
      {showChip && (
        <span className={getEventTypeAgendaChipClass(event.type)}>
          {event.type_display || event.type}
        </span>
      )}
      {event.is_recurring && (
        <span className="text-xs text-gray-400 shrink-0" title="Recurring">
          🔁
        </span>
      )}
      {event.location && (
        <span className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-[180px]">
          {event.location}
        </span>
      )}
    </>
  );
}

export default function EventAgendaRow({
  event,
  occurrenceStartDate,
  onClick,
}: EventAgendaRowProps) {
  const startTime = new Date(occurrenceStartDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

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
      className="flex w-full gap-3 min-h-[44px] px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 shadow-sm transition-colors text-left sm:items-center sm:py-2"
    >
      <span className="shrink-0 w-16 pt-0.5 sm:pt-0 text-sm font-medium text-gray-700 tabular-nums">
        {startTime}
      </span>

      {/* Mobile: title + meta stacked */}
      <span className="flex-1 min-w-0 sm:hidden">
        <span className="block text-sm font-medium text-foreground line-clamp-2">
          {event.title}
        </span>
        <span className="flex items-center gap-2 mt-1 min-w-0">
          <EventMeta event={event} />
        </span>
      </span>

      {/* Desktop: title + inline meta on one row */}
      <span className="hidden sm:flex flex-1 min-w-0 items-center gap-2">
        <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1">
          {event.title}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <EventMeta event={event} />
        </span>
      </span>
    </button>
  );
}

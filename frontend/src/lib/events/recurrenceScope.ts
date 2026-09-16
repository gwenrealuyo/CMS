import { Event, EventOccurrence } from "@/src/types/event";

export type RecurrenceScope = "occurrence" | "following" | "series";

/** Church/local calendar day (YYYY-MM-DD). Never UTC from toISOString. */
export function toDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function occurrenceCalendarDate(
  occurrence: Pick<EventOccurrence, "occurrence_date" | "start_date"> | null
): string | null {
  if (!occurrence) return null;
  if (occurrence.occurrence_date) return toDateKey(occurrence.occurrence_date);
  if (occurrence.start_date) return toDateKey(occurrence.start_date);
  return null;
}

export function isFirstOccurrence(
  event: Pick<Event, "start_date">,
  occurrenceDate: string | null
): boolean {
  if (!event.start_date || !occurrenceDate) return true;
  return toDateKey(event.start_date) === toDateKey(occurrenceDate);
}

export function findOccurrence(event: Event, occurrenceDate: string | null) {
  if (!occurrenceDate) return null;
  const key = toDateKey(occurrenceDate);
  return (
    event.occurrences?.find(
      (occurrence) => occurrenceCalendarDate(occurrence) === key
    ) ?? null
  );
}

export function buildScopedEventDraft(
  event: Event,
  scope: RecurrenceScope,
  occurrenceDate: string | null
): Event {
  const occurrence = findOccurrence(event, occurrenceDate);
  const start_date = occurrence?.start_date ?? event.start_date;
  const end_date = occurrence?.end_date ?? event.end_date;

  if (scope === "occurrence") {
    return {
      ...event,
      start_date,
      end_date,
      is_recurring: false,
      recurrence_pattern: null,
    };
  }

  if (scope === "following") {
    return {
      ...event,
      start_date,
      end_date,
    };
  }

  return event;
}

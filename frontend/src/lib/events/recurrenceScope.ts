import { Event } from "@/src/types/event";

export type RecurrenceScope = "occurrence" | "following" | "series";

export function toDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().split("T")[0];
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
      (occurrence) => toDateKey(occurrence.start_date) === key
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

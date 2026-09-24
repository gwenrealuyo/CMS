import { Event } from "@/src/types/event";

export type ScheduleConflict = {
  kind: "sunday" | "room";
  message: string;
};

function toDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function branchesConflict(
  left?: number | null,
  right?: number | null
): boolean {
  if (left == null || right == null) return true;
  return left === right;
}

type Interval = { start: Date; end: Date };

function draftIntervals(payload: Partial<Event>): Interval[] {
  const start = parseDate(payload.start_date);
  const end = parseDate(payload.end_date);
  if (!start || !end) return [];

  const pattern = payload.recurrence_pattern;
  if (!payload.is_recurring || !pattern?.through) {
    return [{ start, end }];
  }

  const excluded = new Set(pattern.excluded_dates ?? []);
  const durationMs = end.getTime() - start.getTime();
  const through = parseDate(`${pattern.through}T23:59:59`);
  if (!through) return [{ start, end }];

  const intervals: Interval[] = [];
  const intervalWeeks = Math.max(1, pattern.interval ?? 1);
  const cursor = new Date(start);

  if (pattern.frequency === "monthly") {
    return [{ start, end }];
  }

  while (cursor.getTime() <= through.getTime()) {
    const key = toDayKey(cursor);
    if (!excluded.has(key)) {
      intervals.push({
        start: new Date(cursor),
        end: new Date(cursor.getTime() + durationMs),
      });
    }
    cursor.setDate(cursor.getDate() + 7 * intervalWeeks);
  }
  return intervals;
}

function eventIntervals(event: Event): Interval[] {
  if (event.occurrences && event.occurrences.length > 0) {
    return event.occurrences
      .map((occurrence) => {
        const start = parseDate(occurrence.start_date);
        const end = parseDate(occurrence.end_date);
        if (!start || !end) return null;
        return { start, end };
      })
      .filter((interval): interval is Interval => interval != null);
  }
  const start = parseDate(event.start_date);
  const end = parseDate(event.end_date);
  if (!start || !end) return [];
  return [{ start, end }];
}

function shouldSkipExisting(args: {
  event: Event;
  interval: Interval;
  excludeEventId?: string | number | null;
  ignoreOccurrenceDate?: string | null;
  ignoreDatesGte?: string | null;
}): boolean {
  const { event, interval, excludeEventId, ignoreOccurrenceDate, ignoreDatesGte } =
    args;
  if (event.booking_status === "rejected") return true;
  if (excludeEventId == null || String(event.id) !== String(excludeEventId)) {
    return false;
  }
  const day = toDayKey(interval.start);
  if (ignoreOccurrenceDate && day === ignoreOccurrenceDate) return true;
  if (ignoreDatesGte && day >= ignoreDatesGte) return true;
  if (!ignoreOccurrenceDate && !ignoreDatesGte) return true;
  return false;
}

export function findScheduleConflict(args: {
  payload: Partial<Event>;
  events: Event[];
  excludeEventId?: string | number | null;
  ignoreOccurrenceDate?: string | null;
  ignoreDatesGte?: string | null;
}): ScheduleConflict | null {
  const draft = draftIntervals(args.payload);
  if (draft.length === 0) return null;

  const roomId = args.payload.room ?? null;
  const isSunday = args.payload.type === "SUNDAY_SERVICE";
  const branchId = args.payload.branch ?? null;

  for (const existing of args.events) {
    for (const existingInterval of eventIntervals(existing)) {
      if (
        shouldSkipExisting({
          event: existing,
          interval: existingInterval,
          excludeEventId: args.excludeEventId,
          ignoreOccurrenceDate: args.ignoreOccurrenceDate,
          ignoreDatesGte: args.ignoreDatesGte,
        })
      ) {
        continue;
      }
      for (const candidate of draft) {
        if (
          !overlaps(
            candidate.start,
            candidate.end,
            existingInterval.start,
            existingInterval.end
          )
        ) {
          continue;
        }
        const day = toDayKey(candidate.start);
        if (
          isSunday &&
          existing.type === "SUNDAY_SERVICE" &&
          branchesConflict(branchId, existing.branch)
        ) {
          const title = (existing.title || "another Sunday Service").trim();
          const range = `${existingInterval.start.toISOString()} → ${existingInterval.end.toISOString()}`;
          return {
            kind: "sunday",
            message: `A Sunday Service already exists for this branch at this time on ${day} (conflicts with "${title}", ${range}). Edit the existing event instead of creating another.`,
          };
        }
        if (
          roomId != null &&
          existing.room != null &&
          Number(roomId) === Number(existing.room)
        ) {
          const roomName = existing.room_name || existing.location || "This room";
          return {
            kind: "room",
            message: `${roomName} is already booked on ${day} by "${existing.title}". Choose another room or time.`,
          };
        }
      }
    }
  }
  return null;
}

import { Event, RecurrencePattern } from "@/src/types/event";

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

/** When end_date was saved as the series through date, duration spans months. */
function occurrenceDurationMs(
  start: Date,
  end: Date,
  pattern?: RecurrencePattern | null
): number {
  let durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) return 0;

  if (pattern?.frequency === "weekly" && pattern.through) {
    const endDay = toDayKey(end);
    const spanDays = Math.floor(durationMs / (24 * 60 * 60 * 1000));
    if (spanDays >= 7 && endDay >= pattern.through) {
      const sameDayEnd = new Date(start);
      sameDayEnd.setHours(
        end.getHours(),
        end.getMinutes(),
        end.getSeconds(),
        end.getMilliseconds()
      );
      if (sameDayEnd.getTime() > start.getTime()) {
        durationMs = sameDayEnd.getTime() - start.getTime();
      } else {
        durationMs = 2 * 60 * 60 * 1000;
      }
    }
  }

  return durationMs;
}

function expandRecurringIntervals(
  start: Date,
  end: Date,
  pattern: RecurrencePattern
): Interval[] {
  const durationMs = occurrenceDurationMs(start, end, pattern);
  if (durationMs <= 0) return [];

  if (pattern.frequency === "monthly" || !pattern.through) {
    return [{ start, end: new Date(start.getTime() + durationMs) }];
  }

  const excluded = new Set(pattern.excluded_dates ?? []);
  const through = parseDate(`${pattern.through}T23:59:59`);
  if (!through) {
    return [{ start, end: new Date(start.getTime() + durationMs) }];
  }

  const intervals: Interval[] = [];
  const intervalWeeks = Math.max(1, pattern.interval ?? 1);
  const cursor = new Date(start);

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

function draftIntervals(payload: Partial<Event>): Interval[] {
  const start = parseDate(payload.start_date);
  const end = parseDate(payload.end_date);
  if (!start || !end) return [];

  const pattern = payload.recurrence_pattern;
  if (!payload.is_recurring || !pattern?.through) {
    return [{ start, end }];
  }

  return expandRecurringIntervals(start, end, pattern);
}

function eventIntervals(event: Event): Interval[] {
  const pattern = event.recurrence_pattern;

  // Prefer expanding the recurrence pattern so we never treat a weekly
  // series as one continuous block from first start → through/end.
  if (event.is_recurring && pattern?.through) {
    const start = parseDate(event.start_date);
    const end = parseDate(event.end_date);
    if (start && end) {
      return expandRecurringIntervals(start, end, pattern);
    }
  }

  if (event.occurrences && event.occurrences.length > 0) {
    const durationHint =
      pattern && event.start_date && event.end_date
        ? (() => {
            const s = parseDate(event.start_date);
            const e = parseDate(event.end_date);
            return s && e ? occurrenceDurationMs(s, e, pattern) : null;
          })()
        : null;

    return event.occurrences
      .map((occurrence) => {
        const start = parseDate(occurrence.start_date);
        const end = parseDate(occurrence.end_date);
        if (!start || !end) return null;
        if (
          durationHint != null &&
          durationHint > 0 &&
          end.getTime() - start.getTime() > durationHint
        ) {
          return { start, end: new Date(start.getTime() + durationHint) };
        }
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
          return {
            kind: "sunday",
            message: `A Sunday Service already exists for this branch at this time on ${day} (conflicts with "${title}"). Edit the existing event instead of creating another.`,
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

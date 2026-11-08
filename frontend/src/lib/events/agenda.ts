import { Event, EventOccurrence } from "@/src/types/event";

export type EventCardItem = {
  id: string;
  event: Event;
  occurrence: EventOccurrence;
  /** Later day of a multi-day event, shown again so that day is not missed. */
  continues?: boolean;
};

export type AgendaSection = {
  label: string;
  /** Local midnight for the day this section represents. */
  dayTime: number;
  items: EventCardItem[];
};

export type AgendaGroups = {
  mode: "day" | "month" | "year" | "upcoming";
  title: string;
  sections: AgendaSection[];
  totalCount: number;
  truncated: boolean;
};

const UPCOMING_MAX_DAYS = 90;
const UPCOMING_MAX_ITEMS = 100;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when [start, end) overlaps the local calendar day of `day`. */
export function occurrenceTouchesLocalDay(
  start: Date | string,
  end: Date | string | null | undefined,
  day: Date
): boolean {
  const startDate = typeof start === "string" ? new Date(start) : start;
  if (Number.isNaN(startDate.getTime())) return false;

  const endDate =
    end == null || end === ""
      ? startDate
      : typeof end === "string"
        ? new Date(end)
        : end;
  const resolvedEnd =
    Number.isNaN(endDate.getTime()) || endDate.getTime() < startDate.getTime()
      ? startDate
      : endDate;

  const dayStart = startOfLocalDay(day);
  const dayEnd = new Date(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate() + 1
  );

  return startDate < dayEnd && resolvedEnd > dayStart;
}

function sortByStartAsc(items: EventCardItem[]): EventCardItem[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.occurrence.start_date).getTime();
    const dateB = new Date(b.occurrence.start_date).getTime();
    return dateA - dateB;
  });
}

function formatDayLabel(date: Date, now: Date): string {
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameLocalDay(date, today)) return "Today";
  if (isSameLocalDay(date, tomorrow)) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDayTitle(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function eventCountLabel(count: number): string {
  return `${count} event${count !== 1 ? "s" : ""}`;
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Each local day an occurrence overlaps inside [windowStart, windowEnd). */
function listTouchedDays(
  startIso: string,
  endIso: string | null | undefined,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];

  const end = endIso ? new Date(endIso) : start;
  const resolvedEnd =
    Number.isNaN(end.getTime()) || end.getTime() < start.getTime() ? start : end;

  const rangeStart = startOfLocalDay(start);
  const clippedStart =
    rangeStart < windowStart ? startOfLocalDay(windowStart) : rangeStart;

  const endMs =
    resolvedEnd.getTime() === start.getTime()
      ? start.getTime()
      : resolvedEnd.getTime() - 1;
  const lastDay = startOfLocalDay(new Date(Math.max(endMs, start.getTime())));
  const windowLast = new Date(windowEnd.getTime() - 1);
  const clippedEnd =
    lastDay >= windowEnd ? startOfLocalDay(windowLast) : lastDay;

  if (clippedStart > clippedEnd || windowLast.getTime() < windowStart.getTime()) {
    return [];
  }

  const days: Date[] = [];
  const cursor = new Date(clippedStart);
  while (cursor <= clippedEnd && days.length < 366) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Today first, then later days, then earlier days in the same list. */
function orderSectionsWithTodayFirst(
  sections: AgendaSection[],
  now: Date
): AgendaSection[] {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const rank = (section: AgendaSection) => {
    if (section.label === "Today") return 0;
    return section.dayTime >= tomorrowStart.getTime() ? 1 : 2;
  };

  return [...sections].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.dayTime - b.dayTime;
  });
}

function groupItemsByDay(
  items: EventCardItem[],
  now: Date,
  windowStart: Date,
  windowEnd: Date
): { sections: AgendaSection[]; capped: EventCardItem[]; truncated: boolean } {
  const grouped = new Map<string, AgendaSection>();

  for (const item of items) {
    const start = new Date(item.occurrence.start_date);
    const days = listTouchedDays(
      item.occurrence.start_date,
      item.occurrence.end_date,
      windowStart,
      windowEnd
    );

    for (const day of days) {
      const key = localDayKey(day);
      let section = grouped.get(key);
      if (!section) {
        section = {
          label: formatDayLabel(day, now),
          dayTime: startOfLocalDay(day).getTime(),
          items: [],
        };
        grouped.set(key, section);
      }
      // Continues only when one occurrence spans midnight (overnight /
      // continuous). Multi-day daily series emit one same-day occurrence
      // per date from the API, so those rows stay normal cards.
      section.items.push({
        ...item,
        continues:
          !Number.isNaN(start.getTime()) && !isSameLocalDay(start, day),
      });
    }
  }

  return {
    sections: orderSectionsWithTodayFirst(Array.from(grouped.values()), now),
    capped: items,
    truncated: false,
  };
}

export function buildAgendaGroups(
  items: EventCardItem[],
  options: {
    selectedDate: Date | null;
    monthDate?: Date | null;
    yearOnly?: number | null;
    now?: Date;
  }
): AgendaGroups {
  const now = options.now ?? new Date();
  const sorted = sortByStartAsc(items);

  if (options.selectedDate) {
    const dayItems = sorted.filter((item) =>
      occurrenceTouchesLocalDay(
        item.occurrence.start_date,
        item.occurrence.end_date,
        options.selectedDate!
      )
    );

    const selectedDay = startOfLocalDay(options.selectedDate);
    return {
      mode: "day",
      title: `${formatDayTitle(options.selectedDate)} · ${eventCountLabel(dayItems.length)}`,
      sections:
        dayItems.length > 0
          ? [
              {
                label: formatDayTitle(options.selectedDate),
                dayTime: selectedDay.getTime(),
                items: dayItems.map((item) => {
                  const start = new Date(item.occurrence.start_date);
                  return {
                    ...item,
                    continues:
                      !Number.isNaN(start.getTime()) &&
                      !isSameLocalDay(start, selectedDay),
                  };
                }),
              },
            ]
          : [],
      totalCount: dayItems.length,
      truncated: false,
    };
  }

  if (options.monthDate) {
    const monthStart = startOfLocalDay(options.monthDate);
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      1
    );
    const { sections, capped } = groupItemsByDay(
      sorted,
      now,
      monthStart,
      monthEnd
    );

    return {
      mode: "month",
      title: `${formatMonthTitle(options.monthDate)} · ${eventCountLabel(capped.length)}`,
      sections,
      totalCount: capped.length,
      truncated: false,
    };
  }

  if (options.yearOnly) {
    const yearStart = new Date(options.yearOnly, 0, 1);
    const yearEnd = new Date(options.yearOnly + 1, 0, 1);
    const { sections, capped } = groupItemsByDay(sorted, now, yearStart, yearEnd);

    return {
      mode: "year",
      title: `${options.yearOnly} · ${eventCountLabel(capped.length)}`,
      sections,
      totalCount: capped.length,
      truncated: false,
    };
  }

  const startOfToday = startOfLocalDay(now);
  const maxDate = new Date(startOfToday);
  maxDate.setDate(maxDate.getDate() + UPCOMING_MAX_DAYS);

  const windowEnd = new Date(maxDate);
  windowEnd.setDate(windowEnd.getDate() + 1);

  const upcoming = sorted.filter((item) => {
    const start = new Date(item.occurrence.start_date);
    const end = new Date(item.occurrence.end_date || item.occurrence.start_date);
    const resolvedEnd =
      Number.isNaN(end.getTime()) || end.getTime() < start.getTime()
        ? start
        : end;
    return start < windowEnd && resolvedEnd > startOfToday;
  });

  let truncated = upcoming.length > UPCOMING_MAX_ITEMS;
  const capped = truncated
    ? upcoming.slice(0, UPCOMING_MAX_ITEMS)
    : upcoming;

  const { sections } = groupItemsByDay(capped, now, startOfToday, windowEnd);

  return {
    mode: "upcoming",
    title: `Upcoming · ${eventCountLabel(capped.length)}`,
    sections,
    totalCount: capped.length,
    truncated,
  };
}

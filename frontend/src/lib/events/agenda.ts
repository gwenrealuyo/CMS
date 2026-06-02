import { Event, EventOccurrence } from "@/src/types/event";

export type EventCardItem = {
  id: string;
  event: Event;
  occurrence: EventOccurrence;
};

export type AgendaSection = {
  label: string;
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

function groupItemsByDay(
  items: EventCardItem[],
  now: Date
): { sections: AgendaSection[]; capped: EventCardItem[]; truncated: boolean } {
  const grouped = new Map<string, EventCardItem[]>();
  const labelOrder: string[] = [];

  for (const item of items) {
    const occurrenceDate = new Date(item.occurrence.start_date);
    const label = formatDayLabel(occurrenceDate, now);

    if (!grouped.has(label)) {
      grouped.set(label, []);
      labelOrder.push(label);
    }
    grouped.get(label)!.push(item);
  }

  return {
    sections: labelOrder.map((label) => ({
      label,
      items: grouped.get(label)!,
    })),
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
    const dayItems = sorted.filter((item) => {
      const occurrenceDate = new Date(item.occurrence.start_date);
      return isSameLocalDay(occurrenceDate, options.selectedDate!);
    });

    return {
      mode: "day",
      title: `${formatDayTitle(options.selectedDate)} · ${eventCountLabel(dayItems.length)}`,
      sections:
        dayItems.length > 0
          ? [{ label: formatDayTitle(options.selectedDate), items: dayItems }]
          : [],
      totalCount: dayItems.length,
      truncated: false,
    };
  }

  if (options.monthDate) {
    const { sections, capped } = groupItemsByDay(sorted, now);

    return {
      mode: "month",
      title: `${formatMonthTitle(options.monthDate)} · ${eventCountLabel(capped.length)}`,
      sections,
      totalCount: capped.length,
      truncated: false,
    };
  }

  if (options.yearOnly) {
    const { sections, capped } = groupItemsByDay(sorted, now);

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

  const upcoming = sorted.filter((item) => {
    const occurrenceDate = new Date(item.occurrence.start_date);
    return occurrenceDate >= startOfToday && occurrenceDate <= maxDate;
  });

  let truncated = upcoming.length > UPCOMING_MAX_ITEMS;
  const capped = truncated
    ? upcoming.slice(0, UPCOMING_MAX_ITEMS)
    : upcoming;

  const { sections } = groupItemsByDay(capped, now);

  return {
    mode: "upcoming",
    title: `Upcoming · ${eventCountLabel(capped.length)}`,
    sections,
    totalCount: capped.length,
    truncated,
  };
}

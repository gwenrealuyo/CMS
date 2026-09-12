import {
  MonthlyRecurrenceMode,
  RecurrencePattern,
} from "@/src/types/event";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type RepeatOption = "weekly" | "every_2_weeks" | "monthly";

export function toPythonWeekday(jsWeekday: number): number {
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
}

export function weekdayName(pythonWeekday?: number | null): string {
  if (pythonWeekday == null || pythonWeekday < 0 || pythonWeekday > 6) {
    return "the selected day";
  }
  return WEEKDAY_NAMES[pythonWeekday];
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function isLastWeekdayOfMonth(date: Date): boolean {
  const next = new Date(date);
  next.setDate(date.getDate() + 7);
  return next.getMonth() !== date.getMonth();
}

export function weekOfMonthFromDate(date: Date): number {
  if (isLastWeekdayOfMonth(date)) return -1;
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

export function weekOfMonthLabel(weekOfMonth: number, weekday: string): string {
  if (weekOfMonth === -1) return `last ${weekday}`;
  return `${ordinal(weekOfMonth)} ${weekday}`;
}

export function getRepeatOption(
  pattern?: RecurrencePattern | null
): RepeatOption {
  if (pattern?.frequency === "monthly") return "monthly";
  if ((pattern?.interval ?? 1) === 2) return "every_2_weeks";
  return "weekly";
}

export function formatThroughLabel(through?: string | null): string | null {
  if (!through) return null;
  return new Date(`${through}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRecurrenceSummary(
  pattern?: RecurrencePattern | null,
  fallbackWeekday?: string
): string {
  const through = formatThroughLabel(pattern?.through) || "the end of the year";
  const weekday =
    weekdayName(pattern?.weekdays?.[0]) !== "the selected day"
      ? weekdayName(pattern?.weekdays?.[0])
      : fallbackWeekday || "the selected day";

  if (pattern?.frequency === "monthly") {
    if (pattern.monthly_mode === "by_weekday") {
      const weekLabel = weekOfMonthLabel(
        pattern.week_of_month ?? 1,
        weekday
      );
      return `Repeats monthly on the ${weekLabel} through ${through}.`;
    }
    const day = pattern.month_day ?? 1;
    return `Repeats monthly on the ${ordinal(day)} through ${through}.`;
  }

  if ((pattern?.interval ?? 1) === 2) {
    return `Repeats every 2 weeks on ${weekday} through ${through}.`;
  }

  return `Repeats weekly every ${weekday} through ${through}.`;
}

export function recurrenceChipLabel(
  pattern?: RecurrencePattern | null
): string {
  if (pattern?.frequency === "monthly") return "monthly";
  if ((pattern?.interval ?? 1) === 2) return "every 2 weeks";
  return "weekly";
}

export function monthlyDateOptionLabel(start: Date): string {
  return `On the ${ordinal(start.getDate())}`;
}

export function monthlyWeekdayOptionLabel(start: Date): string {
  const weekday = start.toLocaleDateString("en-US", { weekday: "long" });
  return `On the ${weekOfMonthLabel(weekOfMonthFromDate(start), weekday)}`;
}

export function buildRecurrencePattern(
  startDate: Date,
  through: string,
  existing?: RecurrencePattern | null,
  overrides?: Partial<RecurrencePattern>
): RecurrencePattern {
  const merged: Partial<RecurrencePattern> = {
    ...(existing ?? {}),
    ...(overrides ?? {}),
  };

  const frequency: RecurrencePattern["frequency"] =
    merged.frequency === "monthly" ? "monthly" : "weekly";
  const interval = frequency === "weekly" && merged.interval === 2 ? 2 : 1;
  const monthlyMode: MonthlyRecurrenceMode =
    merged.monthly_mode === "by_weekday" ? "by_weekday" : "by_date";

  const pattern: RecurrencePattern = {
    frequency,
    interval,
    weekdays: [toPythonWeekday(startDate.getDay())],
    through,
    excluded_dates: existing?.excluded_dates ?? [],
  };

  if (frequency === "monthly") {
    pattern.monthly_mode = monthlyMode;
    pattern.month_day = startDate.getDate();
    pattern.week_of_month = weekOfMonthFromDate(startDate);
  }

  return pattern;
}

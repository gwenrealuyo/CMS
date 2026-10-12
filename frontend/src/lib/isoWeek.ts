/** ISO weekday Mon=1 … Sun=7 (from JS getDay() where Sun=0). */
function toIsoWeekday(dayJsSundayZero: number): number {
  return dayJsSundayZero === 0 ? 7 : dayJsSundayZero;
}

/**
 * ISO week-year and week number for a local calendar date.
 * Matches Python `date.isocalendar()` and ClusterReportsDashboard helpers.
 */
export function getIsoWeekParts(date: Date): { year: number; week: number } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setHours(0, 0, 0, 0);
  const isoDow = toIsoWeekday(d.getDay());

  const mondayThisWeek = new Date(d);
  mondayThisWeek.setDate(d.getDate() - (isoDow - 1));

  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - isoDow);
  const isoYear = thursday.getFullYear();

  const jan4 = new Date(isoYear, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (toIsoWeekday(jan4.getDay()) - 1));

  const diffDays = Math.round(
    (mondayThisWeek.getTime() - week1Monday.getTime()) / 86400000,
  );

  return { year: isoYear, week: Math.floor(diffDays / 7) + 1 };
}

/** Parse a `YYYY-MM-DD` date input as a local Date (no UTC shift). */
export function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** ISO week parts from a `YYYY-MM-DD` string, or null if invalid. */
export function getIsoWeekPartsFromDateString(
  value: string,
): { year: number; week: number } | null {
  const date = parseLocalDateInput(value);
  if (!date) return null;
  return getIsoWeekParts(date);
}

/** Monday–Sunday range for an ISO week in `isoYear`. */
export function getIsoWeekDateRange(
  isoYear: number,
  weekNumber: number,
): { start: Date; end: Date } {
  const jan4 = new Date(isoYear, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (toIsoWeekday(jan4.getDay()) - 1));

  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(0, 0, 0, 0);

  return { start, end };
}

/**
 * ISO week numbers in `isoYear` that include at least one day in calendar
 * `month` (1–12) of that year.
 */
export function isoWeeksOverlappingMonth(
  isoYear: number,
  month: number,
): number[] {
  const weeks: number[] = [];
  for (let week = 1; week <= 53; week += 1) {
    const { start } = getIsoWeekDateRange(isoYear, week);
    const thursday = new Date(start);
    thursday.setDate(start.getDate() + 3);
    if (thursday.getFullYear() !== isoYear) continue;

    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + offset);
      if (day.getFullYear() === isoYear && day.getMonth() + 1 === month) {
        weeks.push(week);
        break;
      }
    }
  }
  return weeks;
}

/** ISO week numbers that belong to `isoYear` (skips a missing week 53). */
export function isoWeeksInYear(isoYear: number): number[] {
  const weeks: number[] = [];
  for (let week = 1; week <= 53; week += 1) {
    const { start } = getIsoWeekDateRange(isoYear, week);
    const thursday = new Date(start);
    thursday.setDate(start.getDate() + 3);
    if (thursday.getFullYear() === isoYear) weeks.push(week);
  }
  return weeks;
}

/**
 * Week to show when the month filter changes.
 * Current month uses today's ISO week. Other months use the latest week in
 * that month that has already started, or the first overlapping week if the
 * month is still ahead.
 */
export function defaultIsoWeekForMonth(
  isoYear: number,
  month: number,
  today: Date = new Date(),
): number {
  const weeks = isoWeeksOverlappingMonth(isoYear, month);
  if (weeks.length === 0) return 1;

  const todayParts = getIsoWeekParts(today);
  if (
    today.getFullYear() === isoYear &&
    today.getMonth() + 1 === month &&
    weeks.includes(todayParts.week)
  ) {
    return todayParts.week;
  }

  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  let chosen = weeks[0];
  for (const week of weeks) {
    const { start } = getIsoWeekDateRange(isoYear, week);
    if (start.getTime() <= todayStart.getTime()) {
      chosen = week;
    }
  }
  return chosen;
}

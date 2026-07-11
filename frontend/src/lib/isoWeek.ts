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

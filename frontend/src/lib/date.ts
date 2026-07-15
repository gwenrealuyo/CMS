/** e.g. May 1, 2026 */
export function formatDisplayDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type LocalYmdParts = {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
};

/** Local calendar date as YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
export function getLocalTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getYearBounds(now: Date = new Date()): {
  minYear: number;
  maxYear: number;
} {
  const currentYear = now.getFullYear();
  return { minYear: currentYear - 120, maxYear: currentYear };
}

/** Parse YYYY-MM-DD without timezone shift. Returns null if invalid. */
export function parseLocalYmd(value?: string | null): LocalYmdParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidLocalYmd(year, month, day)) return null;
  return { year, month, day };
}

export function formatLocalYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isValidLocalYmd(
  year: number,
  month: number,
  day: number,
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** Whole years from DOB to today (local). Null if invalid or in the future. */
export function formatAgeYears(
  value?: string | null,
  now: Date = new Date(),
): number | null {
  const parts = parseLocalYmd(value);
  if (!parts) return null;
  const todayYmd = getLocalTodayDateString(now);
  if (formatLocalYmd(parts.year, parts.month, parts.day) > todayYmd) {
    return null;
  }
  let age = now.getFullYear() - parts.year;
  const monthDiff = now.getMonth() + 1 - parts.month;
  const dayDiff = now.getDate() - parts.day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

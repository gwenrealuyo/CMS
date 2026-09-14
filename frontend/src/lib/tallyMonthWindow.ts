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
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type TallyMonthPreset = "all" | "ytd" | "q1" | "q2" | "q3" | "q4" | "custom";

export function allYearMonths(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export function canUseYtd(year: number, now: Date = new Date()): boolean {
  return year === now.getFullYear();
}

export function ytdMonths(year: number, now: Date = new Date()): number[] {
  if (!canUseYtd(year, now)) {
    return allYearMonths();
  }
  const currentMonth = now.getMonth() + 1;
  return Array.from({ length: currentMonth }, (_, index) => index + 1);
}

export function quarterMonths(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

export function defaultMonthsForYear(
  year: number,
  now: Date = new Date(),
): number[] {
  return canUseYtd(year, now) ? ytdMonths(year, now) : allYearMonths();
}

/** Current calendar month for this year; all months for other years. */
export function currentMonthMonths(
  year: number,
  now: Date = new Date(),
): number[] {
  if (year === now.getFullYear()) {
    return [now.getMonth() + 1];
  }
  return allYearMonths();
}

export function monthsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const a = [...left].sort((x, y) => x - y);
  const b = [...right].sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

export function detectMonthPreset(
  months: number[],
  year: number,
  now: Date = new Date(),
): TallyMonthPreset {
  if (monthsEqual(months, allYearMonths())) {
    return "all";
  }
  if (canUseYtd(year, now) && monthsEqual(months, ytdMonths(year, now))) {
    return "ytd";
  }
  if (monthsEqual(months, quarterMonths(1))) return "q1";
  if (monthsEqual(months, quarterMonths(2))) return "q2";
  if (monthsEqual(months, quarterMonths(3))) return "q3";
  if (monthsEqual(months, quarterMonths(4))) return "q4";
  return "custom";
}

function isContiguous(months: number[]): boolean {
  if (months.length < 2) {
    return false;
  }
  const sorted = [...months].sort((a, b) => a - b);
  return sorted.every((month, index) => index === 0 || month === sorted[index - 1] + 1);
}

export function formatMonthsLabel(
  months: number[],
  year: number,
  now: Date = new Date(),
): string {
  const preset = detectMonthPreset(months, year, now);
  if (preset === "all") {
    return "All year";
  }
  if (preset === "ytd") {
    const window = ytdMonths(year, now);
    const last = window[window.length - 1];
    return `YTD (${MONTH_SHORT[0]}–${MONTH_SHORT[last - 1]})`;
  }
  if (preset === "q1") return "Q1 (Jan–Mar)";
  if (preset === "q2") return "Q2 (Apr–Jun)";
  if (preset === "q3") return "Q3 (Jul–Sep)";
  if (preset === "q4") return "Q4 (Oct–Dec)";

  const sorted = [...months].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return MONTH_SHORT[sorted[0] - 1];
  }
  if (isContiguous(sorted)) {
    return `${MONTH_SHORT[sorted[0] - 1]}–${MONTH_SHORT[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((month) => MONTH_SHORT[month - 1]).join(", ");
}

export function monthsQueryParam(months: number[]): string {
  return [...months].sort((a, b) => a - b).join(",");
}

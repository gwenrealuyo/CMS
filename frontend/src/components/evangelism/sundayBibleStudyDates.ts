import { getIsoWeekPartsFromDateString } from "@/src/lib/isoWeek";

export function mostRecentSunday(from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() - date.getDay());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isoWeekLabel(value: string): string {
  const parts = getIsoWeekPartsFromDateString(value);
  if (!parts) return "";
  return `${parts.year} · Week ${parts.week}`;
}

/** Weekday keys aligned with EvangelismGroupForm day select values */

export type MeetingDayKey =
  | ""
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const CLUSTER_MEETING_DAY_OPTIONS: {
  value: MeetingDayKey;
  label: string;
}[] = [
  { value: "", label: "Select day" },
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

const WEEKDAY_TO_KEY: Record<string, MeetingDayKey> = {
  sunday: "SUNDAY",
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
};

const WEEKDAY_PATTERN =
  /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

/** Normalize API or legacy strings for `<input type="time">` (HH:mm). */
function toTimeInputValue(parsed: string): string {
  if (!parsed) return "";
  return parsed.length >= 5 ? parsed.slice(0, 5) : parsed;
}

/** Parse first recognizable time fragment into HH:mm (24h). */
function parseTimeFragment(fragment: string): string {
  const f = fragment.trim();
  if (!f) return "";

  let m = f.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*$/,
  );
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    const mer = m[4]?.toUpperCase();
    if (mer === "PM" && hour < 12) hour += 12;
    if (mer === "AM" && hour === 12) hour = 0;
    if (hour >= 24 || minute > 59 || Number.isNaN(hour) || Number.isNaN(minute))
      return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  m = f.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59 || Number.isNaN(hour) || Number.isNaN(minute))
      return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return "";
}

export function parseMeetingSchedule(raw: string): {
  dayKey: MeetingDayKey;
  timeHHmm: string;
} {
  const s = raw.trim();
  if (!s) return { dayKey: "", timeHHmm: "" };

  let dayKey: MeetingDayKey = "";

  const dayMatch = s.match(WEEKDAY_PATTERN);
  if (dayMatch && dayMatch.index !== undefined) {
    const word = dayMatch[1].toLowerCase();
    dayKey = WEEKDAY_TO_KEY[word] ?? "";
  }

  let afterWeekday = s;
  if (dayMatch && dayMatch.index !== undefined) {
    afterWeekday = s
      .slice(dayMatch.index + dayMatch[0].length)
      .trim()
      .replace(/^[,•\-–]\s*/, "");
  }

  let timeHHmm = parseTimeFragment(afterWeekday);
  if (!timeHHmm && dayKey) {
    const stripped = s.replace(WEEKDAY_PATTERN, " ").replace(/\s+/g, " ").trim();
    timeHHmm = parseTimeFragment(stripped);
  }
  if (!timeHHmm) {
    timeHHmm = parseTimeFragment(s);
  }

  return {
    dayKey,
    timeHHmm: toTimeInputValue(timeHHmm),
  };
}

function hhmmTo12HourDisplay(hhmm: string): string {
  const trimmed = hhmm.trim();
  if (!trimmed) return "";
  const parts = trimmed.slice(0, 5).split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (Number.isNaN(h)) return "";
  const safeM = Number.isNaN(m) ? 0 : m;
  const d = new Date(1970, 0, 1, h, safeM, 0, 0);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function composeMeetingSchedule(
  dayKey: MeetingDayKey,
  timeHHmm: string,
): string | undefined {
  const timeTrim = timeHHmm.trim();
  if (!dayKey && !timeTrim) return undefined;

  const parts: string[] = [];
  if (dayKey) {
    const entry = CLUSTER_MEETING_DAY_OPTIONS.find((o) => o.value === dayKey);
    const label = entry?.label;
    if (label && label !== "Select day") parts.push(label);
  }
  if (timeTrim) parts.push(hhmmTo12HourDisplay(timeTrim));

  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

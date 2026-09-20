import { formatPersonName } from "@/src/lib/name";
import {
  formatLampIdDisplay,
  getCheckedInPersonIds,
  getExpectedMembers,
} from "@/src/lib/events/checkInUtils";
import { startOfLocalDay } from "@/src/lib/events/agenda";
import { findOccurrence } from "@/src/lib/events/recurrenceScope";
import { formatPersonStatusLabel } from "@/src/lib/personStatus";
import {
  AttendanceMode,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { Person } from "@/src/types/person";

export type AttendanceReportPerson = {
  id: string;
  name: string;
  memberId: string;
  role: string;
  status: string;
  statusLabel: string;
  clusterLabel: string;
  attendanceMode: AttendanceMode;
  attendanceModeLabel: string;
  venueCode: string;
  venueLabel: string;
  venueColor: string;
  recordedAt?: string;
  isTardy?: boolean;
};

export type StatusCount = {
  status: string;
  label: string;
  count: number;
  percent: number | null;
};

export type VenueCount = {
  code: string;
  label: string;
  color: string;
  count: number;
  percent: number | null;
};

export type AttendanceReport = {
  expectedCount: number;
  checkedInCount: number;
  remainingCount: number;
  surpriseCount: number;
  tardyCount: number;
  onsiteCount: number;
  onlineCount: number;
  /** Expected pool who checked in / expected (excludes surprises). */
  attendanceRate: number | null;
  remainingRate: number | null;
  checkedInRate: number | null;
  surpriseRate: number | null;
  onsiteRate: number | null;
  onlineRate: number | null;
  tardyRate: number | null;
  onlineByVenue: VenueCount[];
  checkedInByStatus: StatusCount[];
  remainingByStatus: StatusCount[];
  surprises: AttendanceReportPerson[];
  checkedInRoster: AttendanceReportPerson[];
  remainingRoster: AttendanceReportPerson[];
};

/** Percent 0–100 to 1 decimal, or null when denominator is 0. */
export function computeRatePercent(
  numerator: number,
  denominator: number
): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function formatRatePercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${rate.toFixed(1)}%`;
}

function normalizeStatus(status?: string | null): string {
  return (status || "").trim().toUpperCase() || "UNSET";
}

function modeFromRecord(record?: EventAttendanceRecord): AttendanceMode {
  return record?.attendance_mode === "ONLINE" ? "ONLINE" : "ONSITE";
}

function toReportPersonFromPerson(person: Person): AttendanceReportPerson {
  const status = normalizeStatus(person.status);
  return {
    id: String(person.id),
    name: formatPersonName(person),
    memberId: formatLampIdDisplay(person.member_id),
    role: (person.role || "").trim().toUpperCase(),
    status,
    statusLabel: formatPersonStatusLabel(person.status),
    clusterLabel: person.cluster_codes?.[0] || "NO CLUSTER",
    // Remaining / not checked in — no attendance mode yet
    attendanceMode: "ONSITE",
    attendanceModeLabel: "",
    venueCode: "",
    venueLabel: "",
    venueColor: "",
  };
}

function toReportPersonFromRecord(
  record: EventAttendanceRecord,
  isTardy = false
): AttendanceReportPerson {
  const person = record.person;
  const status = normalizeStatus(person.status);
  const mode = modeFromRecord(record);
  return {
    id: String(person.id),
    name: formatPersonName(person),
    memberId: formatLampIdDisplay(person.member_id),
    role: (person.role || "").trim().toUpperCase(),
    status,
    statusLabel: formatPersonStatusLabel(person.status),
    clusterLabel: person.cluster_codes?.[0] || "NO CLUSTER",
    attendanceMode: mode,
    attendanceModeLabel: mode === "ONLINE" ? "Online" : "Onsite",
    venueCode: record.attendance_venue || "",
    venueLabel: record.attendance_venue_label || "",
    venueColor: record.attendance_venue_color || "",
    recordedAt: record.recorded_at,
    isTardy,
  };
}

const STATUS_SORT_ORDER = [
  "ACTIVE",
  "SEMIACTIVE",
  "INACTIVE",
  "ONGOING",
  "NO_RESPONSE",
  "DORMANT",
  "FALLAWAY",
  "DECEASED",
  "UNSET",
];

function countByStatus(
  people: AttendanceReportPerson[],
  total: number
): StatusCount[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    counts.set(person.status, (counts.get(person.status) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({
      status,
      label: formatAttendanceReportStatusLabel(status),
      count,
      percent: computeRatePercent(count, total),
    }))
    .sort((a, b) => {
      const ai = STATUS_SORT_ORDER.indexOf(a.status);
      const bi = STATUS_SORT_ORDER.indexOf(b.status);
      const ao = ai === -1 ? STATUS_SORT_ORDER.length : ai;
      const bo = bi === -1 ? STATUS_SORT_ORDER.length : bi;
      if (ao !== bo) return ao - bo;
      return a.label.localeCompare(b.label);
    });
}

function countOnlineByVenue(
  people: AttendanceReportPerson[],
  onlineTotal: number
): VenueCount[] {
  const map = new Map<string, VenueCount>();
  for (const person of people) {
    if (person.attendanceMode !== "ONLINE") continue;
    const code = person.venueCode || "UNKNOWN";
    const existing = map.get(code);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(code, {
        code,
        label: person.venueLabel || code,
        color: person.venueColor || "#0EA5E9",
        count: 1,
        percent: null,
      });
    }
  }
  return Array.from(map.values())
    .map((venue) => ({
      ...venue,
      percent: computeRatePercent(venue.count, onlineTotal),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Clear labels for report breakdowns (members vs visitors). */
export function formatAttendanceReportStatusLabel(status: string): string {
  const normalized = (status || "").trim().toUpperCase();
  switch (normalized) {
    case "ACTIVE":
      return "Active members";
    case "SEMIACTIVE":
      return "Semi-active members";
    case "INACTIVE":
      return "Inactive members";
    case "DORMANT":
      return "Dormant members";
    case "FALLAWAY":
      return "Fall Away members";
    case "DECEASED":
      return "Deceased members";
    case "ONGOING":
      return "Ongoing visitors";
    case "NO_RESPONSE":
      return "No Response visitors";
    case "UNSET":
    case "":
      return "Other / unset";
    default:
      return formatPersonStatusLabel(status);
  }
}

/** True when occurrence YYYY-MM-DD is today or earlier (local calendar). */
export function isAttendanceReportAvailable(
  occurrenceDate: string,
  now: Date = new Date()
): boolean {
  const trimmed = occurrenceDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const occurrence = startOfLocalDay(new Date(`${trimmed}T12:00:00`));
  const today = startOfLocalDay(now);
  return occurrence.getTime() <= today.getTime();
}

/**
 * Resolve the occurrence start datetime for tardiness checks.
 * Prefer matching `event.occurrences`; otherwise apply event clock time to the date.
 */
export function resolveOccurrenceStart(
  event: Pick<Event, "start_date" | "occurrences">,
  occurrenceDate: string
): Date | null {
  const matched = findOccurrence(event as Event, occurrenceDate);
  if (matched?.start_date) {
    const fromOccurrence = new Date(matched.start_date);
    if (!Number.isNaN(fromOccurrence.getTime())) return fromOccurrence;
  }

  const baseStart = new Date(event.start_date);
  if (Number.isNaN(baseStart.getTime())) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate.trim())) return null;

  const [year, month, day] = occurrenceDate.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    baseStart.getHours(),
    baseStart.getMinutes(),
    baseStart.getSeconds(),
    baseStart.getMilliseconds()
  );
}

/** Tardy when check-in is strictly after occurrence start + grace minutes. */
export function isCheckInTardy(
  recordedAt: string | undefined,
  occurrenceStart: Date | null,
  graceMinutes = 0
): boolean {
  if (!recordedAt || !occurrenceStart) return false;
  const checkedInAt = new Date(recordedAt);
  if (Number.isNaN(checkedInAt.getTime())) return false;
  const graceMs = Math.max(0, graceMinutes) * 60 * 1000;
  return checkedInAt.getTime() > occurrenceStart.getTime() + graceMs;
}

export function buildAttendanceReport(
  people: Person[],
  event: Event,
  attendanceRecords: EventAttendanceRecord[],
  occurrenceDate?: string
): AttendanceReport {
  const expectedMembers = getExpectedMembers(people, event);
  const expectedIds = new Set(expectedMembers.map((person) => String(person.id)));
  const checkedInIds = getCheckedInPersonIds(attendanceRecords);

  const latestByPerson = new Map<string, EventAttendanceRecord>();
  for (const record of attendanceRecords) {
    const id = String(record.person.id);
    const existing = latestByPerson.get(id);
    if (
      !existing ||
      new Date(record.recorded_at).getTime() >
        new Date(existing.recorded_at).getTime()
    ) {
      latestByPerson.set(id, record);
    }
  }

  const dateKey =
    occurrenceDate?.trim() ||
    attendanceRecords[0]?.occurrence_date ||
    "";
  const occurrenceStart = dateKey
    ? resolveOccurrenceStart(event, dateKey)
    : null;
  const graceMinutes = event.tardy_grace_minutes ?? 0;

  const checkedInRoster = Array.from(latestByPerson.values())
    .map((record) =>
      toReportPersonFromRecord(
        record,
        isCheckInTardy(record.recorded_at, occurrenceStart, graceMinutes)
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const surprises = checkedInRoster.filter((person) => !expectedIds.has(person.id));

  const remainingRoster = expectedMembers
    .filter((person) => !checkedInIds.has(String(person.id)))
    .map(toReportPersonFromPerson)
    .sort((a, b) => a.name.localeCompare(b.name));

  const onsiteCount = checkedInRoster.filter(
    (person) => person.attendanceMode === "ONSITE"
  ).length;
  const onlineCount = checkedInRoster.filter(
    (person) => person.attendanceMode === "ONLINE"
  ).length;
  const tardyCount = checkedInRoster.filter((person) => person.isTardy).length;

  const expectedCount = expectedMembers.length;
  const checkedInCount = checkedInRoster.length;
  const remainingCount = remainingRoster.length;
  const surpriseCount = surprises.length;
  const expectedCheckedInCount = checkedInCount - surpriseCount;

  return {
    expectedCount,
    checkedInCount,
    remainingCount,
    surpriseCount,
    tardyCount,
    onsiteCount,
    onlineCount,
    attendanceRate: computeRatePercent(expectedCheckedInCount, expectedCount),
    remainingRate: computeRatePercent(remainingCount, expectedCount),
    checkedInRate: computeRatePercent(checkedInCount, expectedCount),
    surpriseRate: computeRatePercent(surpriseCount, checkedInCount),
    onsiteRate: computeRatePercent(onsiteCount, checkedInCount),
    onlineRate: computeRatePercent(onlineCount, checkedInCount),
    tardyRate: computeRatePercent(tardyCount, checkedInCount),
    onlineByVenue: countOnlineByVenue(checkedInRoster, onlineCount),
    checkedInByStatus: countByStatus(checkedInRoster, checkedInCount),
    remainingByStatus: countByStatus(remainingRoster, remainingCount),
    surprises,
    checkedInRoster,
    remainingRoster,
  };
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAttendanceReportCsv(
  event: Event,
  occurrenceDate: string,
  report: AttendanceReport
): string {
  const lines: string[] = [
    ["Field", "Value"].map(escapeCsvValue).join(","),
    ["Event", event.title].map(escapeCsvValue).join(","),
    ["Occurrence", occurrenceDate].map(escapeCsvValue).join(","),
    ["Expected", String(report.expectedCount)].map(escapeCsvValue).join(","),
    ["Checked In", String(report.checkedInCount)].map(escapeCsvValue).join(","),
    ["Checked In % of Expected", formatRatePercent(report.checkedInRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Attendance Rate %", formatRatePercent(report.attendanceRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Onsite", String(report.onsiteCount)].map(escapeCsvValue).join(","),
    ["Onsite % of Checked In", formatRatePercent(report.onsiteRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Online", String(report.onlineCount)].map(escapeCsvValue).join(","),
    ["Online % of Checked In", formatRatePercent(report.onlineRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Remaining", String(report.remainingCount)].map(escapeCsvValue).join(","),
    ["Remaining % of Expected", formatRatePercent(report.remainingRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Surprises", String(report.surpriseCount)].map(escapeCsvValue).join(","),
    ["Surprises % of Checked In", formatRatePercent(report.surpriseRate)]
      .map(escapeCsvValue)
      .join(","),
    ["Tardy", String(report.tardyCount)].map(escapeCsvValue).join(","),
    ["Tardy % of Checked In", formatRatePercent(report.tardyRate)]
      .map(escapeCsvValue)
      .join(","),
    ...report.onlineByVenue.map((venue) =>
      [
        `Online venue: ${venue.label}`,
        `${venue.count} (${formatRatePercent(venue.percent)})`,
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
    "",
    [
      "Category",
      "Name",
      "LAMP ID",
      "Role",
      "Status",
      "Cluster",
      "Attendance mode",
      "Online venue",
      "Checked In At",
      "Tardy",
    ]
      .map(escapeCsvValue)
      .join(","),
  ];

  const appendPeople = (
    category: string,
    people: AttendanceReportPerson[]
  ) => {
    for (const person of people) {
      lines.push(
        [
          category,
          person.name,
          person.memberId,
          person.role,
          person.statusLabel,
          person.clusterLabel,
          person.attendanceModeLabel,
          person.venueLabel,
          person.recordedAt
            ? new Date(person.recordedAt).toLocaleString()
            : "",
          person.recordedAt ? (person.isTardy ? "Yes" : "No") : "",
        ]
          .map(escapeCsvValue)
          .join(",")
      );
    }
  };

  const expectedCheckedIn = report.checkedInRoster.filter(
    (person) => !report.surprises.some((s) => s.id === person.id)
  );
  appendPeople("checked_in", expectedCheckedIn);
  appendPeople("surprise", report.surprises);
  appendPeople("remaining", report.remainingRoster);

  return lines.join("\n");
}

export function downloadAttendanceReportCsv(
  event: Event,
  occurrenceDate: string,
  report: AttendanceReport
): void {
  const csv = buildAttendanceReportCsv(event, occurrenceDate, report);
  const safeTitle = event.title.replace(/[^\w\-]+/g, "_").slice(0, 40);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeTitle}_${occurrenceDate}_attendance_report.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

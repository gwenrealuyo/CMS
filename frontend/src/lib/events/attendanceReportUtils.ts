import { formatPersonName } from "@/src/lib/name";
import {
  formatLampIdDisplay,
  getCheckedInPersonIds,
  getExpectedMembers,
} from "@/src/lib/events/checkInUtils";
import { startOfLocalDay } from "@/src/lib/events/agenda";
import { formatPersonStatusLabel } from "@/src/lib/personStatus";
import { Event, EventAttendanceRecord } from "@/src/types/event";
import { Person } from "@/src/types/person";

export type AttendanceReportPerson = {
  id: string;
  name: string;
  memberId: string;
  role: string;
  status: string;
  statusLabel: string;
  clusterLabel: string;
  recordedAt?: string;
};

export type StatusCount = {
  status: string;
  label: string;
  count: number;
};

export type AttendanceReport = {
  expectedCount: number;
  checkedInCount: number;
  remainingCount: number;
  surpriseCount: number;
  checkedInByStatus: StatusCount[];
  remainingByStatus: StatusCount[];
  surprises: AttendanceReportPerson[];
  checkedInRoster: AttendanceReportPerson[];
  remainingRoster: AttendanceReportPerson[];
};

function normalizeStatus(status?: string | null): string {
  return (status || "").trim().toUpperCase() || "UNSET";
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
  };
}

function toReportPersonFromRecord(
  record: EventAttendanceRecord
): AttendanceReportPerson {
  const person = record.person;
  const status = normalizeStatus(person.status);
  return {
    id: String(person.id),
    name: formatPersonName(person),
    memberId: formatLampIdDisplay(person.member_id),
    role: (person.role || "").trim().toUpperCase(),
    status,
    statusLabel: formatPersonStatusLabel(person.status),
    clusterLabel: person.cluster_codes?.[0] || "NO CLUSTER",
    recordedAt: record.recorded_at,
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

function countByStatus(people: AttendanceReportPerson[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    counts.set(person.status, (counts.get(person.status) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({
      status,
      label: formatAttendanceReportStatusLabel(status),
      count,
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

export function buildAttendanceReport(
  people: Person[],
  event: Event,
  attendanceRecords: EventAttendanceRecord[]
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

  const checkedInRoster = Array.from(latestByPerson.values())
    .map(toReportPersonFromRecord)
    .sort((a, b) => a.name.localeCompare(b.name));

  const surprises = checkedInRoster.filter((person) => !expectedIds.has(person.id));

  const remainingRoster = expectedMembers
    .filter((person) => !checkedInIds.has(String(person.id)))
    .map(toReportPersonFromPerson)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    expectedCount: expectedMembers.length,
    checkedInCount: checkedInRoster.length,
    remainingCount: remainingRoster.length,
    surpriseCount: surprises.length,
    checkedInByStatus: countByStatus(checkedInRoster),
    remainingByStatus: countByStatus(remainingRoster),
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
    ["Remaining", String(report.remainingCount)].map(escapeCsvValue).join(","),
    ["Surprises", String(report.surpriseCount)].map(escapeCsvValue).join(","),
    "",
    ["Category", "Name", "LAMP ID", "Role", "Status", "Cluster", "Checked In At"]
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
          person.recordedAt
            ? new Date(person.recordedAt).toLocaleString()
            : "",
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

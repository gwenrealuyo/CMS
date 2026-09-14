"use client";

import { useMemo, useState } from "react";

import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  buildAttendanceReport,
  downloadAttendanceReportCsv,
  type AttendanceReportPerson,
  type StatusCount,
} from "@/src/lib/events/attendanceReportUtils";
import { formatLampIdDisplay } from "@/src/lib/events/checkInUtils";
import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import { Event, EventAttendanceRecord } from "@/src/types/event";
import { Person } from "@/src/types/person";

interface EventAttendanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  occurrenceDate: string;
  people: Person[];
  attendanceRecords: EventAttendanceRecord[];
}

function formatOccurrenceLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBreakdown({
  title,
  counts,
}: {
  title: string;
  counts: StatusCount[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {title}
      </h4>
      {counts.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">None</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {counts.map((item) => (
            <li
              key={item.status}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonStatusColor(
                  item.status === "UNSET" ? "" : item.status
                )}`}
              >
                {item.label}
              </span>
              <span className="font-semibold text-lighthouse-navy">
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RosterRow({ person }: { person: AttendanceReportPerson }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <span className="text-sm font-medium text-lighthouse-navy">
        {person.name}
      </span>
      {person.memberId ? (
        <span className="chip-sky-sm shrink-0">{person.memberId}</span>
      ) : null}
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          person.attendanceMode === "ONLINE"
            ? "bg-sky-100 text-sky-800"
            : "bg-emerald-100 text-emerald-800"
        }`}
      >
        {person.attendanceModeLabel}
      </span>
      {person.venueLabel ? (
        <span
          className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            borderColor: person.venueColor || "#0ea5e9",
            color: person.venueColor || "#0369a1",
          }}
        >
          {person.venueLabel}
        </span>
      ) : null}
      {person.status ? (
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonStatusColor(
            person.status === "UNSET" ? "" : person.status
          )}`}
        >
          {person.statusLabel}
        </span>
      ) : null}
      {person.role ? (
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonRoleColor(
            person.role
          )}`}
        >
          {person.role}
        </span>
      ) : null}
      {person.clusterLabel === "NO CLUSTER" ? (
        <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
          NO CLUSTER
        </span>
      ) : (
        <span className="chip-primary-sm shrink-0">{person.clusterLabel}</span>
      )}
    </li>
  );
}

function filterRoster(
  people: AttendanceReportPerson[],
  query: string,
  clusterFilter: string,
  modeFilter: string,
  venueFilter: string
): AttendanceReportPerson[] {
  let filtered = people;

  if (modeFilter === "ONSITE" || modeFilter === "ONLINE") {
    filtered = filtered.filter(
      (person) => person.attendanceMode === modeFilter
    );
  }

  if (venueFilter) {
    filtered = filtered.filter((person) => person.venueCode === venueFilter);
  }

  if (clusterFilter === "NO_CLUSTER") {
    filtered = filtered.filter(
      (person) => person.clusterLabel === "NO CLUSTER"
    );
  } else if (clusterFilter) {
    filtered = filtered.filter(
      (person) => person.clusterLabel === clusterFilter
    );
  }

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return filtered;
  const withoutLamp = trimmed.replace(/^lamp/, "");
  return filtered.filter((person) => {
    const name = person.name.toLowerCase();
    const memberId = person.memberId.toLowerCase();
    const displayId = formatLampIdDisplay(person.memberId).toLowerCase();
    return (
      name.includes(trimmed) ||
      memberId.includes(trimmed) ||
      displayId.includes(trimmed) ||
      (withoutLamp.length > 0 &&
        (memberId.includes(withoutLamp) || displayId.includes(withoutLamp))) ||
      person.statusLabel.toLowerCase().includes(trimmed) ||
      person.role.toLowerCase().includes(trimmed) ||
      person.attendanceModeLabel.toLowerCase().includes(trimmed) ||
      person.venueLabel.toLowerCase().includes(trimmed)
    );
  });
}

export default function EventAttendanceReportModal({
  isOpen,
  onClose,
  event,
  occurrenceDate,
  people,
  attendanceRecords,
}: EventAttendanceReportModalProps) {
  const [rosterSearch, setRosterSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");

  const report = useMemo(
    () => buildAttendanceReport(people, event, attendanceRecords),
    [people, event, attendanceRecords]
  );

  const clusterFilterOptions = useMemo(() => {
    const codes = new Set<string>();
    let hasNoCluster = false;
    for (const person of report.checkedInRoster) {
      if (person.clusterLabel === "NO CLUSTER") {
        hasNoCluster = true;
      } else if (person.clusterLabel) {
        codes.add(person.clusterLabel);
      }
    }
    return {
      codes: Array.from(codes).sort((a, b) => a.localeCompare(b)),
      hasNoCluster,
    };
  }, [report.checkedInRoster]);

  const clusterSelectOptions = useMemo(() => {
    const options = [{ value: "", label: "All clusters" }];
    if (clusterFilterOptions.hasNoCluster) {
      options.push({ value: "NO_CLUSTER", label: "NO CLUSTER" });
    }
    for (const code of clusterFilterOptions.codes) {
      options.push({ value: code, label: code });
    }
    return options;
  }, [clusterFilterOptions]);

  const venueSelectOptions = useMemo(() => {
    const options = [{ value: "", label: "All venues" }];
    for (const venue of report.onlineByVenue) {
      options.push({ value: venue.code, label: venue.label });
    }
    return options;
  }, [report.onlineByVenue]);

  const filteredCheckedIn = useMemo(
    () =>
      filterRoster(
        report.checkedInRoster,
        rosterSearch,
        clusterFilter,
        modeFilter,
        venueFilter
      ),
    [
      report.checkedInRoster,
      rosterSearch,
      clusterFilter,
      modeFilter,
      venueFilter,
    ]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Report"
      className="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-medium text-lighthouse-navy">
              {event.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatOccurrenceLabel(occurrenceDate)}
              {event.branch_name ? ` · ${event.branch_name}` : ""}
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-blue-700 border border-primary/20 shadow-sm"
            onClick={() =>
              downloadAttendanceReportCsv(event, occurrenceDate, report)
            }
          >
            Download CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-2xl font-semibold text-primary">
              {report.expectedCount}
            </p>
            <p className="text-xs text-muted-foreground">Expected</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50/80 p-3">
            <p
              className={`text-2xl font-semibold ${
                report.checkedInCount > 0 ? "text-green-700" : "text-gray-400"
              }`}
            >
              {report.checkedInCount}
            </p>
            <p className="text-xs text-muted-foreground">Checked In</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
            <p
              className={`text-2xl font-semibold ${
                report.onsiteCount > 0 ? "text-emerald-700" : "text-gray-400"
              }`}
            >
              {report.onsiteCount}
            </p>
            <p className="text-xs text-muted-foreground">Onsite</p>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3">
            <p
              className={`text-2xl font-semibold ${
                report.onlineCount > 0 ? "text-sky-700" : "text-gray-400"
              }`}
            >
              {report.onlineCount}
            </p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              report.remainingCount > 0
                ? "border-red-200 bg-red-50/80"
                : "border-green-200 bg-green-50/80"
            }`}
          >
            <p
              className={`text-2xl font-semibold ${
                report.remainingCount > 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {report.remainingCount}
            </p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              report.surpriseCount > 0
                ? "border-amber-200 bg-amber-50/80"
                : "border-gray-200 bg-white"
            }`}
          >
            <p
              className={`text-2xl font-semibold ${
                report.surpriseCount > 0 ? "text-amber-600" : "text-gray-400"
              }`}
            >
              {report.surpriseCount}
            </p>
            <p className="text-xs text-muted-foreground">Surprises</p>
          </div>
        </div>

        {report.onlineByVenue.length > 0 ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-900">
              Online by venue
            </h4>
            <ul className="mt-2 space-y-1.5">
              {report.onlineByVenue.map((venue) => (
                <li
                  key={venue.code}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      borderColor: venue.color,
                      color: venue.color,
                    }}
                  >
                    {venue.label}
                  </span>
                  <span className="font-semibold text-lighthouse-navy">
                    {venue.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusBreakdown
            title="Checked in by status"
            counts={report.checkedInByStatus}
          />
          <StatusBreakdown
            title="Remaining (no-shows) by status"
            counts={report.remainingByStatus}
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Surprises (not in expected pool)
          </h4>
          {report.surprises.length === 0 ? (
            <p className="mt-2 text-sm text-amber-900/70">
              No unexpected check-ins.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-amber-200/80">
              {report.surprises.map((person) => (
                <RosterRow key={person.id} person={person} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h4 className="text-sm font-semibold text-lighthouse-navy">
              Checked-in roster
            </h4>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap sm:justify-end">
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search checked-in..."
                className="input-field h-11 min-h-[44px] w-full text-sm sm:max-w-xs md:min-h-[44px] md:py-0"
              />
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                aria-label="Filter by attendance mode"
                className="input-field h-11 min-h-[44px] w-full text-sm sm:w-36 md:min-h-[44px] md:py-0"
              >
                <option value="">All modes</option>
                <option value="ONSITE">Onsite</option>
                <option value="ONLINE">Online</option>
              </select>
              <div className="w-full sm:w-52">
                <ScalableSelect
                  options={venueSelectOptions}
                  value={venueFilter}
                  onChange={setVenueFilter}
                  placeholder="All venues"
                  searchPlaceholder="Search venues..."
                  emptyMessage="No matching venues"
                  showSearch
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-64">
                <ScalableSelect
                  options={clusterSelectOptions}
                  value={clusterFilter}
                  onChange={setClusterFilter}
                  placeholder="All clusters"
                  searchPlaceholder="Search clusters..."
                  emptyMessage="No matching clusters"
                  showSearch
                  className="w-full"
                />
              </div>
            </div>
          </div>
          {report.checkedInRoster.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No check-ins for this occurrence.
            </p>
          ) : filteredCheckedIn.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching check-ins.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 px-3">
              <ul className="divide-y divide-gray-100">
                {filteredCheckedIn.map((person) => (
                  <RosterRow key={person.id} person={person} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

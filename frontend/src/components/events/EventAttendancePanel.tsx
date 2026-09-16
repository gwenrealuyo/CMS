"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ScalableSelect from "@/src/components/ui/ScalableSelect";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import EventAttendanceReportModal from "@/src/components/events/EventAttendanceReportModal";
import EditAttendanceModeControl, {
  AttendanceModeVenueFields,
} from "@/src/components/events/EditAttendanceModeControl";
import { usePeople } from "@/src/hooks/usePeople";
import { attendanceVenuesApi } from "@/src/lib/api";
import {
  AttendanceMode,
  AttendanceStatus,
  AttendanceVenueOption,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { formatPersonName } from "@/src/lib/name";
import { isAttendanceReportAvailable } from "@/src/lib/events/attendanceReportUtils";
import { formatLampIdDisplay } from "@/src/lib/events/checkInUtils";
import { recordsForOccurrence } from "@/src/lib/events/viewerAttendance";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";

function recordAttendanceMode(record: EventAttendanceRecord): AttendanceMode {
  return record.attendance_mode || "ONSITE";
}

interface AddAttendanceInput {
  person_id: string;
  occurrence_date: string;
  status?: AttendanceStatus;
  notes?: string;
  attendance_mode?: AttendanceMode;
  attendance_venue?: string | null;
}

interface EventAttendancePanelProps {
  event: Event;
  selectedOccurrenceDate: string;
  eventDateKey: string;
  listAttendance: (
    eventId: string,
    params?: { occurrence_date?: string }
  ) => Promise<EventAttendanceRecord[]>;
  addAttendance: (
    eventId: string,
    payload: AddAttendanceInput
  ) => Promise<{
    attendance_record: EventAttendanceRecord;
    event: Event;
  }>;
  removeAttendance: (
    eventId: string,
    attendanceId: number | string
  ) => Promise<{ event: Event }>;
}

export default function EventAttendancePanel({
  event,
  selectedOccurrenceDate,
  eventDateKey,
  listAttendance,
  addAttendance,
  removeAttendance,
}: EventAttendancePanelProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<
    EventAttendanceRecord[]
  >(() =>
    recordsForOccurrence(event.attendance_records, selectedOccurrenceDate),
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedStatus] = useState<AttendanceStatus>("PRESENT");
  const [addAttendanceMode, setAddAttendanceMode] =
    useState<AttendanceMode>("ONSITE");
  const [addAttendanceVenue, setAddAttendanceVenue] = useState("");
  const [venues, setVenues] = useState<AttendanceVenueOption[]>([]);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState<"" | AttendanceMode>("");
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    isOpen: boolean;
    record: EventAttendanceRecord | null;
    loading: boolean;
  }>({ isOpen: false, record: null, loading: false });
  const [reportOpen, setReportOpen] = useState(false);

  const { people, peopleUI, loading: peopleLoading } = usePeople();

  const canGenerateReport = Boolean(
    selectedOccurrenceDate && isAttendanceReportAvailable(selectedOccurrenceDate)
  );

  const formatOccurrenceLabel = (dateValue: string) => {
    const formatted = new Date(`${dateValue}T00:00:00`);
    return formatted.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await attendanceVenuesApi.list({ active: true });
        if (!cancelled) {
          setVenues(response.data);
        }
      } catch {
        if (!cancelled) {
          setVenues([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAttendanceRecords(
      recordsForOccurrence(event.attendance_records, selectedOccurrenceDate),
    );
  }, [event.id, event.attendance_records, selectedOccurrenceDate]);

  const attendeeOptions = useMemo(
    () =>
      peopleUI.filter(isSelectablePerson).map((person) => {
        const clusterCode = person.cluster_codes?.[0];
        const nickname = (person.nickname || "").trim();
        return {
          value: String(person.id),
          label: formatPersonName(person),
          memberId: person.member_id,
          nickname: nickname || null,
          disabled: attendanceRecords.some(
            (record) => String(record.person.id) === String(person.id)
          ),
          clusterCode,
          roleLabel: person.role || null,
          roleClassName: getPersonRoleColor(person.role),
          statusLabel: formatPersonStatusLabel(person.status),
          statusClassName: getPersonStatusColor(person.status),
        };
      }),
    [peopleUI, attendanceRecords]
  );

  const totalAttendanceCount = attendanceRecords.length;

  const filteredAttendanceRecords = useMemo(() => {
    const term = attendanceSearchTerm.trim().toLowerCase();
    return attendanceRecords.filter((record) => {
      if (modeFilter && recordAttendanceMode(record) !== modeFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const name = formatPersonName(record.person).toLowerCase();
      const memberId = (record.person.member_id || "").toLowerCase();
      const displayId = formatLampIdDisplay(record.person.member_id).toLowerCase();
      return (
        name.includes(term) ||
        memberId.includes(term) ||
        displayId.includes(term)
      );
    });
  }, [attendanceRecords, attendanceSearchTerm, modeFilter]);

  const fetchAttendance = useCallback(
    async (targetDate: string) => {
      setAttendanceLoading(true);
      try {
        const data = await listAttendance(event.id, {
          occurrence_date: targetDate,
        });
        setAttendanceRecords(data);
        setActionError(null);
      } catch (error) {
        console.error("Failed to load attendance", error);
        setActionError(
          "We couldn’t load attendance for this occurrence. Please try again."
        );
      } finally {
        setAttendanceLoading(false);
      }
    },
    [event.id, listAttendance]
  );

  useEffect(() => {
    if (!selectedOccurrenceDate) return;
    fetchAttendance(selectedOccurrenceDate);
  }, [fetchAttendance, selectedOccurrenceDate]);

  const addAttendeeById = async (personId: string) => {
    if (!selectedOccurrenceDate || !personId || actionLoading) return;
    if (addAttendanceMode === "ONLINE" && !addAttendanceVenue) {
      setActionError("Select an online venue before adding attendance.");
      return;
    }
    setActionLoading(true);
    try {
      await addAttendance(event.id, {
        person_id: personId,
        occurrence_date: selectedOccurrenceDate,
        status: selectedStatus,
        attendance_mode: addAttendanceMode,
        attendance_venue:
          addAttendanceMode === "ONLINE" ? addAttendanceVenue : null,
      });
      await fetchAttendance(selectedOccurrenceDate);
      setSelectedPersonId("");
      setActionError(null);
    } catch (error) {
      console.error("Failed to add attendance", error);
      setActionError(
        "Unable to save attendance for this person. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAttendance = () => {
    void addAttendeeById(selectedPersonId);
  };

  const openRemoveConfirmation = (record: EventAttendanceRecord) => {
    setRemoveConfirmation({ isOpen: true, record, loading: false });
  };

  const closeRemoveConfirmation = () => {
    setRemoveConfirmation({ isOpen: false, record: null, loading: false });
  };

  const confirmRemoveAttendance = async () => {
    const record = removeConfirmation.record;
    if (!record || !selectedOccurrenceDate) return;

    setRemoveConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await removeAttendance(event.id, record.id);
      await fetchAttendance(selectedOccurrenceDate);
      setActionError(null);
      closeRemoveConfirmation();
    } catch (error) {
      console.error("Failed to remove attendance", error);
      setActionError("Unable to remove this attendee. Please try again.");
      setRemoveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Attendance
            </h3>
            <p className="text-sm text-gray-600">
              Total recorded attendees: {totalAttendanceCount}
            </p>
            <p className="text-xs text-gray-500">
              Showing attendees for{" "}
              {formatOccurrenceLabel(selectedOccurrenceDate || eventDateKey)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            {event.booking_status !== "pending" && (
              <Button
                onClick={() => {
                  if (!selectedOccurrenceDate) return;
                  const url = `/events/check-in?event=${event.id}&occurrence=${selectedOccurrenceDate}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                disabled={!selectedOccurrenceDate}
                className="w-full md:w-auto gap-2 bg-primary text-primary-foreground hover:bg-blue-700 border border-primary/20 shadow-sm"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                Open Check-In
                <svg
                  className="h-3.5 w-3.5 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </Button>
            )}
            {canGenerateReport ? (
              <Button
                variant="tertiary"
                onClick={() => setReportOpen(true)}
                disabled={attendanceLoading || peopleLoading}
                className="w-full md:w-auto gap-2"
              >
                Generate Report
              </Button>
            ) : null}
          </div>
        </div>

        {actionError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {actionError}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <ScalableSelect
              options={attendeeOptions}
              value={selectedPersonId}
              onChange={setSelectedPersonId}
              onConfirm={addAttendeeById}
              placeholder="Select attendee"
              searchPlaceholder="Search by name, nickname, or LAMP ID..."
              loading={peopleLoading}
              emptyMessage="No matching people"
              showSearch
            />
            <AttendanceModeVenueFields
              mode={addAttendanceMode}
              venueCode={addAttendanceVenue}
              venues={venues}
              onModeChange={(next) => {
                setAddAttendanceMode(next);
                if (next === "ONSITE") {
                  setAddAttendanceVenue("");
                }
              }}
              onVenueChange={setAddAttendanceVenue}
              disabled={actionLoading}
            />
          </div>
          <Button
            onClick={handleAddAttendance}
            disabled={
              actionLoading ||
              !selectedOccurrenceDate ||
              !selectedPersonId ||
              (addAttendanceMode === "ONLINE" && !addAttendanceVenue)
            }
            className="w-full sm:w-auto min-h-[44px] md:self-center md:px-6"
          >
            {actionLoading ? "Saving..." : "Add Attendee"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          People already recorded for this date appear disabled in the list.
        </p>

        <div className="mt-6">
          {attendanceRecords.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="attendance-search"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600"
                  >
                    Filter attendees in this event
                  </label>
                  <div className="relative">
                    <input
                      id="attendance-search"
                      type="text"
                      value={attendanceSearchTerm}
                      onChange={(event) =>
                        setAttendanceSearchTerm(event.target.value)
                      }
                      placeholder="Search attendees for this date..."
                      className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[44px] pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <svg
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="sm:w-36 sm:shrink-0">
                  <label
                    htmlFor="attendance-mode-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600"
                  >
                    Mode
                  </label>
                  <select
                    id="attendance-mode-filter"
                    value={modeFilter}
                    onChange={(event) =>
                      setModeFilter(event.target.value as "" | AttendanceMode)
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">All modes</option>
                    <option value="ONSITE">Onsite</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                This search only filters the attendees listed below.
              </p>
            </div>
          )}
          {attendanceLoading ? (
            <LoadingSpinner />
          ) : attendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-500">
              No attendees recorded for this occurrence yet.
            </p>
          ) : filteredAttendanceRecords.length === 0 ? (
            <p className="text-sm text-gray-500">No matching attendees</p>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              <ul className="space-y-3">
                {filteredAttendanceRecords.map((record) => {
                  const mode = recordAttendanceMode(record);
                  const isOnline = mode === "ONLINE";
                  return (
                    <li
                      key={record.id}
                      className={`flex flex-col gap-3 rounded-lg border px-3 py-3 tablet:flex-row tablet:items-center tablet:justify-between ${
                        isOnline
                          ? "border-sky-100 bg-sky-50"
                          : "border-emerald-100 bg-emerald-50"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatPersonName(record.person)}
                          </span>
                          {record.person.member_id && (
                            <span className="chip-sky-sm">
                              {formatLampIdDisplay(record.person.member_id)}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isOnline
                                ? "bg-sky-100 text-sky-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isOnline ? "Online" : "Onsite"}
                          </span>
                          {record.attendance_venue_label ? (
                            <span
                              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                borderColor:
                                  record.attendance_venue_color || "#0ea5e9",
                                color:
                                  record.attendance_venue_color || "#0369a1",
                              }}
                            >
                              {record.attendance_venue_label}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            {record.person.cluster_codes &&
                            record.person.cluster_codes.length > 0 ? (
                              <span className="chip-primary-sm">
                                {record.person.cluster_codes[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                No Cluster
                              </span>
                            )}
                            {record.person.family_names &&
                            record.person.family_names.length > 0 ? (
                              <span className="chip-green-sm text-[10px]">
                                {record.person.family_names[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                No Family
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {[
                            record.person.role,
                            record.person.status ? (
                              <span
                                key="status"
                                className="font-semibold text-gray-700"
                              >
                                {record.person.status.toLowerCase()}
                              </span>
                            ) : null,
                            record.journey_id ? "Journey logged" : null,
                          ]
                            .filter(Boolean)
                            .map((part, index) => (
                              <span key={index}>
                                {index > 0 ? " • " : ""}
                                {part}
                              </span>
                            ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <EditAttendanceModeControl
                          eventId={String(event.id)}
                          record={record}
                          venues={venues}
                          disabled={actionLoading || removeConfirmation.loading}
                          onSaved={async () => {
                            if (selectedOccurrenceDate) {
                              await fetchAttendance(selectedOccurrenceDate);
                            }
                          }}
                        />
                        <Button
                          variant="tertiary"
                          className="w-full sm:w-auto min-h-[44px] text-xs px-3 py-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          onClick={() => openRemoveConfirmation(record)}
                          disabled={actionLoading || removeConfirmation.loading}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={removeConfirmation.isOpen}
        onClose={closeRemoveConfirmation}
        onConfirm={confirmRemoveAttendance}
        title="Remove Attendee"
        message={
          removeConfirmation.record ? (
            <>
              Remove{" "}
              <strong>
                {formatPersonName(removeConfirmation.record.person)}
              </strong>
              {selectedOccurrenceDate
                ? ` from ${formatOccurrenceLabel(selectedOccurrenceDate)}`
                : " from this occurrence"}
              . Their attendance record will be deleted.
            </>
          ) : (
            "Remove this attendee from the occurrence? Their attendance record will be deleted."
          )
        }
        confirmText="Remove Attendee"
        cancelText="Cancel"
        variant="danger"
        loading={removeConfirmation.loading}
      />

      {selectedOccurrenceDate ? (
        <EventAttendanceReportModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          event={event}
          occurrenceDate={selectedOccurrenceDate}
          people={people}
          attendanceRecords={attendanceRecords}
        />
      ) : null}
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";

import ScalableSelect from "@/src/components/ui/ScalableSelect";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import EventAttendanceReportModal from "@/src/components/events/EventAttendanceReportModal";
import { usePeople } from "@/src/hooks/usePeople";
import {
  AttendanceStatus,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { formatPersonName } from "@/src/lib/name";
import { isPastOccurrenceDate } from "@/src/lib/events/attendanceReportUtils";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";
import EventRecurringChip from "@/src/components/events/EventRecurringChip";
import { formatRecurrenceSummary } from "@/src/lib/events/recurrenceLabel";

interface AddAttendanceInput {
  person_id: string;
  occurrence_date: string;
  status?: AttendanceStatus;
  notes?: string;
}

interface EventViewProps {
  event: Event;
  initialOccurrenceDate?: string | null;
  showAuditMetadata?: boolean;
  onEdit: (payload: { occurrenceDate: string }) => void;
  onDelete?: (payload: { occurrenceDate: string }) => void;
  onCancel?: () => void;
  onClose: () => void;
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

export default function EventView({
  event,
  initialOccurrenceDate,
  showAuditMetadata = false,
  onEdit,
  onDelete,
  onCancel,
  onClose,
  listAttendance,
  addAttendance,
  removeAttendance,
}: EventViewProps) {
  const { getChipStyle } = useEventTypeStyles();

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const skippedDatesCount =
    event.recurrence_pattern?.excluded_dates?.length || 0;
  const skippedLabel = skippedDatesCount === 1 ? "occurrence" : "occurrences";

  const locationDisplay = useMemo(() => {
    const location = event.location?.trim() ?? "";
    if (!location) return "";
    const branch = event.branch_name?.trim();
    if (!branch) return location;
    const branchHasHq = /\bhq\b/i.test(branch);
    const branchLabel =
      event.branch_is_headquarters && !branchHasHq ? `${branch} (HQ)` : branch;
    if (location.toLowerCase().includes(branchLabel.toLowerCase())) {
      return location;
    }
    return `${location} - ${branchLabel}`;
  }, [event.location, event.branch_name, event.branch_is_headquarters]);

  const toDateKey = (value: string) =>
    new Date(value).toISOString().split("T")[0];

  const formatOccurrenceLabel = (dateValue: string) => {
    const formatted = new Date(`${dateValue}T00:00:00`);
    return formatted.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const eventDateKey = useMemo(
    () => toDateKey(event.start_date),
    [event.start_date]
  );

  const initialOccurrenceKey = useMemo(() => {
    if (initialOccurrenceDate) {
      return toDateKey(initialOccurrenceDate);
    }
    return eventDateKey;
  }, [eventDateKey, initialOccurrenceDate]);

  const [selectedOccurrenceDate, setSelectedOccurrenceDate] =
    useState<string>(initialOccurrenceKey);

  const selectedOccurrence = useMemo(() => {
    if (!selectedOccurrenceDate) return null;
    if (event.occurrences && event.occurrences.length > 0) {
      const match = event.occurrences.find(
        (occurrence) =>
          toDateKey(occurrence.start_date) === selectedOccurrenceDate
      );
      if (match) return match;
    }

    if (toDateKey(event.start_date) === selectedOccurrenceDate) {
      return {
        start_date: event.start_date,
        end_date: event.end_date,
      };
    }

    return null;
  }, [
    event.end_date,
    event.occurrences,
    event.start_date,
    selectedOccurrenceDate,
  ]);

  const displayStart = selectedOccurrence?.start_date ?? event.start_date;
  const displayEnd = selectedOccurrence?.end_date ?? event.end_date;
  const [attendanceRecords, setAttendanceRecords] = useState<
    EventAttendanceRecord[]
  >(event.attendance_records ?? []);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedStatus] = useState<AttendanceStatus>("PRESENT");
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    isOpen: boolean;
    record: EventAttendanceRecord | null;
    loading: boolean;
  }>({ isOpen: false, record: null, loading: false });
  const [reportOpen, setReportOpen] = useState(false);

  const { people, peopleUI, loading: peopleLoading } = usePeople();

  const canGenerateReport = Boolean(
    selectedOccurrenceDate && isPastOccurrenceDate(selectedOccurrenceDate)
  );

  useEffect(() => {
    setSelectedOccurrenceDate(initialOccurrenceKey);
  }, [event.id, initialOccurrenceKey]);

  useEffect(() => {
    const records = event.attendance_records ?? [];
    if (!selectedOccurrenceDate) {
      setAttendanceRecords(records);
      return;
    }
    setAttendanceRecords(
      records.filter(
        (record) => record.occurrence_date === selectedOccurrenceDate
      )
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
    if (!attendanceSearchTerm.trim()) {
      return attendanceRecords;
    }
    const term = attendanceSearchTerm.toLowerCase();
    return attendanceRecords.filter((record) =>
      formatPersonName(record.person).toLowerCase().includes(term)
    );
  }, [attendanceRecords, attendanceSearchTerm]);

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
    setActionLoading(true);
    try {
      await addAttendance(event.id, {
        person_id: personId,
        occurrence_date: selectedOccurrenceDate,
        status: selectedStatus,
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

  const handleStatusChange = async (
    record: EventAttendanceRecord,
    nextStatus: AttendanceStatus
  ) => {
    if (record.status === nextStatus || !selectedOccurrenceDate) return;
    setActionLoading(true);
    try {
      await addAttendance(event.id, {
        person_id: record.person.id,
        occurrence_date: record.occurrence_date,
        status: nextStatus,
        notes: record.notes,
      });
      await fetchAttendance(selectedOccurrenceDate);
      setActionError(null);
    } catch (error) {
      console.error("Failed to update attendance status", error);
      setActionError(
        "Unable to update the attendee’s status. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-medium text-gray-900">Event Details</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">{event.title}</p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 overflow-y-auto flex-1">
        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground mb-3">
              {event.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={getChipStyle(event.type)}>
                {event.type_display || event.type}
              </span>
              {event.is_recurring && (
                <EventRecurringChip
                  pattern={event.recurrence_pattern}
                />
              )}
              {totalAttendanceCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 bg-gray-50 rounded-full border border-gray-200">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>
                      {totalAttendanceCount} Attendee
                      {totalAttendanceCount !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
            </div>
          </div>

          {event.description && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Event Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatDateTime(displayStart)}
                  </div>
                  <div className="text-sm text-gray-500">
                    to {formatTime(displayEnd)}
                  </div>
                </div>
              </div>

              {locationDisplay && (
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Location
                    </div>
                    <div className="text-sm text-gray-500">
                      {locationDisplay}
                    </div>
                  </div>
                </div>
              )}

              {event.is_recurring && event.recurrence_pattern && (
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Recurrence
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatRecurrenceSummary(event.recurrence_pattern)}
                      {skippedDatesCount > 0 && (
                        <span className="block text-xs text-gray-400 mt-1">
                          {skippedDatesCount} {skippedLabel} skipped for this
                          schedule.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {showAuditMetadata && (
                <div className="border-t border-gray-100 pt-3 mt-1 space-y-2">
                  {(event.created_by_name || event.created_at) && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">Created: </span>
                      {event.created_by_name && (
                        <span>{event.created_by_name}</span>
                      )}
                      {event.created_by_name && event.created_at && (
                        <span> · </span>
                      )}
                      {event.created_at && (
                        <span>{formatDateTime(event.created_at)}</span>
                      )}
                    </div>
                  )}
                  {event.updated_by_name && event.updated_at && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">
                        Last updated:{" "}
                      </span>
                      <span>{event.updated_by_name}</span>
                      <span> · </span>
                      <span>{formatDateTime(event.updated_at)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

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
                  {formatOccurrenceLabel(
                    selectedOccurrenceDate || eventDateKey
                  )}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
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
              <div className="flex-1 min-w-0">
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
              </div>
              <Button
                onClick={handleAddAttendance}
                disabled={
                  actionLoading || !selectedOccurrenceDate || !selectedPersonId
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
                  <label
                    htmlFor="attendance-search"
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1"
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
                      className="w-full rounded-md border border-gray-300 px-3 py-2 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
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
                  <p className="mt-1 text-[11px] text-gray-500">
                    This search only filters the attendees listed below.
                  </p>
                </div>
              )}
              {attendanceLoading ? (
                <LoadingSpinner />
              ) : filteredAttendanceRecords.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No attendees recorded for this occurrence yet.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto pr-1">
                  <ul className="space-y-3">
                    {filteredAttendanceRecords.map((record) => (
                      <li
                        key={record.id}
                        className="flex flex-col gap-3 rounded-lg border border-gray-200 px-3 py-3 tablet:flex-row tablet:items-center tablet:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {formatPersonName(record.person)}
                            </span>
                            {record.person.member_id && (
                              <span className="chip-sky-sm">
                                {record.person.member_id}
                              </span>
                            )}
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
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
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

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
        {onDelete ? (
        <Button
          onClick={() =>
            onDelete({
              occurrenceDate:
                selectedOccurrence?.start_date ||
                selectedOccurrenceDate ||
                eventDateKey,
            })
          }
          variant="secondary"
          className="!text-red-600 min-h-[44px] px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center w-full sm:w-auto"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span className="ml-2 sm:ml-0 md:ml-2">Delete</span>
        </Button>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={onCancel ? onCancel : onClose}
            variant="secondary"
            className="!text-black min-h-[44px] px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>{onCancel ? "Back" : "Close"}</span>
          </Button>
          <Button
            onClick={() =>
              onEdit({
                occurrenceDate:
                  selectedOccurrence?.start_date ||
                  selectedOccurrenceDate ||
                  eventDateKey,
              })
            }
            variant="secondary"
            className="!text-primary min-h-[44px] px-6 text-sm font-normal bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span>Edit</span>
          </Button>
        </div>
      </div>

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
    </div>
  );
}

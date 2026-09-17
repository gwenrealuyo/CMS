"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/src/components/ui/Button";
import EventAttendancePanel from "@/src/components/events/EventAttendancePanel";
import YouWerePresentChip from "@/src/components/events/YouWerePresentChip";
import {
  AttendanceMode,
  AttendanceStatus,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { useAuth } from "@/src/contexts/AuthContext";
import { useEventTypeStyles } from "@/src/contexts/EventTypeStylesContext";
import EventRecurringChip from "@/src/components/events/EventRecurringChip";
import { formatRecurrenceSummary } from "@/src/lib/events/recurrenceLabel";
import { isActivityEventType } from "@/src/lib/events/activityTypes";
import {
  occurrenceDateKey,
  viewerAttendanceForOccurrence,
} from "@/src/lib/events/viewerAttendance";

interface AddAttendanceInput {
  person_id: string;
  occurrence_date: string;
  status?: AttendanceStatus;
  notes?: string;
  attendance_mode?: AttendanceMode;
  attendance_venue?: string | null;
}

interface EventViewProps {
  event: Event;
  initialOccurrenceDate?: string | null;
  showAuditMetadata?: boolean;
  canManageAttendance?: boolean;
  onEdit?: (payload: { occurrenceDate: string }) => void;
  onDelete?: (payload: { occurrenceDate: string }) => void;
  onApprove?: () => void;
  onReject?: () => void;
  reviewLoading?: boolean;
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
  canManageAttendance = false,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  reviewLoading = false,
  onCancel,
  onClose,
  listAttendance,
  addAttendance,
  removeAttendance,
}: EventViewProps) {
  const { user } = useAuth();
  const { types, getChipStyle } = useEventTypeStyles();
  const typeMeta = types.find((type) => type.code === event.type);
  const isActivityEvent = typeMeta
    ? isActivityEventType(typeMeta)
    : event.type !== "MEETING";

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

  const eventDateKey = useMemo(
    () => occurrenceDateKey(event.start_date),
    [event.start_date]
  );

  const initialOccurrenceKey = useMemo(() => {
    if (initialOccurrenceDate) {
      return occurrenceDateKey(initialOccurrenceDate);
    }
    return eventDateKey;
  }, [eventDateKey, initialOccurrenceDate]);

  const [selectedOccurrenceDate, setSelectedOccurrenceDate] =
    useState<string>(initialOccurrenceKey);

  const selectedOccurrence = useMemo(() => {
    if (!selectedOccurrenceDate) return null;
    if (event.occurrences && event.occurrences.length > 0) {
      const match = event.occurrences.find((occurrence) => {
        const occKey = occurrence.occurrence_date
          ? occurrenceDateKey(occurrence.occurrence_date)
          : occurrenceDateKey(occurrence.start_date);
        return occKey === selectedOccurrenceDate;
      });
      if (match) return match;
    }

    if (occurrenceDateKey(event.start_date) === selectedOccurrenceDate) {
      return {
        start_date: event.start_date,
        end_date: event.end_date,
        occurrence_date: selectedOccurrenceDate,
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

  useEffect(() => {
    setSelectedOccurrenceDate(initialOccurrenceKey);
  }, [event.id, initialOccurrenceKey]);

  const viewerAttendance = useMemo(
    () =>
      viewerAttendanceForOccurrence(
        event,
        user?.id,
        selectedOccurrenceDate || eventDateKey,
      ),
    [event, eventDateKey, selectedOccurrenceDate, user?.id],
  );

  const actionBtnSize =
    "!min-h-[32px] sm:!min-h-[44px] !py-1 sm:!py-2 !px-2.5 sm:!px-6 !text-xs sm:!text-sm font-normal flex items-center justify-center w-auto whitespace-nowrap";

  return (
    <div className="flex flex-col h-full space-y-0">
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
              {event.booking_status === "pending" && (
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium text-amber-800 bg-amber-50 rounded-full border border-amber-200">
                  Pending approval
                </span>
              )}
              {isActivityEvent && viewerAttendance.count > 0 && (
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
                    {viewerAttendance.count} Attendee
                    {viewerAttendance.count !== 1 ? "s" : ""}
                  </span>
                </span>
              )}
              {isActivityEvent && viewerAttendance.present && (
                <YouWerePresentChip mode={viewerAttendance.mode} />
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

          {isActivityEvent && canManageAttendance && selectedOccurrenceDate ? (
            <EventAttendancePanel
              event={event}
              selectedOccurrenceDate={selectedOccurrenceDate}
              eventDateKey={eventDateKey}
              listAttendance={listAttendance}
              addAttendance={addAttendance}
              removeAttendance={removeAttendance}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-row flex-wrap justify-between items-center gap-2 sm:gap-3 px-3 py-2.5 sm:p-6 border-t border-gray-200 bg-gray-50">
        {onDelete ? (
        <Button
          onClick={() =>
            onDelete({
              occurrenceDate:
                selectedOccurrence?.occurrence_date ||
                selectedOccurrenceDate ||
                eventDateKey,
            })
          }
          variant="secondary"
          className={`!text-red-600 ${actionBtnSize} sm:!px-4 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300`}
        >
          <svg
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
          <span className="ml-1.5 sm:ml-2">Delete</span>
        </Button>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="flex flex-row gap-2 sm:gap-3 w-auto">
          {event.booking_status === "pending" && onReject && (
            <Button
              onClick={onReject}
              variant="secondary"
              disabled={reviewLoading}
              className={`!text-red-600 ${actionBtnSize} bg-white border border-red-200 hover:bg-red-50`}
            >
              Reject
            </Button>
          )}
          {event.booking_status === "pending" && onApprove && (
            <Button
              onClick={onApprove}
              disabled={reviewLoading}
              className={actionBtnSize}
            >
              {reviewLoading ? "Saving..." : "Approve"}
            </Button>
          )}
          <Button
            onClick={onCancel ? onCancel : onClose}
            variant="secondary"
            className={`!text-black ${actionBtnSize} bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 space-x-1.5 sm:space-x-2`}
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
          {onEdit && (
          <Button
            onClick={() =>
              onEdit({
                occurrenceDate:
                  selectedOccurrence?.occurrence_date ||
                  selectedOccurrenceDate ||
                  eventDateKey,
              })
            }
            variant="secondary"
            className={`!text-primary ${actionBtnSize} bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 space-x-1.5 sm:space-x-2`}
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
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
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ModalOverlay from "@/src/components/ui/ModalOverlay";
import { Event } from "@/src/types/event";
import {
  RecurrenceScope,
  isFirstOccurrence,
} from "@/src/lib/events/recurrenceScope";

export type EventDeleteScope = RecurrenceScope;

interface EventDeleteModalProps {
  isOpen: boolean;
  mode?: "delete" | "edit";
  event: Event | null;
  occurrenceDate: string | null;
  canDeleteSeries: boolean;
  canEditSeries: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurrenceScope) => void;
}

function formatOccurrenceLabel(dateValue: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00`)
    : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EventDeleteModal({
  isOpen,
  mode = "delete",
  event,
  occurrenceDate,
  canDeleteSeries,
  canEditSeries,
  loading = false,
  onClose,
  onConfirm,
}: EventDeleteModalProps) {
  const isEdit = mode === "edit";
  const occurrenceLabel = occurrenceDate
    ? formatOccurrenceLabel(occurrenceDate)
    : "this date";

  const isRecurring = Boolean(event?.is_recurring);
  const firstOccurrence = useMemo(
    () =>
      event && occurrenceDate
        ? isFirstOccurrence(event, occurrenceDate)
        : false,
    [event, occurrenceDate]
  );

  const canChangeOccurrence =
    isRecurring && canEditSeries && Boolean(occurrenceDate);
  const canChangeFollowing = canChangeOccurrence && !firstOccurrence;
  const canChangeSeries = isEdit ? canEditSeries : canDeleteSeries;
  const showChooser =
    isRecurring && (canChangeOccurrence || canChangeSeries);

  const defaultScope: RecurrenceScope = canChangeOccurrence
    ? "occurrence"
    : "series";

  const [scope, setScope] = useState<RecurrenceScope>(defaultScope);

  const scopeRadioName = isEdit
    ? "event-recurrence-scope-edit"
    : "event-recurrence-scope-delete";

  useEffect(() => {
    if (isOpen) {
      setScope(defaultScope);
    }
  }, [defaultScope, isOpen]);

  if (!event) return null;

  const confirmText = isEdit
    ? "Continue"
    : scope === "occurrence"
      ? "Remove this occurrence"
      : scope === "following"
        ? "End series from this date"
        : isRecurring
          ? "Delete entire series"
          : "Delete Event";

  const variantClass = isEdit
    ? "bg-primary hover:bg-lighthouse-navy text-white"
    : scope === "series"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-yellow-600 hover:bg-yellow-700 text-white";

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      zIndex={80}
      panelClassName="relative w-full max-w-lg"
    >
      <div className="overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div
              className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                isEdit
                  ? "chip-primary-surface"
                  : scope === "series"
                    ? "bg-red-100"
                    : "bg-yellow-100"
              }`}
            >
              <svg
                className={`h-6 w-6 ${
                  isEdit
                    ? "text-primary"
                    : scope === "series"
                      ? "text-red-600"
                      : "text-yellow-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    isEdit
                      ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  }
                />
              </svg>
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {isEdit
                  ? "Edit recurring event"
                  : isRecurring
                    ? "Delete recurring event"
                    : "Delete Event"}
              </h3>
              {showChooser ? (
                <fieldset className="mt-4 text-left">
                  <legend className="text-sm text-gray-600 mb-3">
                    {isEdit ? "What should these changes apply to for " : "What should be removed for "}
                    <span className="font-medium text-gray-800">
                      {event.title}
                    </span>
                    ?
                  </legend>
                  <div className="space-y-2">
                    {canChangeOccurrence && (
                      <label
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 ${
                          scope === "occurrence"
                            ? "border-primary bg-primary/5"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name={scopeRadioName}
                          value="occurrence"
                          checked={scope === "occurrence"}
                          onChange={() => setScope("occurrence")}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">
                            This occurrence
                          </span>
                          <span className="block text-sm text-gray-500">
                            {isEdit
                              ? `Change ${occurrenceLabel} only. Other weeks stay as they are.`
                              : `Remove ${occurrenceLabel} only. Other weeks stay on the calendar.`}
                          </span>
                        </span>
                      </label>
                    )}
                    {canChangeFollowing && (
                      <label
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 ${
                          scope === "following"
                            ? "border-primary bg-primary/5"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name={scopeRadioName}
                          value="following"
                          checked={scope === "following"}
                          onChange={() => setScope("following")}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">
                            This and following occurrences
                          </span>
                          <span className="block text-sm text-gray-500">
                            {isEdit
                              ? `Change ${occurrenceLabel} and later weeks. Earlier weeks stay.`
                              : `End the series starting ${occurrenceLabel}. Earlier weeks stay.`}
                          </span>
                        </span>
                      </label>
                    )}
                    {canChangeSeries && (
                      <label
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 ${
                          scope === "series"
                            ? "border-primary bg-primary/5"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name={scopeRadioName}
                          value="series"
                          checked={scope === "series"}
                          onChange={() => setScope("series")}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">
                            Entire series
                          </span>
                          <span className="block text-sm text-gray-500">
                            {isEdit
                              ? "Change every remaining week of this event. Weeks already split into a separate event are not included."
                              : "Permanently delete every remaining week of this event. Weeks already split into a separate event are not included. This cannot be undone."}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                </fieldset>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete &quot;{event.title}&quot;?
                  This action cannot be undone.
                </p>
              )}
              {!isEdit && scope === "series" && isRecurring && (
                <p className="mt-3 text-xs text-red-600">
                  Attendance records for this series will also be deleted.
                </p>
              )}
              {!isEdit && scope !== "series" && isRecurring && (
                <p className="mt-3 text-xs text-gray-500">
                  Attendance already recorded for removed dates is kept on each
                  person&apos;s journey.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <Button
            onClick={() => onConfirm(scope)}
            disabled={loading}
            className={`w-full min-h-[44px] sm:ml-3 sm:w-auto ${variantClass}`}
          >
            {loading ? "Processing..." : confirmText}
          </Button>
          <Button
            variant="tertiary"
            onClick={onClose}
            disabled={loading}
            className="mt-3 w-full min-h-[44px] sm:mt-0 sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}

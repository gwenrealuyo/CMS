"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { PencilIcon } from "@heroicons/react/24/solid";

import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { attendanceVenuesApi, eventsApi } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import {
  AttendanceMode,
  AttendanceVenueOption,
  EventAttendanceRecord,
} from "@/src/types/event";

export function AttendanceModeVenueFields({
  mode,
  venueCode,
  venues,
  onModeChange,
  onVenueChange,
  disabled,
}: {
  mode: AttendanceMode;
  venueCode: string;
  venues: AttendanceVenueOption[];
  onModeChange: (mode: AttendanceMode) => void;
  onVenueChange: (code: string) => void;
  disabled?: boolean;
}) {
  const venueOptions = useMemo(
    () =>
      venues.map((venue) => ({
        value: venue.code,
        label: venue.label,
      })),
    [venues]
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Attendance mode
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange("ONSITE")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "ONSITE"
                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Onsite
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange("ONLINE")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              mode === "ONLINE"
                ? "border-sky-600 bg-sky-50 text-sky-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Online
          </button>
        </div>
      </div>
      {mode === "ONLINE" ? (
        <div>
          <label
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600"
          >
            Online venue *
          </label>
          <ScalableSelect
            options={venueOptions}
            value={venueCode}
            onChange={onVenueChange}
            placeholder="Select online venue…"
            searchPlaceholder="Search venues…"
            emptyMessage="No active online venues"
            showSearch
            disabled={disabled}
            className="w-full"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function EditAttendanceModeControl({
  eventId,
  record,
  venues: venuesProp,
  disabled,
  onSaved,
  buttonClassName,
  compact,
  iconOnly,
}: {
  eventId: string;
  record: EventAttendanceRecord;
  venues?: AttendanceVenueOption[];
  disabled?: boolean;
  onSaved: () => void | Promise<void>;
  buttonClassName?: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AttendanceMode>("ONSITE");
  const [venueCode, setVenueCode] = useState("");
  const [venues, setVenues] = useState<AttendanceVenueOption[]>(venuesProp ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (venuesProp) {
      setVenues(venuesProp);
    }
  }, [venuesProp]);

  useEffect(() => {
    if (!open) return;
    setMode(record.attendance_mode || "ONSITE");
    setVenueCode(record.attendance_venue || "");
    setError(null);

    if (venuesProp) return;

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
  }, [open, record, venuesProp]);

  const handleModeChange = (next: AttendanceMode) => {
    setMode(next);
    if (next === "ONSITE") {
      setVenueCode("");
    }
  };

  const handleSave = async () => {
    if (mode === "ONLINE" && !venueCode) {
      setError("Select an online venue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await eventsApi.updateAttendance(eventId, record.id, {
        attendance_mode: mode,
        attendance_venue: mode === "ONLINE" ? venueCode : null,
      });
      toast.success(
        `${formatPersonName(record.person)} updated to ${
          mode === "ONLINE" ? "Online" : "Onsite"
        }`
      );
      setOpen(false);
      await onSaved();
    } catch {
      setError("Unable to update attendance mode. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const ariaLabel = `Edit attendance mode for ${formatPersonName(record.person)}`;

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-label={ariaLabel}
          className={
            buttonClassName ||
            "flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition-all duration-200 hover:bg-blue-50 disabled:opacity-50"
          }
        >
          <PencilIcon className="h-5 w-5" />
        </button>
      ) : (
        <Button
          type="button"
          variant="tertiary"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={
            buttonClassName ||
            (compact
              ? "min-h-8 px-2 py-1 text-xs"
              : "w-full sm:w-auto min-h-[44px] text-xs px-3 py-2")
          }
          aria-label={ariaLabel}
        >
          Edit mode
        </Button>
      )}
      <Modal
        isOpen={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title="Edit attendance mode"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Update how{" "}
            <span className="font-medium text-gray-900">
              {formatPersonName(record.person)}
            </span>{" "}
            attended this occurrence.
          </p>
          <AttendanceModeVenueFields
            mode={mode}
            venueCode={venueCode}
            venues={venues}
            onModeChange={handleModeChange}
            onVenueChange={setVenueCode}
            disabled={saving}
          />
          {error ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="tertiary"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

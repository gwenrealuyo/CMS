"use client";

import { useState, useEffect, useMemo } from "react";
import { Event, RecurrencePattern } from "@/src/types/event";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { useEventRooms } from "@/src/hooks/useEventRooms";
import Button from "../ui/Button";
import ConfirmationModal from "../ui/ConfirmationModal";
import { findScheduleConflict } from "@/src/lib/events/scheduleConflicts";
import {
  RepeatOption,
  buildRecurrencePattern,
  formatRecurrenceSummary,
  getRepeatOption,
  monthlyDateOptionLabel,
  monthlyWeekdayOptionLabel,
} from "@/src/lib/events/recurrenceLabel";

const OFFSITE_ROOM = "other";

interface EventFormProps {
  onSubmit: (event: Partial<Event>) => Promise<Event | void>;
  initialData?: Partial<Event>;
  presetDate?: Date | null;
  onClose?: () => void;
  eventTypeOptions?: { value: string; label: string }[];
  lockRecurrence?: boolean;
  scopeHint?: string;
  existingEvents?: Event[];
  ignoreOccurrenceDate?: string | null;
  ignoreDatesGte?: string | null;
  isBookingRequest?: boolean;
}

/** Parse datetime-local (wall clock) and ISO strings without UTC shifting. */
const parseLocalDateTime = (value: string): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (localMatch) {
    const [, y, m, d, h, min, sec] = localMatch;
    const parsed = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      sec ? Number(sec) : 0,
      0
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toCalendarDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  const parsed = parseLocalDateTime(value);
  if (!parsed) return null;
  return formatDateOnly(parsed);
};

const recordedAttendeeCount = (data?: Partial<Event>) => {
  if (!data) return 0;
  if (typeof data.attendance_count === "number") {
    return data.attendance_count;
  }
  return data.attendance_records?.length ?? 0;
};

const getNextSundayAt9AM = () => {
  const today = new Date();
  const nextSunday = new Date(today);
  const currentDay = today.getDay();

  if (currentDay === 0) {
    nextSunday.setHours(9, 0, 0, 0);
    return nextSunday;
  }

  const daysUntilSunday = 7 - currentDay;
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(9, 0, 0, 0);
  return nextSunday;
};

const getNextSundayAt11AM = () => {
  const nextSunday = getNextSundayAt9AM();
  nextSunday.setHours(11, 0, 0, 0);
  return nextSunday;
};

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const DEFAULT_EVENT_DURATION_HOURS = 2;

function endDateFromStart(startValue: string): string {
  const start = parseLocalDateTime(startValue);
  if (!start) return "";
  const end = new Date(start);
  end.setTime(end.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
  return formatDateForInput(end);
}

const getMaxThroughDate = (start: Date) => {
  const endOfYear = new Date(start.getFullYear(), 11, 31);
  const maxRange = new Date(start);
  maxRange.setDate(maxRange.getDate() + 366);
  return new Date(Math.min(endOfYear.getTime(), maxRange.getTime()));
};

const clampThroughDate = (start: Date, candidate?: Date | null) => {
  const minDate = new Date(start);
  minDate.setHours(0, 0, 0, 0);
  const maxDate = getMaxThroughDate(start);

  if (!candidate) {
    return maxDate;
  }

  const normalized = new Date(candidate);
  normalized.setHours(0, 0, 0, 0);

  if (normalized < minDate) {
    return minDate;
  }

  if (normalized > maxDate) {
    return maxDate;
  }

  return normalized;
};

const buildPattern = (
  startValue: string,
  existing?: RecurrencePattern | null,
  overrides?: Partial<RecurrencePattern>
): RecurrencePattern => {
  const startDate = parseLocalDateTime(startValue) ?? new Date();

  const throughCandidate = existing?.through
    ? parseLocalDateTime(`${existing.through}T00:00:00`)
    : null;

  const throughDate = clampThroughDate(startDate, throughCandidate);

  return buildRecurrencePattern(
    startDate,
    formatDateOnly(throughDate),
    existing,
    overrides
  );
};

const toUtcISOString = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

type RoomSelection = number | typeof OFFSITE_ROOM | "";

type FormDefaults = {
  title: string;
  description: string;
  type: string;
  location: string;
  branch: number | "";
  room: RoomSelection;
  is_recurring: boolean;
  start_date: string;
  end_date: string;
  expected_include_active: boolean;
  expected_include_semiactive: boolean;
  expected_include_inactive: boolean;
  expected_include_ongoing_visitors: boolean;
};

function withPlaceholders(
  defaults: Omit<FormDefaults, "branch" | "room">
): FormDefaults {
  return { ...defaults, branch: "", room: "" };
}

function withExpectedAttendeeDefaults(
  defaults: Omit<
    FormDefaults,
    | "branch"
    | "room"
    | "expected_include_active"
    | "expected_include_semiactive"
    | "expected_include_inactive"
    | "expected_include_ongoing_visitors"
  >
): Omit<FormDefaults, "branch" | "room"> {
  return {
    ...defaults,
    expected_include_active: true,
    expected_include_semiactive: true,
    expected_include_inactive: true,
    expected_include_ongoing_visitors: true,
  };
}

function buildSundayTemplateDefaults(): FormDefaults {
  const startDate = formatDateForInput(getNextSundayAt9AM());
  const endDate = formatDateForInput(getNextSundayAt11AM());

  return withPlaceholders(
    withExpectedAttendeeDefaults({
      title: "Sunday Service",
      description: "",
      type: "SUNDAY_SERVICE",
      location: "",
      is_recurring: false,
      start_date: startDate,
      end_date: endDate,
    })
  );
}

function buildDefaultsFromDate(
  date: Date,
  eventTypeOptions: { value: string; label: string }[]
): FormDefaults {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const startDate = formatDateForInput(start);
  const endDate = endDateFromStart(startDate);

  if (start.getDay() === 0) {
    return withPlaceholders(
      withExpectedAttendeeDefaults({
        title: "Sunday Service",
        description: "",
        type: "SUNDAY_SERVICE",
        location: "",
        is_recurring: false,
        start_date: startDate,
        end_date: endDate,
      })
    );
  }

  const type = eventTypeOptions[0]?.value ?? "SPECIAL_EVENT";
  const title =
    eventTypeOptions.find((option) => option.value === type)?.label ?? "";

  return withPlaceholders(
    withExpectedAttendeeDefaults({
      title,
      description: "",
      type,
      location: "",
      is_recurring: false,
      start_date: startDate,
      end_date: endDate,
    })
  );
}

function resolveRoomSelection(initialData?: Partial<Event>): RoomSelection {
  if (initialData?.room != null) return Number(initialData.room);
  if (initialData) return OFFSITE_ROOM;
  return "";
}

export default function EventForm({
  onSubmit,
  initialData,
  presetDate,
  onClose,
  eventTypeOptions = [],
  lockRecurrence = false,
  scopeHint,
  existingEvents = [],
  ignoreOccurrenceDate = null,
  ignoreDatesGte = null,
  isBookingRequest = false,
}: EventFormProps) {
  const { user } = useAuth();
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const { branches } = useBranches();
  const userBranchId =
    user?.branch != null && user.branch !== undefined
      ? Number(user.branch)
      : "";

  const defaultFormData = useMemo(() => {
    const defaultBranch =
      initialData?.branch != null
        ? Number(initialData.branch)
        : userBranchId;

    if (initialData) {
      return {
        title: initialData.title || "",
        description: initialData.description || "",
        type: initialData.type || "SUNDAY_SERVICE",
        location: initialData.location || "",
        branch: defaultBranch,
        room: resolveRoomSelection(initialData),
        is_recurring: initialData.is_recurring || false,
        start_date: initialData.start_date || "",
        end_date: initialData.end_date || "",
        expected_include_active: initialData.expected_include_active ?? true,
        expected_include_semiactive:
          initialData.expected_include_semiactive ?? true,
        expected_include_inactive:
          initialData.expected_include_inactive ?? true,
        expected_include_ongoing_visitors:
          initialData.expected_include_ongoing_visitors ?? true,
      };
    }

    const base = presetDate
      ? buildDefaultsFromDate(presetDate, eventTypeOptions)
      : buildSundayTemplateDefaults();
    return { ...base, branch: defaultBranch };
  }, [initialData, presetDate, eventTypeOptions, userBranchId]);
  const [formData, setFormData] = useState(defaultFormData);

  const selectedBranchId =
    formData.branch === "" ? null : Number(formData.branch);
  const { rooms } = useEventRooms({
    branchId: selectedBranchId,
    enabled: selectedBranchId != null,
  });
  const roomChoices = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.is_active ||
        (initialData?.room != null && Number(initialData.room) === room.id)
    );
  }, [rooms, initialData?.room]);

  const initialRecurrence = useMemo<RecurrencePattern | null>(
    () =>
      initialData?.is_recurring
        ? buildPattern(
            initialData.start_date || defaultFormData.start_date,
            initialData.recurrence_pattern || null
          )
        : null,
    [initialData, defaultFormData.start_date]
  );

  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern | null>(initialRecurrence);
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [dateMoveConfirm, setDateMoveConfirm] = useState<{
    isOpen: boolean;
    payload: Partial<Event> | null;
  }>({ isOpen: false, payload: null });

  useEffect(() => {
    setFormData(defaultFormData);
    if (initialData?.is_recurring) {
      setRecurrencePattern(
        buildPattern(
          initialData.start_date || defaultFormData.start_date,
          initialData.recurrence_pattern || null
        )
      );
    } else {
      setRecurrencePattern(null);
    }
  }, [defaultFormData, initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "is_recurring") {
      const nextIsRecurring = type === "checkbox" ? checked : value === "true";
      setFormData((prev) => ({ ...prev, is_recurring: nextIsRecurring }));

      if (nextIsRecurring) {
        const sourceStart = formData.start_date || defaultFormData.start_date;
        setRecurrencePattern((current) =>
          buildPattern(sourceStart, current)
        );
      } else {
        setRecurrencePattern(null);
      }

      return;
    }

    if (name === "branch") {
      setFormData((prev) => ({
        ...prev,
        branch: value ? Number(value) : "",
        room: "",
        location: "",
      }));
      return;
    }

    if (name === "room") {
      if (value === OFFSITE_ROOM) {
        setFormData((prev) => ({ ...prev, room: OFFSITE_ROOM }));
        return;
      }
      const roomId = Number(value);
      const selected = roomChoices.find((room) => room.id === roomId);
      setFormData((prev) => ({
        ...prev,
        room: roomId,
        location: selected?.name || prev.location,
      }));
      return;
    }

    let nextStartDate: string | null = null;

    setFormData((prev) => {
      const nextState = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "type" && value === "SUNDAY_SERVICE") {
        const startDate =
          parseLocalDateTime(prev.start_date) || getNextSundayAt9AM();
        startDate.setHours(9, 0, 0, 0);

        const endDate =
          parseLocalDateTime(prev.end_date) || getNextSundayAt11AM();
        endDate.setHours(11, 0, 0, 0);

        nextState.start_date = formatDateForInput(startDate);
        nextState.end_date = formatDateForInput(endDate);
      }

      if (name === "type") {
        const optionLabel =
          eventTypeOptions.find((option) => option.value === value)?.label ||
          value;
        nextState.title = optionLabel;
      }

      nextStartDate = nextState.start_date;

      return nextState;
    });

    if (
      name === "type" &&
      (formData.is_recurring || recurrencePattern) &&
      nextStartDate
    ) {
      setRecurrencePattern((current) =>
        buildPattern(nextStartDate as string, current)
      );
    }
  };

  const submitPayload = async (payload: Partial<Event>) => {
    try {
      setLoading(true);
      await onSubmit(payload);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let patternToSend = recurrencePattern;

    if (formData.is_recurring) {
      const baseStart = formData.start_date || defaultFormData.start_date;
      if (!patternToSend) {
        patternToSend = buildPattern(baseStart, null);
        setRecurrencePattern(patternToSend);
      } else {
        patternToSend = buildPattern(baseStart, patternToSend);
        setRecurrencePattern(patternToSend);
      }
    }

    const startSource = formData.start_date || defaultFormData.start_date;
    const endSource = formData.end_date || defaultFormData.end_date;

    const startIso = toUtcISOString(startSource) ?? startSource;
    const endIso = toUtcISOString(endSource) ?? endSource;
    if (formData.room === "") {
      return;
    }
    const isOffsite = formData.room === OFFSITE_ROOM;
    const selectedRoom = roomChoices.find(
      (room) => room.id === Number(formData.room)
    );

    const payload: Partial<Event> = {
      title: formData.title,
      description: formData.description,
      type: formData.type,
      is_recurring: formData.is_recurring,
      start_date: startIso,
      end_date: endIso,
      recurrence_pattern: formData.is_recurring ? patternToSend : null,
      branch: formData.branch === "" ? null : Number(formData.branch),
      room: isOffsite ? null : Number(formData.room),
      location: isOffsite
        ? formData.location.trim()
        : selectedRoom?.name || formData.location,
      expected_include_active: formData.expected_include_active,
      expected_include_semiactive: formData.expected_include_semiactive,
      expected_include_inactive: formData.expected_include_inactive,
      expected_include_ongoing_visitors:
        formData.expected_include_ongoing_visitors,
    };

    const conflict = findScheduleConflict({
      payload,
      events: existingEvents,
      excludeEventId: initialData?.id,
      ignoreOccurrenceDate,
      ignoreDatesGte,
    });
    if (conflict) {
      setConflictError(conflict.message);
      return;
    }
    setConflictError(null);

    const attendeeCount = recordedAttendeeCount(initialData);
    const dateChanged =
      Boolean(initialData) &&
      toCalendarDateKey(initialData?.start_date) !==
        toCalendarDateKey(formData.start_date);

    if (initialData && attendeeCount > 0 && dateChanged) {
      setDateMoveConfirm({ isOpen: true, payload });
      return;
    }

    await submitPayload(payload);
  };

  const activeStartDate = formData.start_date || defaultFormData.start_date;
  const parsedStartDate = parseLocalDateTime(activeStartDate);
  const activeStartDateObj =
    parsedStartDate && !Number.isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : (() => {
          const fallback = activeStartDate
            ? new Date(activeStartDate)
            : new Date();
          return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
        })();

  const recurrenceMaxThroughDate = getMaxThroughDate(activeStartDateObj);
  const currentThroughDate = recurrencePattern?.through
    ? parseLocalDateTime(`${recurrencePattern.through}T00:00:00`)
    : null;
  const clampedThroughDate = clampThroughDate(
    activeStartDateObj,
    currentThroughDate
  );
  const recurrenceThroughValue = formatDateOnly(clampedThroughDate);
  const recurrenceMinThroughValue = formatDateOnly(activeStartDateObj);
  const recurrenceMaxThroughValue = formatDateOnly(recurrenceMaxThroughDate);
  const liveRecurrencePattern = formData.is_recurring
    ? buildPattern(activeStartDate, {
        ...(recurrencePattern ?? {}),
        through: recurrenceThroughValue,
      } as RecurrencePattern)
    : recurrencePattern;
  const repeatOption = getRepeatOption(liveRecurrencePattern);

  const handleRecurrenceThroughChange = (value: string) => {
    if (!value) return;
    const selectedDate =
      parseLocalDateTime(`${value}T00:00:00`) ?? new Date(`${value}T00:00:00`);
    const clamped = clampThroughDate(activeStartDateObj, selectedDate);

    setRecurrencePattern((current) => {
      const base = current ?? buildPattern(activeStartDate, null);
      return buildPattern(activeStartDate, {
        ...base,
        through: formatDateOnly(clamped),
      });
    });
  };

  const handleRepeatOptionChange = (value: RepeatOption) => {
    setRecurrencePattern((current) =>
      buildPattern(activeStartDate, current, {
        frequency: value === "monthly" ? "monthly" : "weekly",
        interval: value === "every_2_weeks" ? 2 : 1,
        monthly_mode:
          value === "monthly" ? current?.monthly_mode ?? "by_date" : undefined,
      })
    );
  };

  const handleMonthlyModeChange = (mode: "by_date" | "by_weekday") => {
    setRecurrencePattern((current) =>
      buildPattern(activeStartDate, current, {
        frequency: "monthly",
        monthly_mode: mode,
      })
    );
  };

  const formatDateTimeLocal = (dateString: string) => {
    const date = parseLocalDateTime(dateString);
    if (!date) return "";
    return formatDateForInput(date);
  };

  const pendingAttendeeCount = recordedAttendeeCount(initialData);
  const attendeeLabel = pendingAttendeeCount === 1 ? "attendee" : "attendees";

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="space-y-6 text-sm max-w-3xl"
    >
      {scopeHint && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {scopeHint}
        </p>
      )}
      {isBookingRequest && !initialData && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This booking will be submitted for Events Coordinator approval. The
          room is held until they approve or reject it.
        </p>
      )}
      {conflictError && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {conflictError}
        </p>
      )}
      <div className="space-y-6 pr-1">
        <div>
          <div className="p-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Event Details
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Basic information about the event.
            </p>
            <div className="space-y-4">
              {/* Event Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="e.g., Sunday Worship Service"
                />
              </div>

              {/* Event Type, Branch, Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    {eventTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch *
                  </label>
                  <select
                    name="branch"
                    required
                    value={formData.branch}
                    onChange={handleChange}
                    disabled={!canPickBranch}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                  >
                    {formData.branch === "" && (
                      <option value="">Select branch</option>
                    )}
                    {(canPickBranch
                      ? branches
                      : branches.filter((branch) => branch.id === userBranchId)
                    ).map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                        {branch.is_headquarters ? " (HQ)" : ""}
                      </option>
                    ))}
                    {!canPickBranch &&
                      userBranchId !== "" &&
                      !branches.some((branch) => branch.id === userBranchId) && (
                        <option value={userBranchId}>
                          {user?.branch_name || `Branch #${userBranchId}`}
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room *
                  </label>
                  <select
                    name="room"
                    required
                    value={formData.room}
                    onChange={handleChange}
                    disabled={formData.branch === ""}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                  >
                    {formData.room === "" && (
                      <option value="" disabled>
                        Select room
                      </option>
                    )}
                    {roomChoices.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                        {room.capacity != null ? ` (${room.capacity})` : ""}
                      </option>
                    ))}
                    <option value={OFFSITE_ROOM}>Other / off-site</option>
                  </select>
                </div>
                {formData.room === OFFSITE_ROOM && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location *
                    </label>
                    <input
                      type="text"
                      name="location"
                      required
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder="e.g., Retreat center, park"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="Add any additional details about the event..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div>
          <div className="p-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Schedule
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              When the event will take place.
            </p>
            <div className="space-y-4">
              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    required
                    value={formatDateTimeLocal(formData.start_date)}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nextEnd = endDateFromStart(value);
                      setFormData((prev) => {
                        const next = {
                          ...prev,
                          start_date: value,
                          end_date: nextEnd || prev.end_date,
                        };
                        if (prev.is_recurring) {
                          setRecurrencePattern((current) =>
                            buildPattern(value, current)
                          );
                        }
                        return next;
                      });
                    }}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    required
                    value={formatDateTimeLocal(formData.end_date)}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => ({ ...prev, end_date: value }));
                    }}
                    className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>

              {/* Recurring Event */}
              <div className="flex items-center">
                <input
                  id="is_recurring"
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleChange}
                  disabled={lockRecurrence}
                  className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded disabled:opacity-50"
                />
                <label
                  htmlFor="is_recurring"
                  className="ml-2 block text-sm text-gray-700"
                >
                  This is a recurring event
                </label>
              </div>

              {formData.is_recurring && (
                <div className="ml-6 mt-3 space-y-3 border-l border-gray-200 pl-4">
                  <p className="text-xs text-gray-500">
                    {formatRecurrenceSummary(
                      liveRecurrencePattern,
                      activeStartDateObj.toLocaleDateString("en-US", {
                        weekday: "long",
                      })
                    )}
                  </p>

                  <div>
                    <label
                      htmlFor="recurrence_repeat"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Repeat
                    </label>
                    <select
                      id="recurrence_repeat"
                      value={repeatOption}
                      disabled={lockRecurrence}
                      onChange={(e) =>
                        handleRepeatOptionChange(e.target.value as RepeatOption)
                      }
                      className="w-full md:w-64 px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm disabled:opacity-50"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="every_2_weeks">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {repeatOption === "monthly" && (
                    <fieldset className="space-y-2" disabled={lockRecurrence}>
                      <legend className="text-xs font-medium text-gray-600">
                        Monthly on
                      </legend>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="monthly_mode"
                          checked={
                            liveRecurrencePattern?.monthly_mode !== "by_weekday"
                          }
                          onChange={() => handleMonthlyModeChange("by_date")}
                          className="h-4 w-4 text-primary focus:ring-ring border-gray-300"
                        />
                        {monthlyDateOptionLabel(activeStartDateObj)}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="monthly_mode"
                          checked={
                            liveRecurrencePattern?.monthly_mode === "by_weekday"
                          }
                          onChange={() => handleMonthlyModeChange("by_weekday")}
                          className="h-4 w-4 text-primary focus:ring-ring border-gray-300"
                        />
                        {monthlyWeekdayOptionLabel(activeStartDateObj)}
                      </label>
                    </fieldset>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Repeat until
                    </label>
                    <input
                      type="date"
                      value={recurrenceThroughValue}
                      min={recurrenceMinThroughValue}
                      max={recurrenceMaxThroughValue}
                      onChange={(e) =>
                        handleRecurrenceThroughChange(e.target.value)
                      }
                      className="w-full md:w-64 px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Schedule can be adjusted anytime. You can skip an
                      individual date later without removing the series.
                    </p>
                  </div>
                </div>
              )}

              {formData.type === "SUNDAY_SERVICE" && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      Expected Attendees
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      Active, Semi-active, and Inactive members define the
                      expected count for check-in. Ongoing visitors are included
                      in Total by default. Anyone can still be checked in at the
                      door.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="expected_include_active"
                        checked={formData.expected_include_active}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="expected_include_semiactive"
                        checked={formData.expected_include_semiactive}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Semi-active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="expected_include_inactive"
                        checked={formData.expected_include_inactive}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Inactive
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="expected_include_ongoing_visitors"
                        checked={formData.expected_include_ongoing_visitors}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Ongoing visitors
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button
          variant="tertiary"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          className="w-full sm:flex-1 min-h-[44px]" 
          disabled={loading} 
          type="submit"
        >
          {loading
            ? "Saving..."
            : initialData
            ? "Update Event"
            : isBookingRequest
              ? "Submit booking"
              : "Create Event"}
        </Button>
      </div>
    </form>
    <ConfirmationModal
      isOpen={dateMoveConfirm.isOpen}
      onClose={() => setDateMoveConfirm({ isOpen: false, payload: null })}
      onConfirm={() => {
        const payload = dateMoveConfirm.payload;
        setDateMoveConfirm({ isOpen: false, payload: null });
        if (payload) {
          void submitPayload(payload);
        }
      }}
      title="Move event date?"
      message={`${pendingAttendeeCount} ${attendeeLabel} already recorded for this event will move to the new date. Continue?`}
      confirmText="Move date"
      cancelText="Cancel"
      variant="warning"
      zIndex={80}
      loading={loading}
    />
    </>
  );
}

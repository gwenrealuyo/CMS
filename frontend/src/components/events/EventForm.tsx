"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { Event, RecurrencePattern } from "@/src/types/event";
import { useAuth } from "@/src/contexts/AuthContext";
import { useBranches } from "@/src/hooks/useBranches";
import { useEventRooms } from "@/src/hooks/useEventRooms";
import { equipmentBookingsApi, equipmentTypesApi } from "@/src/lib/api";
import { EquipmentType } from "@/src/types/facilities";
import Button from "../ui/Button";
import ConfirmationModal from "../ui/ConfirmationModal";
import { findScheduleConflict } from "@/src/lib/events/scheduleConflicts";
import {
  LAST_MINUTE_ADMIN_NOTE,
  isBeforeLastMinuteBuffer,
  isWithinRoomHoldAdvanceWindow,
} from "@/src/lib/events/roomHoldLeadTime";
import {
  RepeatOption,
  ScheduleKind,
  buildDailyPattern,
  buildRecurrencePattern,
  formatRecurrenceSummary,
  getRepeatOption,
  getScheduleKind,
  monthlyDateOptionLabel,
  monthlyWeekdayOptionLabel,
} from "@/src/lib/events/recurrenceLabel";

const OFFSITE_ROOM = "other";

type EventTypeFormOption = {
  value: string;
  label: string;
  counts_as_activity?: boolean;
};

interface EventFormProps {
  onSubmit: (event: Partial<Event>) => Promise<Event | void>;
  initialData?: Partial<Event>;
  presetDate?: Date | null;
  onClose?: () => void;
  eventTypeOptions?: EventTypeFormOption[];
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
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
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
      0,
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

const formatTimeOnly = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const combineDateAndTime = (dateValue: string, timeValue: string) => {
  const time = timeValue || "09:00";
  return `${dateValue}T${time}`;
};

const toDateTimeLocalValue = (value: string): string => {
  const date = parseLocalDateTime(value);
  if (!date) return "";
  return formatDateForInput(date);
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
  overrides?: Partial<RecurrencePattern>,
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
    overrides,
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
  track_expected_attendees: boolean;
  allow_cross_branch_attendance: boolean;
  tardy_grace_minutes: number;
  is_room_hold: boolean;
  estimated_headcount: number | "";
  self_checkin_enabled: boolean;
  attendance_format: "hybrid" | "online_only" | "onsite_only";
};

function withPlaceholders(
  defaults: Omit<FormDefaults, "branch" | "room">,
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
    | "track_expected_attendees"
    | "allow_cross_branch_attendance"
    | "tardy_grace_minutes"
    | "is_room_hold"
    | "estimated_headcount"
    | "self_checkin_enabled"
    | "attendance_format"
  >,
): Omit<FormDefaults, "branch" | "room"> {
  return {
    ...defaults,
    expected_include_active: true,
    expected_include_semiactive: true,
    expected_include_inactive: true,
    expected_include_ongoing_visitors: true,
    track_expected_attendees: defaults.type === "SUNDAY_SERVICE",
    allow_cross_branch_attendance: false,
    tardy_grace_minutes: 0,
    is_room_hold: defaults.type === "MEETING",
    estimated_headcount: "",
    self_checkin_enabled: defaults.type === "SUNDAY_SERVICE",
    attendance_format: "hybrid",
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
    }),
  );
}

function buildDefaultsFromDate(
  date: Date,
  eventTypeOptions: EventTypeFormOption[],
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
      }),
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
    }),
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
  const canManageNational = Boolean(user?.can_manage_national_events);
  const canPickBranch = Boolean(user?.can_see_all_branches);
  const { branches } = useBranches();
  const userBranchId =
    user?.branch != null && user.branch !== undefined
      ? Number(user.branch)
      : "";

  const visibleTypeOptions = useMemo(() => {
    return eventTypeOptions.filter(
      (option) =>
        option.value !== "AWTA" ||
        canManageNational ||
        initialData?.type === "AWTA",
    );
  }, [eventTypeOptions, canManageNational, initialData?.type]);

  const isEditingNationalLocked =
    Boolean(initialData) &&
    (initialData?.type === "AWTA" || initialData?.branch == null) &&
    !canManageNational;

  const defaultFormData = useMemo(() => {
    const defaultBranch =
      initialData != null
        ? initialData.branch != null
          ? Number(initialData.branch)
          : ""
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
        start_date:
          toDateTimeLocalValue(initialData.start_date || "") ||
          initialData.start_date ||
          "",
        end_date:
          toDateTimeLocalValue(initialData.end_date || "") ||
          initialData.end_date ||
          "",
        expected_include_active: initialData.expected_include_active ?? true,
        expected_include_semiactive:
          initialData.expected_include_semiactive ?? true,
        expected_include_inactive:
          initialData.expected_include_inactive ?? true,
        expected_include_ongoing_visitors:
          initialData.expected_include_ongoing_visitors ?? true,
        track_expected_attendees: initialData.track_expected_attendees ?? true,
        allow_cross_branch_attendance:
          initialData.allow_cross_branch_attendance ?? false,
        tardy_grace_minutes: initialData.tardy_grace_minutes ?? 0,
        is_room_hold:
          (initialData.type || "") === "MEETING" ||
          Boolean(initialData.is_room_hold),
        estimated_headcount:
          initialData.estimated_headcount != null
            ? Number(initialData.estimated_headcount)
            : "",
        self_checkin_enabled:
          initialData.self_checkin_enabled ??
          (initialData.type || "SUNDAY_SERVICE") === "SUNDAY_SERVICE",
        attendance_format: initialData.attendance_format ?? "hybrid",
      };
    }

    const base = presetDate
      ? buildDefaultsFromDate(presetDate, eventTypeOptions)
      : buildSundayTemplateDefaults();
    return { ...base, branch: defaultBranch };
  }, [initialData, presetDate, eventTypeOptions, userBranchId]);
  const [formData, setFormData] = useState(defaultFormData);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [equipmentSelected, setEquipmentSelected] = useState<
    Record<number, { qty: number; remarks: string }>
  >({});
  const [equipmentSectionOpen, setEquipmentSectionOpen] = useState(false);

  const allowsChurchWide =
    formData.type === "AWTA" && canManageNational && !isEditingNationalLocked;
  const isChurchWide = allowsChurchWide && formData.branch === "";

  const selectedBranchId =
    formData.branch === "" ? null : Number(formData.branch);
  const canBorrowEquipment =
    !isChurchWide &&
    formData.branch !== "" &&
    formData.room !== "" &&
    formData.room !== OFFSITE_ROOM;
  const { rooms } = useEventRooms({
    branchId: selectedBranchId,
    enabled: selectedBranchId != null,
  });

  useEffect(() => {
    if (!canBorrowEquipment || selectedBranchId == null) {
      setEquipmentTypes([]);
      return;
    }
    let cancelled = false;
    equipmentTypesApi
      .list({ branch: selectedBranchId, is_active: true })
      .then((res) => {
        if (!cancelled) {
          setEquipmentTypes(res.data as EquipmentType[]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEquipmentTypes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canBorrowEquipment, selectedBranchId]);

  useEffect(() => {
    if (!canBorrowEquipment) {
      setEquipmentSelected({});
    }
  }, [canBorrowEquipment]);
  const selectedTypeOption = useMemo(
    () =>
      visibleTypeOptions.find((option) => option.value === formData.type) ||
      eventTypeOptions.find((option) => option.value === formData.type),
    [formData.type, visibleTypeOptions, eventTypeOptions],
  );
  const selectedTypeIsActivity =
    selectedTypeOption?.counts_as_activity !== false;
  // Room hold is an explicit booking mode (plus MEETING type), not derived
  // from type first-activity eligibility.
  const isRoomHold =
    formData.type === "MEETING" || Boolean(formData.is_room_hold);
  const showEstimatedHeadcount = isRoomHold || isBookingRequest;
  const selectedRoomForCapacity = useMemo(() => {
    if (formData.room === "" || formData.room === OFFSITE_ROOM) return null;
    return rooms.find((room) => room.id === Number(formData.room)) ?? null;
  }, [formData.room, rooms]);
  const headcountOverCapacity = useMemo(() => {
    if (
      !showEstimatedHeadcount ||
      formData.estimated_headcount === "" ||
      selectedRoomForCapacity?.capacity == null
    ) {
      return false;
    }
    return Number(formData.estimated_headcount) > selectedRoomForCapacity.capacity;
  }, [
    showEstimatedHeadcount,
    formData.estimated_headcount,
    selectedRoomForCapacity,
  ]);
  const roomHoldNeedsLastMinute = useMemo(() => {
    if (!isRoomHold) return false;
    const start = parseLocalDateTime(formData.start_date);
    if (!start) return false;
    return isWithinRoomHoldAdvanceWindow(start);
  }, [isRoomHold, formData.start_date]);
  const lastMinuteFallbackRoom = useMemo(
    () => rooms.find((room) => room.is_active && room.is_last_minute_fallback) ?? null,
    [rooms],
  );
  const roomChoices = useMemo(() => {
    const base = rooms.filter(
      (room) =>
        room.is_active ||
        (initialData?.room != null && Number(initialData.room) === room.id),
    );
    if (!isRoomHold || !roomHoldNeedsLastMinute) {
      return base;
    }
    if (lastMinuteFallbackRoom) {
      return base.filter((room) => room.id === lastMinuteFallbackRoom.id);
    }
    return [];
  }, [
    rooms,
    initialData?.room,
    isRoomHold,
    roomHoldNeedsLastMinute,
    lastMinuteFallbackRoom,
  ]);

  const initialRecurrence = useMemo<RecurrencePattern | null>(() => {
    if (!initialData?.is_recurring) return null;
    const start = initialData.start_date || defaultFormData.start_date;
    const existing = initialData.recurrence_pattern || null;
    if (existing?.frequency === "daily") {
      const startDate = parseLocalDateTime(start) ?? new Date();
      const through = existing.through
        ? existing.through
        : formatDateOnly(clampThroughDate(startDate, null));
      return buildDailyPattern(through, existing);
    }
    return buildPattern(start, existing);
  }, [initialData, defaultFormData.start_date]);

  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern | null>(initialRecurrence);
  const [loading, setLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [dateMoveConfirm, setDateMoveConfirm] = useState<{
    isOpen: boolean;
    payload: Partial<Event> | null;
  }>({ isOpen: false, payload: null });

  // Only re-seed when opening a different event/preset — not when async
  // options refresh defaultFormData and would wipe Multi-day choices.
  const formSeedKey = `${initialData?.id ?? "new"}:${
    presetDate ? formatDateOnly(presetDate) : "none"
  }:${userBranchId || ""}`;
  useEffect(() => {
    setFormData(defaultFormData);
    setRecurrencePattern(initialRecurrence);
    // defaultFormData / initialRecurrence intentionally omitted — see formSeedKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSeedKey]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === "schedule_kind") {
      const nextKind = value as ScheduleKind;
      const sourceStart = formData.start_date || defaultFormData.start_date;
      const startDate = parseLocalDateTime(sourceStart) ?? getNextSundayAt9AM();
      const endDate =
        parseLocalDateTime(formData.end_date || defaultFormData.end_date) ??
        getNextSundayAt11AM();

      if (nextKind === "single") {
        setFormData((prev) => ({ ...prev, is_recurring: false }));
        setRecurrencePattern(null);
        return;
      }

      if (nextKind === "multi_day") {
        const sameDayEnd = new Date(startDate);
        sameDayEnd.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
        if (sameDayEnd <= startDate) {
          sameDayEnd.setTime(
            startDate.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000,
          );
        }
        const defaultThrough = new Date(startDate);
        defaultThrough.setDate(defaultThrough.getDate() + 2);
        const through = clampThroughDate(startDate, defaultThrough);
        setFormData((prev) => ({
          ...prev,
          is_recurring: true,
          start_date: formatDateForInput(startDate),
          end_date: formatDateForInput(sameDayEnd),
        }));
        setRecurrencePattern(
          buildDailyPattern(formatDateOnly(through), recurrencePattern),
        );
        return;
      }

      setFormData((prev) => ({ ...prev, is_recurring: true }));
      setRecurrencePattern((current) =>
        buildPattern(sourceStart, current, {
          frequency: "weekly",
          interval: 1,
        }),
      );
      return;
    }

    if (name === "branch") {
      const nextBranch = value ? Number(value) : "";
      setFormData((prev) => ({
        ...prev,
        branch: nextBranch,
        room: nextBranch === "" ? OFFSITE_ROOM : "",
        location: nextBranch === "" ? prev.location : "",
        allow_cross_branch_attendance:
          nextBranch === "" ? false : prev.allow_cross_branch_attendance,
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

    if (name === "tardy_grace_minutes") {
      const parsed = Number.parseInt(value, 10);
      setFormData((prev) => ({
        ...prev,
        tardy_grace_minutes:
          Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
      }));
      return;
    }

    if (name === "estimated_headcount") {
      if (value === "") {
        setFormData((prev) => ({ ...prev, estimated_headcount: "" }));
        return;
      }
      const parsed = Number.parseInt(value, 10);
      setFormData((prev) => ({
        ...prev,
        estimated_headcount:
          Number.isFinite(parsed) && parsed >= 1 ? parsed : "",
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
          visibleTypeOptions.find((option) => option.value === value)?.label ||
          eventTypeOptions.find((option) => option.value === value)?.label ||
          value;
        nextState.title = optionLabel;
        if (value === "MEETING") {
          nextState.is_room_hold = true;
        }
        const nextIsRoomHold =
          value === "MEETING" || Boolean(nextState.is_room_hold);
        if (nextIsRoomHold && prev.room === OFFSITE_ROOM) {
          nextState.room = "";
          nextState.location = "";
        }
        if (nextIsRoomHold) {
          nextState.self_checkin_enabled = false;
          nextState.attendance_format = "hybrid";
        } else if (value === "SUNDAY_SERVICE") {
          nextState.self_checkin_enabled = true;
          nextState.attendance_format = "hybrid";
        } else if (prev.type === "SUNDAY_SERVICE") {
          nextState.self_checkin_enabled = false;
        }
        if (!nextIsRoomHold && !isBookingRequest) {
          nextState.estimated_headcount = "";
        }
        if (!initialData) {
          nextState.track_expected_attendees = value === "SUNDAY_SERVICE";
        }
        if (value !== "AWTA" && prev.branch === "") {
          nextState.branch = userBranchId === "" ? "" : userBranchId;
          nextState.room = "";
          nextState.location = "";
        }
      }

      if (name === "is_room_hold") {
        const checkedHold = Boolean(checked);
        nextState.is_room_hold =
          prev.type === "MEETING" ? true : checkedHold;
        if (nextState.is_room_hold) {
          nextState.self_checkin_enabled = false;
          nextState.attendance_format = "hybrid";
          if (prev.room === OFFSITE_ROOM) {
            nextState.room = "";
            nextState.location = "";
          }
        } else if (!isBookingRequest) {
          nextState.estimated_headcount = "";
        }
      }

      if (name === "attendance_format") {
        if (value === "onsite_only") {
          nextState.self_checkin_enabled = false;
        } else if (value === "online_only") {
          nextState.self_checkin_enabled = true;
        }
      }

      nextStartDate = nextState.start_date;

      return nextState;
    });

    if (
      name === "type" &&
      (formData.is_recurring || recurrencePattern) &&
      nextStartDate
    ) {
      setRecurrencePattern((current) => {
        if (current?.frequency === "daily") {
          return buildDailyPattern(
            current.through ||
              formatDateOnly(
                clampThroughDate(
                  parseLocalDateTime(nextStartDate as string) ?? new Date(),
                  null,
                ),
              ),
            current,
          );
        }
        return buildPattern(nextStartDate as string, current);
      });
    }
  };

  const submitEquipmentForEvent = async (saved: Event) => {
    const items_write = Object.entries(equipmentSelected)
      .filter(([, v]) => v.qty > 0)
      .map(([id, v]) => ({
        equipment_type: Number(id),
        quantity: v.qty,
        requester_remarks: v.remarks,
      }));
    if (items_write.length === 0) return;
    if (saved.room == null) return;
    try {
      await equipmentBookingsApi.create({
        title: `Equipment for ${saved.title}`,
        event: Number(saved.id),
        start_date: saved.start_date,
        end_date: saved.end_date,
        items_write,
      });
      toast.success(
        saved.booking_status === "pending"
          ? "Equipment borrow submitted for approval."
          : "Equipment borrow created.",
      );
      setEquipmentSelected({});
    } catch (error: unknown) {
      const details = (
        error as {
          response?: {
            data?: {
              message?: string;
              details?: {
                items?: string[];
                event?: string[];
                start_date?: string[];
              };
            };
          };
        }
      )?.response?.data?.details;
      const message =
        details?.event?.[0] ||
        details?.start_date?.[0] ||
        details?.items?.[0] ||
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "Event saved, but equipment borrow failed.";
      toast.error(String(message));
    }
  };

  const submitPayload = async (payload: Partial<Event>) => {
    try {
      setLoading(true);
      const result = await onSubmit(payload);
      if (result && typeof result === "object" && "id" in result) {
        await submitEquipmentForEvent(result as Event);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let patternToSend = recurrencePattern;
    const scheduleKind = getScheduleKind(
      formData.is_recurring,
      recurrencePattern,
    );

    if (formData.is_recurring) {
      const baseStart = formData.start_date || defaultFormData.start_date;
      if (scheduleKind === "multi_day") {
        const startDate = parseLocalDateTime(baseStart) ?? new Date();
        const through =
          patternToSend?.through ||
          formatDateOnly(clampThroughDate(startDate, null));
        patternToSend = buildDailyPattern(through, patternToSend);
        setRecurrencePattern(patternToSend);
      } else if (!patternToSend) {
        patternToSend = buildPattern(baseStart, null);
        setRecurrencePattern(patternToSend);
      } else {
        patternToSend = buildPattern(baseStart, patternToSend);
        setRecurrencePattern(patternToSend);
      }
    }

    const startSource = formData.start_date || defaultFormData.start_date;
    const endSource = formData.end_date || defaultFormData.end_date;

    if (scheduleKind === "multi_day") {
      const startDate = parseLocalDateTime(startSource);
      const endDate = parseLocalDateTime(endSource);
      if (startDate && endDate) {
        const sameDay =
          startDate.getFullYear() === endDate.getFullYear() &&
          startDate.getMonth() === endDate.getMonth() &&
          startDate.getDate() === endDate.getDate();
        if (!sameDay || endDate <= startDate) {
          const message =
            "Multi-day events need a daily end time after the daily start time on the first day.";
          setConflictError(message);
          return;
        }
        const through = patternToSend?.through;
        if (!through || through < formatDateOnly(startDate)) {
          const message = "Last date must be on or after the first date.";
          setConflictError(message);
          return;
        }
      }
    }

    const startIso = toUtcISOString(startSource) ?? startSource;
    const endIso = toUtcISOString(endSource) ?? endSource;
    if (formData.room === "") {
      return;
    }
    if (!allowsChurchWide && formData.branch === "") {
      setConflictError("Branch is required.");
      return;
    }
    const isOffsite = formData.room === OFFSITE_ROOM;
    if (isChurchWide && !isOffsite) {
      setConflictError(
        "Church-wide events must use Other / off-site with a dedicated venue location.",
      );
      return;
    }
    if (isRoomHold && isOffsite) {
      setConflictError(
        "Meeting events must use a room in the church building.",
      );
      return;
    }
    if (isRoomHold) {
      const startLocal = parseLocalDateTime(formData.start_date);
      if (startLocal && isWithinRoomHoldAdvanceWindow(startLocal)) {
        if (isBeforeLastMinuteBuffer(startLocal)) {
          setConflictError(
            "Last-minute room holds must start at least 15 minutes from now. Contact church building administrators if you still need a room.",
          );
          return;
        }
        if (!lastMinuteFallbackRoom) {
          setConflictError(
            "Room holds must be booked at least 24 hours ahead. No last-minute room is configured. Contact church building administrators if you still need a room.",
          );
          return;
        }
        if (Number(formData.room) !== lastMinuteFallbackRoom.id) {
          setConflictError(
            `Room holds within 24 hours may only use the last-minute room ("${lastMinuteFallbackRoom.name}").`,
          );
          return;
        }
      }
    }
    const selectedRoom = roomChoices.find(
      (room) => room.id === Number(formData.room),
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
      track_expected_attendees: isRoomHold
        ? false
        : formData.track_expected_attendees,
      allow_cross_branch_attendance:
        isRoomHold || formData.branch === ""
          ? false
          : formData.allow_cross_branch_attendance,
      tardy_grace_minutes: formData.tardy_grace_minutes,
      is_room_hold: isRoomHold || formData.type === "MEETING",
      estimated_headcount: showEstimatedHeadcount
        ? formData.estimated_headcount === ""
          ? null
          : Number(formData.estimated_headcount)
        : null,
      counts_toward_first_activity:
        !isRoomHold &&
        formData.type !== "MEETING" &&
        selectedTypeIsActivity,
      self_checkin_enabled: isRoomHold
        ? false
        : formData.attendance_format === "onsite_only"
          ? false
          : formData.self_checkin_enabled,
      attendance_format: isRoomHold ? "hybrid" : formData.attendance_format,
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
    currentThroughDate,
  );
  const recurrenceThroughValue = formatDateOnly(clampedThroughDate);
  const recurrenceMinThroughValue = formatDateOnly(activeStartDateObj);
  const recurrenceMaxThroughValue = formatDateOnly(recurrenceMaxThroughDate);
  const scheduleKind = getScheduleKind(
    formData.is_recurring,
    recurrencePattern,
  );
  const liveRecurrencePattern = formData.is_recurring
    ? scheduleKind === "multi_day"
      ? buildDailyPattern(recurrenceThroughValue, recurrencePattern)
      : buildPattern(activeStartDate, {
          ...(recurrencePattern ?? {}),
          through: recurrenceThroughValue,
        } as RecurrencePattern)
    : recurrencePattern;
  const repeatOption = getRepeatOption(liveRecurrencePattern);
  const multiDayStartDate = formatDateOnly(activeStartDateObj);
  const multiDayStartTime = formatTimeOnly(activeStartDateObj);
  const activeEndDate =
    parseLocalDateTime(formData.end_date || defaultFormData.end_date) ??
    activeStartDateObj;
  const multiDayEndTime = formatTimeOnly(activeEndDate);

  const applyMultiDayDateTimes = (
    nextStartDate: string,
    nextEndDate: string,
    nextStartTime: string,
    nextEndTime: string,
  ) => {
    const startLocal = combineDateAndTime(nextStartDate, nextStartTime);
    let endLocal = combineDateAndTime(nextStartDate, nextEndTime);
    const startParsed = parseLocalDateTime(startLocal);
    const endParsed = parseLocalDateTime(endLocal);
    if (startParsed && endParsed && endParsed <= startParsed) {
      endLocal = endDateFromStart(startLocal);
    }
    const throughCandidate =
      parseLocalDateTime(`${nextEndDate}T00:00:00`) ??
      parseLocalDateTime(`${nextStartDate}T00:00:00`);
    const clamped = clampThroughDate(
      startParsed ?? activeStartDateObj,
      throughCandidate,
    );
    setFormData((prev) => ({
      ...prev,
      is_recurring: true,
      start_date: startLocal,
      end_date: endLocal,
    }));
    setRecurrencePattern((current) =>
      buildDailyPattern(formatDateOnly(clamped), current),
    );
  };

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
          value === "monthly"
            ? (current?.monthly_mode ?? "by_date")
            : undefined,
      }),
    );
  };

  const handleMonthlyModeChange = (mode: "by_date" | "by_weekday") => {
    setRecurrencePattern((current) =>
      buildPattern(activeStartDate, current, {
        frequency: "monthly",
        monthly_mode: mode,
      }),
    );
  };

  const formatDateTimeLocal = (dateString: string) => {
    return toDateTimeLocalValue(dateString);
  };

  const pendingAttendeeCount = recordedAttendeeCount(initialData);
  const attendeeLabel = pendingAttendeeCount === 1 ? "attendee" : "attendees";

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 text-sm max-w-3xl">
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
                      disabled={isEditingNationalLocked}
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                    >
                      {visibleTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch{allowsChurchWide ? "" : " *"}
                    </label>
                    <select
                      name="branch"
                      required={!allowsChurchWide}
                      value={formData.branch}
                      onChange={handleChange}
                      disabled={
                        (!canPickBranch && !allowsChurchWide) ||
                        isEditingNationalLocked
                      }
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                    >
                      {allowsChurchWide && (
                        <option value="">Church-wide</option>
                      )}
                      {!allowsChurchWide && formData.branch === "" && (
                        <option value="">Select branch</option>
                      )}
                      {(canPickBranch
                        ? branches
                        : branches.filter(
                            (branch) => branch.id === userBranchId,
                          )
                      ).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                          {branch.is_headquarters ? " (HQ)" : ""}
                        </option>
                      ))}
                      {!canPickBranch &&
                        userBranchId !== "" &&
                        !branches.some(
                          (branch) => branch.id === userBranchId,
                        ) && (
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
                      disabled={
                        isChurchWide ||
                        (formData.branch === "" && !allowsChurchWide) ||
                        isEditingNationalLocked
                      }
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                    >
                      {formData.room === "" && (
                        <option value="" disabled>
                          Select room
                        </option>
                      )}
                      {!isChurchWide &&
                        roomChoices.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                            {room.capacity != null ? ` (${room.capacity})` : ""}
                          </option>
                        ))}
                      {!isRoomHold && (
                        <option value={OFFSITE_ROOM}>Other / off-site</option>
                      )}
                    </select>
                  </div>
                  {formData.room === OFFSITE_ROOM && !isRoomHold && (
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
                        disabled={isEditingNationalLocked}
                        className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-gray-100"
                        placeholder={
                          isChurchWide
                            ? "e.g., SMX Convention Center"
                            : "e.g., Retreat center, park"
                        }
                      />
                    </div>
                  )}
                </div>
                {isChurchWide && (
                  <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    Church-wide AWTA is visible to all branches. Use Other /
                    off-site for the dedicated venue. Online check-in still uses
                    Home altar or Cluster house.
                  </p>
                )}
                {isEditingNationalLocked && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Only HQ Events coordinators and above can change AWTA or
                    church-wide event details.
                  </p>
                )}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_room_hold"
                      checked={isRoomHold}
                      disabled={formData.type === "MEETING"}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">
                        Room booking / meeting only
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Requires a room in the church building. Door attendance
                        is allowed; self-check-in and first activity credit are
                        off. Keep the event type to show which activity this is
                        about (e.g. Clustering, Mini Worship).
                      </span>
                    </span>
                  </label>
                  {isRoomHold ? (
                    <p className="text-xs text-gray-600">
                      This books a room in the church building. It is not
                      recorded as a person&apos;s first activity attended.
                    </p>
                  ) : !selectedTypeIsActivity ? (
                    <p className="text-xs text-gray-600">
                      This event type is not eligible for first activity
                      attended (configured under Manage Types).
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Guest check-in may set first activity to this type
                      (eligible under Manage Types).
                    </p>
                  )}
                </div>
                {isRoomHold && roomHoldNeedsLastMinute && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {LAST_MINUTE_ADMIN_NOTE}
                    {lastMinuteFallbackRoom
                      ? ` Available now: ${lastMinuteFallbackRoom.name}.`
                      : " No last-minute room is configured for this branch."}
                  </p>
                )}

                {showEstimatedHeadcount && (
                  <div>
                    <label
                      htmlFor="event-estimated-headcount"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Estimated headcount
                    </label>
                    <input
                      id="event-estimated-headcount"
                      type="number"
                      name="estimated_headcount"
                      min={1}
                      step={1}
                      value={formData.estimated_headcount}
                      onChange={handleChange}
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder="Optional"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Helps approvers check room fit. Not used for attendance
                      tracking.
                    </p>
                    {headcountOverCapacity && (
                      <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Estimated headcount (
                        {formData.estimated_headcount}) is above{" "}
                        {selectedRoomForCapacity?.name} capacity (
                        {selectedRoomForCapacity?.capacity}). You can still
                        submit.
                      </p>
                    )}
                  </div>
                )}

                {canBorrowEquipment && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      className="w-full flex items-start justify-between gap-3 p-4 text-left min-h-[44px]"
                      aria-expanded={equipmentSectionOpen}
                      onClick={() =>
                        setEquipmentSectionOpen((open) => !open)
                      }
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-800">
                          Borrow equipment
                          {Object.keys(equipmentSelected).length > 0 ? (
                            <span className="ml-2 font-normal text-gray-500">
                              ({Object.keys(equipmentSelected).length} selected)
                            </span>
                          ) : (
                            <span className="ml-2 font-normal text-gray-400">
                              Optional
                            </span>
                          )}
                        </h4>
                        {!equipmentSectionOpen && (
                          <p className="mt-1 text-xs text-gray-500">
                            Expand to borrow building equipment for this event.
                          </p>
                        )}
                      </div>
                      <span
                        className="shrink-0 text-gray-500 text-sm leading-5"
                        aria-hidden
                      >
                        {equipmentSectionOpen ? "▾" : "▸"}
                      </span>
                    </button>
                    {equipmentSectionOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-xs text-gray-500">
                          Borrow window matches this event&apos;s schedule. Only
                          available for rooms in the church building.
                        </p>
                        {equipmentTypes.length === 0 ? (
                          <p className="text-xs text-gray-500">
                            No equipment catalog for this branch yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {equipmentTypes.map((type) => {
                              const selected = equipmentSelected[type.id];
                              return (
                                <div
                                  key={type.id}
                                  className="rounded border border-gray-200 bg-white p-3 space-y-2"
                                >
                                  <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selected)}
                                      onChange={(e) => {
                                        setEquipmentSelected((prev) => {
                                          const next = { ...prev };
                                          if (e.target.checked) {
                                            next[type.id] = {
                                              qty: 1,
                                              remarks: "",
                                            };
                                          } else {
                                            delete next[type.id];
                                          }
                                          return next;
                                        });
                                      }}
                                      className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                                    />
                                    {type.name} (available:{" "}
                                    {type.quantity_available})
                                  </label>
                                  {selected && (
                                    <>
                                      <input
                                        type="number"
                                        min={1}
                                        max={type.quantity_available}
                                        value={selected.qty}
                                        onChange={(e) =>
                                          setEquipmentSelected((prev) => ({
                                            ...prev,
                                            [type.id]: {
                                              ...prev[type.id],
                                              qty: Number(e.target.value) || 1,
                                            },
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                                        aria-label={`${type.name} quantity`}
                                      />
                                      <input
                                        placeholder="Optional remarks"
                                        value={selected.remarks}
                                        onChange={(e) =>
                                          setEquipmentSelected((prev) => ({
                                            ...prev,
                                            [type.id]: {
                                              ...prev[type.id],
                                              remarks: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[44px]"
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                <fieldset disabled={lockRecurrence} className="space-y-2">
                  <legend className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule type
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        [
                          "single",
                          "Single-day",
                          "One date (or overnight span)",
                        ],
                        [
                          "multi_day",
                          "Multi-day",
                          "Same hours each day, e.g. AWTA",
                        ],
                        ["recurring", "Recurring", "Weekly / monthly pattern"],
                      ] as const
                    ).map(([value, label, hint]) => {
                      const selected = scheduleKind === value;
                      return (
                        <label
                          key={value}
                          className={[
                            "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 min-h-[44px] cursor-pointer transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                          ].join(" ")}
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium">
                            <input
                              type="radio"
                              name="schedule_kind"
                              value={value}
                              checked={selected}
                              onChange={handleChange}
                              className="h-4 w-4 text-primary focus:ring-ring border-gray-300"
                            />
                            {label}
                          </span>
                          <span
                            className={[
                              "text-[11px] pl-6",
                              selected ? "text-primary/80" : "text-gray-500",
                            ].join(" ")}
                          >
                            {hint}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {scheduleKind === "multi_day" ? (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                      Same daily start and end time on every date from the first
                      day through the last day.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First date *
                        </label>
                        <input
                          type="date"
                          required
                          value={multiDayStartDate}
                          disabled={lockRecurrence}
                          onChange={(e) =>
                            applyMultiDayDateTimes(
                              e.target.value,
                              recurrenceThroughValue,
                              multiDayStartTime,
                              multiDayEndTime,
                            )
                          }
                          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last date *
                        </label>
                        <input
                          type="date"
                          required
                          value={recurrenceThroughValue}
                          min={recurrenceMinThroughValue}
                          max={recurrenceMaxThroughValue}
                          disabled={lockRecurrence}
                          onChange={(e) =>
                            applyMultiDayDateTimes(
                              multiDayStartDate,
                              e.target.value,
                              multiDayStartTime,
                              multiDayEndTime,
                            )
                          }
                          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Daily start time *
                        </label>
                        <input
                          type="time"
                          required
                          value={multiDayStartTime}
                          disabled={lockRecurrence}
                          onChange={(e) =>
                            applyMultiDayDateTimes(
                              multiDayStartDate,
                              recurrenceThroughValue,
                              e.target.value,
                              multiDayEndTime,
                            )
                          }
                          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Daily end time *
                        </label>
                        <input
                          type="time"
                          required
                          value={multiDayEndTime}
                          disabled={lockRecurrence}
                          onChange={(e) =>
                            applyMultiDayDateTimes(
                              multiDayStartDate,
                              recurrenceThroughValue,
                              multiDayStartTime,
                              e.target.value,
                            )
                          }
                          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatRecurrenceSummary(liveRecurrencePattern)}
                    </p>
                  </div>
                ) : (
                  <>
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
                                  buildPattern(value, current),
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
                            setFormData((prev) => ({
                              ...prev,
                              end_date: value,
                            }));
                          }}
                          className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
                        />
                      </div>
                    </div>

                    {scheduleKind === "recurring" && (
                      <div className="ml-0 mt-1 space-y-3 border-l border-gray-200 pl-4">
                        <p className="text-xs text-gray-500">
                          {formatRecurrenceSummary(
                            liveRecurrencePattern,
                            activeStartDateObj.toLocaleDateString("en-US", {
                              weekday: "long",
                            }),
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
                              handleRepeatOptionChange(
                                e.target.value as RepeatOption,
                              )
                            }
                            className="w-full md:w-64 px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm disabled:opacity-50"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="every_2_weeks">Every 2 weeks</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        {repeatOption === "monthly" && (
                          <fieldset
                            className="space-y-2"
                            disabled={lockRecurrence}
                          >
                            <legend className="text-xs font-medium text-gray-600">
                              Monthly on
                            </legend>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="radio"
                                name="monthly_mode"
                                checked={
                                  liveRecurrencePattern?.monthly_mode !==
                                  "by_weekday"
                                }
                                onChange={() =>
                                  handleMonthlyModeChange("by_date")
                                }
                                className="h-4 w-4 text-primary focus:ring-ring border-gray-300"
                              />
                              {monthlyDateOptionLabel(activeStartDateObj)}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="radio"
                                name="monthly_mode"
                                checked={
                                  liveRecurrencePattern?.monthly_mode ===
                                  "by_weekday"
                                }
                                onChange={() =>
                                  handleMonthlyModeChange("by_weekday")
                                }
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
                  </>
                )}

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      Tardy grace period
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      Minutes after the event start before a check-in counts as
                      tardy. Use 0 for no grace (default for Sunday Service).
                    </p>
                  </div>
                  <label className="block text-sm text-gray-700">
                    <span className="sr-only">Tardy grace minutes</span>
                    <input
                      type="number"
                      name="tardy_grace_minutes"
                      min={0}
                      step={1}
                      value={formData.tardy_grace_minutes}
                      onChange={handleChange}
                      className="w-full md:w-40 px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      minutes
                    </span>
                  </label>
                </div>

                {!isRoomHold && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Attendance format
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        Hybrid allows door check-in and online (online needs a
                        venue like Home altar). Online only is remote with no
                        venue. Onsite only is door/station only.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(
                        [
                          ["hybrid", "Hybrid (onsite + online)"],
                          ["online_only", "Online only"],
                          ["onsite_only", "Onsite only"],
                        ] as const
                      ).map(([value, label]) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="radio"
                            name="attendance_format"
                            value={value}
                            checked={formData.attendance_format === value}
                            onChange={handleChange}
                            className="h-4 w-4 text-primary focus:ring-ring border-gray-300"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!isRoomHold &&
                  formData.attendance_format !== "onsite_only" && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">
                          Online self-check-in
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {formData.attendance_format === "online_only"
                            ? "When enabled, members check in online (no venue) on days this event occurs, if church-wide member self-check-in is also open."
                            : "When enabled, members can check in online (public LAMP ID link and logged-in household) on days this event occurs, if church-wide member self-check-in is also open. Hybrid online check-in asks for Home altar or Cluster house."}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="self_checkin_enabled"
                          checked={formData.self_checkin_enabled}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                        />
                        Open for online self-check-in
                      </label>
                    </div>
                  )}

                {!isRoomHold && !isBookingRequest && formData.branch !== "" && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Cross-branch attendance
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        When enabled, people from other branches can check in
                        and self-check-in. They are not counted in Expected when
                        tracking is on (useful for anniversary Sundays at a
                        dedicated venue).
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="allow_cross_branch_attendance"
                        checked={formData.allow_cross_branch_attendance}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Allow other branches to check in
                    </label>
                  </div>
                )}

                {!isRoomHold && !isBookingRequest && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">
                        Expected Attendees
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        When tracking is on, Active / Semi-active / Inactive /
                        Ongoing visitors define Total and Remaining for
                        check-in. When off, the event is open headcount-only.
                        Anyone can still be checked in at the door.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="track_expected_attendees"
                        checked={formData.track_expected_attendees}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
                      />
                      Track expected attendees
                    </label>
                    {formData.track_expected_attendees ? (
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
                    ) : null}
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

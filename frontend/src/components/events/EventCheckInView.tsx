"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import toast from "react-hot-toast";

import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import EventAttendanceReportModal from "@/src/components/events/EventAttendanceReportModal";
import EditAttendanceModeControl from "@/src/components/events/EditAttendanceModeControl";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { usePeople } from "@/src/hooks/usePeople";
import { attendanceVenuesApi, eventsApi } from "@/src/lib/api";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import {
  isAttendanceReportAvailable,
  resolveAttendanceClusterLabel,
} from "@/src/lib/events/attendanceReportUtils";
import {
  countExpectedOngoingVisitors,
  filterEligibleMembersByQuery,
  formatLampIdDisplay,
  getCheckedInPersonIds,
  getEligibleMembers,
  getExpectedMembers,
  resolvePersonFromEntry,
  resolvePersonFromMemberId,
  tracksExpectedAttendees,
} from "@/src/lib/events/checkInUtils";
import { formatPersonName } from "@/src/lib/name";
import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import {
  AttendanceMode,
  AttendanceVenueOption,
  Event,
  EventAttendanceRecord,
} from "@/src/types/event";
import { Person } from "@/src/types/person";

type EntryTab = "manual" | "camera";
type StationMode = AttendanceMode;
type CheckInFlash = "success" | "already" | "error";

const SCAN_COOLDOWN_MS = 2000;
const FLASH_DURATION_MS = 700;
const CHECK_IN_TOAST = {
  duration: 4500,
  style: {
    fontSize: "1.125rem",
    fontWeight: 600,
    lineHeight: "1.4",
    maxWidth: "28rem",
    padding: "1rem 1.25rem",
  },
};

function showCheckInToast(kind: CheckInFlash, message: string) {
  if (kind === "error") {
    toast.error(message, CHECK_IN_TOAST);
    return;
  }
  toast.success(message, CHECK_IN_TOAST);
}

const CheckInQrScanner = dynamic(() => import("./CheckInQrScanner"), {
  ssr: false,
  loading: () => (
    <p className="mt-4 text-sm text-muted-foreground">Starting camera…</p>
  ),
});

interface EventCheckInViewProps {
  eventId: string;
  occurrenceDate: string;
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

function CheckInStatusBanner({
  kind,
  message,
  person,
  onClose,
}: {
  kind: CheckInFlash;
  message: string;
  person?: Person;
  onClose: () => void;
}) {
  const styles =
    kind === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : kind === "already"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-700";
  const closeStyles =
    kind === "success"
      ? "text-green-700 hover:bg-green-100"
      : kind === "already"
        ? "text-amber-800 hover:bg-amber-100"
        : "text-red-700 hover:bg-red-100";
  return (
    <div
      role="status"
      className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3.5 text-base font-medium leading-snug ${styles}`}
    >
      {person && <PersonAvatar person={person} size="md" enlargeable={true} />}
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className={`-mr-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ${closeStyles}`}
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  iconClassName,
}: {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-primary/15 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-3xl font-semibold text-lighthouse-navy">
            {value}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <p className="mt-1 text-xs leading-snug text-gray-400">
            {description}
          </p>
        </div>
        <div
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function EventCheckInView({
  eventId,
  occurrenceDate,
}: EventCheckInViewProps) {
  const { people, loading: peopleLoading } = usePeople();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<
    EventAttendanceRecord[]
  >([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [entryTab, setEntryTab] = useState<EntryTab>("manual");
  const [stationMode, setStationMode] = useState<StationMode>("ONSITE");
  const [onlineVenueCode, setOnlineVenueCode] = useState("");
  const [venues, setVenues] = useState<AttendanceVenueOption[]>([]);
  const [entryValue, setEntryValue] = useState("");
  const [checkInSearchTerm, setCheckInSearchTerm] = useState("");
  const [clusterFilter, setClusterFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<"" | AttendanceMode>("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [actionBanner, setActionBanner] = useState<{
    kind: CheckInFlash;
    message: string;
    person?: Person;
  } | null>(null);
  const [flash, setFlash] = useState<CheckInFlash | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    isOpen: boolean;
    record: EventAttendanceRecord | null;
    loading: boolean;
  }>({ isOpen: false, record: null, loading: false });
  const [reportOpen, setReportOpen] = useState(false);
  const canGenerateReport = isAttendanceReportAvailable(occurrenceDate);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const scanCooldownUntilRef = useRef(0);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback((kind: CheckInFlash) => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    setFlash(kind);
    flashTimeoutRef.current = setTimeout(() => {
      setFlash(null);
      flashTimeoutRef.current = null;
    }, FLASH_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const fetchEvent = useCallback(async () => {
    setEventLoading(true);
    try {
      const response = await eventsApi.getById(eventId);
      setEvent(response.data);
      setEventError(null);
      const format = response.data.attendance_format ?? "hybrid";
      if (format === "online_only") {
        setStationMode("ONLINE");
        setOnlineVenueCode("");
      } else if (format === "onsite_only") {
        setStationMode("ONSITE");
        setOnlineVenueCode("");
      }
    } catch {
      setEventError("Unable to load this event. Please try again.");
    } finally {
      setEventLoading(false);
    }
  }, [eventId]);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const response = await eventsApi.listAttendance(eventId, {
        occurrence_date: occurrenceDate,
      });
      setAttendanceRecords(response.data);
    } catch {
      setActionBanner({
        kind: "error",
        message: "Unable to load attendance for this occurrence.",
      });
      showCheckInToast(
        "error",
        "Unable to load attendance for this occurrence.",
      );
    } finally {
      setAttendanceLoading(false);
    }
  }, [eventId, occurrenceDate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

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
    if (stationMode === "ONLINE" && entryTab === "camera") {
      setEntryTab("manual");
    }
  }, [stationMode, entryTab]);

  const handleStationModeChange = (mode: StationMode) => {
    setStationMode(mode);
    setModeFilter(mode);
  };

  const venueSelectOptions = useMemo(
    () =>
      venues.map((venue) => ({
        value: venue.code,
        label: venue.label,
      })),
    [venues],
  );

  const checkInCandidates = useMemo(() => {
    if (!event) return [];
    return getEligibleMembers(people, event);
  }, [people, event]);

  const expectedMembers = useMemo(() => {
    if (!event) return [];
    return getExpectedMembers(people, event);
  }, [people, event]);

  const checkedInIds = useMemo(
    () => getCheckedInPersonIds(attendanceRecords),
    [attendanceRecords],
  );

  const expectedIds = useMemo(
    () => new Set(expectedMembers.map((person) => String(person.id))),
    [expectedMembers],
  );

  const totalCount = expectedMembers.length;
  const checkedInCount = checkedInIds.size;
  const remainingCount = Array.from(expectedIds).filter(
    (id) => !checkedInIds.has(id),
  ).length;
  const showsExpectedStats = event ? tracksExpectedAttendees(event) : false;
  const ongoingVisitorExpectedCount = useMemo(() => {
    if (!event) return 0;
    return countExpectedOngoingVisitors(people, event);
  }, [people, event]);

  const recentCheckIns = useMemo(
    () =>
      [...attendanceRecords].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      ),
    [attendanceRecords],
  );

  const clusterFilterOptions = useMemo(() => {
    const codes = new Set<string>();
    let hasNoCluster = false;
    for (const record of recentCheckIns) {
      const label = resolveAttendanceClusterLabel(
        record.person.cluster_codes,
        record.person.role
      );
      if (label === "NO CLUSTER") {
        hasNoCluster = true;
      } else if (label !== "—") {
        codes.add(label);
      }
    }
    return {
      codes: Array.from(codes).sort((a, b) => a.localeCompare(b)),
      hasNoCluster,
    };
  }, [recentCheckIns]);

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

  const filteredRecentCheckIns = useMemo(() => {
    let filtered = recentCheckIns;

    if (modeFilter) {
      filtered = filtered.filter(
        (record) => (record.attendance_mode || "ONSITE") === modeFilter,
      );
    }

    if (clusterFilter === "NO_CLUSTER") {
      filtered = filtered.filter(
        (record) =>
          resolveAttendanceClusterLabel(
            record.person.cluster_codes,
            record.person.role
          ) === "NO CLUSTER"
      );
    } else if (clusterFilter) {
      filtered = filtered.filter(
        (record) =>
          resolveAttendanceClusterLabel(
            record.person.cluster_codes,
            record.person.role
          ) === clusterFilter
      );
    }

    const trimmed = checkInSearchTerm.trim();
    if (!trimmed) {
      return filtered;
    }
    const term = trimmed.toLowerCase();
    const termWithoutLampPrefix = term.replace(/^lamp/, "");
    return filtered.filter((record) => {
      const name = formatPersonName(record.person).toLowerCase();
      const memberId = (record.person.member_id || "").toLowerCase();
      const displayId = formatLampIdDisplay(
        record.person.member_id,
      ).toLowerCase();
      return (
        name.includes(term) ||
        memberId.includes(term) ||
        displayId.includes(term) ||
        (termWithoutLampPrefix.length > 0 &&
          (memberId.includes(termWithoutLampPrefix) ||
            displayId.includes(termWithoutLampPrefix)))
      );
    });
  }, [recentCheckIns, checkInSearchTerm, clusterFilter, modeFilter]);

  const suggestions = useMemo(
    () => filterEligibleMembersByQuery(checkInCandidates, entryValue),
    [checkInCandidates, entryValue],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  const checkInPerson = async (person: Person) => {
    if (!event || submitting) return;

    if (checkedInIds.has(String(person.id))) {
      setActionBanner({
        kind: "already",
        message: `${formatPersonName(person)} is already checked in.`,
        person,
      });
      showCheckInToast(
        "already",
        `${formatPersonName(person)} is already checked in.`,
      );
      triggerFlash("already");
      return;
    }

    if (
      stationMode === "ONLINE" &&
      !onlineVenueCode &&
      (event?.attendance_format ?? "hybrid") !== "online_only"
    ) {
      setActionBanner({
        kind: "error",
        message: "Select an online venue before checking in.",
      });
      showCheckInToast("error", "Select an online venue before checking in.");
      triggerFlash("error");
      return;
    }

    setSubmitting(true);
    setActionBanner(null);
    try {
      await eventsApi.addAttendance(eventId, {
        person_id: String(person.id),
        occurrence_date: occurrenceDate,
        status: "PRESENT",
        attendance_mode: stationMode,
        attendance_venue:
          stationMode === "ONLINE" &&
          (event?.attendance_format ?? "hybrid") !== "online_only"
            ? onlineVenueCode
            : null,
      });
      await fetchAttendance();
      setEntryValue("");
      setShowSuggestions(false);
      setActionBanner({
        kind: "success",
        message: `${formatPersonName(person)} checked in.`,
        person,
      });
      showCheckInToast("success", `${formatPersonName(person)} checked in.`);
      triggerFlash("success");
      if (entryTab === "manual") {
        inputRef.current?.focus();
      }
    } catch (error: unknown) {
      const statusCode = (
        error as { response?: { status?: number; data?: { detail?: string } } }
      )?.response?.status;
      const detail = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      if (statusCode === 409) {
        setActionBanner({
          kind: "already",
          message:
            detail ||
            `${formatPersonName(person)} is already checked in. Mode and venue cannot be changed.`,
          person,
        });
        showCheckInToast(
          "already",
          detail ||
            `${formatPersonName(person)} is already checked in. Mode and venue cannot be changed.`,
        );
        triggerFlash("already");
        await fetchAttendance();
      } else {
        const message = formatApiErrorMessage(
          error,
          "Unable to check in this person. Please try again.",
        );
        setActionBanner({
          kind: "error",
          message,
        });
        showCheckInToast("error", message);
        triggerFlash("error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!event || submitting) return;

    const resolved = resolvePersonFromEntry(entryValue, checkInCandidates);
    if (!resolved.ok) {
      setActionBanner({ kind: "error", message: resolved.error });
      showCheckInToast("error", resolved.error);
      triggerFlash("error");
      return;
    }

    await checkInPerson(resolved.person);
  };

  const handleQrScan = (text: string) => {
    const now = Date.now();
    if (submitting || now < scanCooldownUntilRef.current) return;

    scanCooldownUntilRef.current = now + SCAN_COOLDOWN_MS;

    const resolved = resolvePersonFromMemberId(text, checkInCandidates);
    if (!resolved.ok) {
      setActionBanner({ kind: "error", message: resolved.error });
      showCheckInToast("error", resolved.error);
      triggerFlash("error");
      return;
    }

    void checkInPerson(resolved.person);
  };

  const handleSelectSuggestion = (person: Person) => {
    if (checkedInIds.has(String(person.id))) {
      setActionBanner({
        kind: "already",
        message: `${formatPersonName(person)} is already checked in.`,
        person,
      });
      showCheckInToast(
        "already",
        `${formatPersonName(person)} is already checked in.`,
      );
      triggerFlash("already");
      return;
    }
    setEntryValue(formatPersonName(person));
    setShowSuggestions(false);
    void checkInPerson(person);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryTab === "manual") {
      void handleCheckIn();
    }
  };

  const openRemoveConfirmation = (record: EventAttendanceRecord) => {
    setRemoveConfirmation({ isOpen: true, record, loading: false });
  };

  const closeRemoveConfirmation = () => {
    setRemoveConfirmation({ isOpen: false, record: null, loading: false });
  };

  const confirmRemoveCheckIn = async () => {
    const record = removeConfirmation.record;
    if (!record) return;

    setRemoveConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await eventsApi.removeAttendance(eventId, record.id);
      await fetchAttendance();
      setActionBanner({
        kind: "success",
        message: `${formatPersonName(record.person)} removed from check-in.`,
      });
      showCheckInToast(
        "success",
        `${formatPersonName(record.person)} removed from check-in.`,
      );
      closeRemoveConfirmation();
    } catch {
      setActionBanner({
        kind: "error",
        message: "Unable to remove this check-in. Please try again.",
      });
      showCheckInToast(
        "error",
        "Unable to remove this check-in. Please try again.",
      );
      setRemoveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  if (eventLoading || peopleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-red-600">
          {eventError ?? "Event not found."}
        </p>
        <Link
          href="/events"
          className="mt-4 text-sm font-medium text-primary hover:text-lighthouse-navy hover:underline"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {flash && (
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-0 z-[100] transition-opacity duration-150 ${
            flash === "success"
              ? "bg-green-500/40"
              : flash === "already"
                ? "bg-yellow-400/40"
                : "bg-red-500/40"
          }`}
        />
      )}
      <header className="border-b border-primary/10 bg-gradient-to-r from-lighthouse-navy to-primary">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-lighthouse-gold">
              The Lighthouse
            </p>
            <p className="text-[11px] text-white/70">
              LAMP Church Management System
            </p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Events
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-5 rounded-lg border border-primary/20 bg-gradient-to-r from-lighthouse-ivory to-muted px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xs font-semibold uppercase tracking-wide text-primary">
                Check-In
              </h1>
              <p className="mt-0.5 text-base font-medium text-lighthouse-navy">
                {event.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatOccurrenceLabel(occurrenceDate)}
                {event.branch_name ? ` · ${event.branch_name}` : ""}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              {event.type !== "MEETING" ? (
                <Link
                  href={`/events/guest?event=${eventId}&occurrence=${encodeURIComponent(occurrenceDate)}`}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-blue-700"
                >
                  New guest
                </Link>
              ) : null}
              {canGenerateReport ? (
                <Button
                  variant="tertiary"
                  onClick={() => setReportOpen(true)}
                  disabled={attendanceLoading || peopleLoading}
                  className="w-full sm:w-auto"
                >
                  Generate Report
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={`mb-6 grid grid-cols-1 gap-4 ${
            showsExpectedStats ? "sm:grid-cols-3" : "sm:grid-cols-1"
          }`}
        >
          {showsExpectedStats ? (
            <StatCard
              label="Total"
              value={totalCount}
              description={
                ongoingVisitorExpectedCount > 0
                  ? `Expected attendees · Includes ${ongoingVisitorExpectedCount} ongoing visitor${
                      ongoingVisitorExpectedCount === 1 ? "" : "s"
                    }`
                  : "Expected attendees for this event"
              }
              iconClassName="bg-primary/10 text-primary"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
              }
            />
          ) : null}
          <StatCard
            label="Checked In"
            value={checkedInCount}
            description="Already marked present for this date"
            iconClassName="bg-green-100 text-lighthouse-olive"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            }
          />
          {showsExpectedStats ? (
            <StatCard
              label="Remaining"
              value={remainingCount}
              description="Expected attendees not yet checked in"
              iconClassName="bg-amber-100 text-lighthouse-gold"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              }
            />
          ) : null}
        </div>

        {(event.attendance_format ?? "hybrid") === "hybrid" ? (
          <div className="mb-5 flex rounded-lg border border-primary/10 bg-muted p-1">
            <button
              type="button"
              onClick={() => handleStationModeChange("ONSITE")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                stationMode === "ONSITE"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Onsite
            </button>
            <button
              type="button"
              onClick={() => handleStationModeChange("ONLINE")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                stationMode === "ONLINE"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Online
            </button>
          </div>
        ) : (
          <div className="mb-5 rounded-lg border border-primary/10 bg-muted px-3 py-2 text-sm text-muted-foreground">
            {(event.attendance_format ?? "hybrid") === "online_only"
              ? "This event is online only — check-ins are recorded as Online (no venue)."
              : "This event is onsite only — check-ins are recorded as Onsite."}
          </div>
        )}

        {stationMode === "ONLINE" &&
        (event.attendance_format ?? "hybrid") === "hybrid" ? (
          <div className="mb-5 rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Online venue
            </label>
            <ScalableSelect
              options={venueSelectOptions}
              value={onlineVenueCode}
              onChange={setOnlineVenueCode}
              placeholder="Select venue..."
              searchPlaceholder="Search venues..."
              emptyMessage="No active online venues"
              showSearch
              className="w-full"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Required for online check-in (Home altar, Cluster house, etc.).
            </p>
          </div>
        ) : null}

        <div className="mb-5 flex rounded-lg border border-primary/10 bg-muted p-1">
          <button
            type="button"
            onClick={() => {
              setEntryTab("manual");
              setActionBanner(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
              entryTab === "manual"
                ? "bg-white text-primary shadow-sm ring-1 ring-primary/10"
                : "text-muted-foreground hover:text-lighthouse-navy"
            }`}
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
            Manual Entry
          </button>
          {stationMode === "ONSITE" ? (
            <button
              type="button"
              onClick={() => {
                setEntryTab("camera");
                setActionBanner(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                entryTab === "camera"
                  ? "bg-white text-primary shadow-sm ring-1 ring-primary/10"
                  : "text-muted-foreground hover:text-lighthouse-navy"
              }`}
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Camera Scan
            </button>
          ) : null}
        </div>

        <div className="mb-5 rounded-xl border border-primary/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-lighthouse-navy">
            {entryTab === "camera" ? "Scan Attendee" : "Enter Attendee"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {entryTab === "camera"
              ? "Point the camera at a member QR code. It should contain the LAMP ID, for example LAMP12345."
              : "Enter a name or LAMP ID."}
          </p>

          {actionBanner && (
            <CheckInStatusBanner
              kind={actionBanner.kind}
              message={actionBanner.message}
              person={actionBanner.person}
              onClose={() => setActionBanner(null)}
            />
          )}

          {entryTab === "camera" ? (
            <CheckInQrScanner onScan={handleQrScan} paused={submitting} />
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="relative" ref={suggestionsRef}>
                <label
                  htmlFor="check-in-entry"
                  className="mb-1 block text-sm font-medium text-lighthouse-navy"
                >
                  Attendee
                </label>
                <input
                  ref={inputRef}
                  id="check-in-entry"
                  type="text"
                  value={entryValue}
                  onChange={(e) => {
                    setEntryValue(e.target.value);
                    setShowSuggestions(true);
                    setActionBanner(null);
                  }}
                  onFocus={() => {
                    if (entryValue.trim()) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="Name or LAMP ID..."
                  autoComplete="off"
                  className="input-field text-base"
                />

                {showSuggestions && entryValue.trim() && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-primary/20 bg-white shadow-lg">
                    {suggestions.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        No matching members found.
                      </p>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto">
                        {suggestions.map((person) => {
                          const alreadyCheckedIn = checkedInIds.has(
                            String(person.id),
                          );
                          return (
                            <li key={person.id}>
                              <button
                                type="button"
                                disabled={alreadyCheckedIn || submitting}
                                onClick={() => handleSelectSuggestion(person)}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition-colors ${
                                  alreadyCheckedIn
                                    ? "cursor-not-allowed bg-muted/50 text-muted-foreground"
                                    : "hover:bg-primary/5"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-lighthouse-navy">
                                    {formatPersonName(person)}
                                  </p>
                                  {person.member_id && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      LAMP ID:{" "}
                                      {formatLampIdDisplay(person.member_id)}
                                    </p>
                                  )}
                                </div>
                                {alreadyCheckedIn ? (
                                  <span className="shrink-0 text-xs font-medium text-lighthouse-olive">
                                    Checked in
                                  </span>
                                ) : person.cluster_codes?.[0] ? (
                                  <span className="chip-primary-sm shrink-0">
                                    {person.cluster_codes[0]}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={submitting || !entryValue.trim()}
                className="w-full gap-2 bg-primary hover:bg-lighthouse-navy"
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
                Check In
              </Button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-primary/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-lighthouse-navy">
            Recent Check-Ins
          </h2>
          {recentCheckIns.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="check-in-search"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Search checked-in attendees
                  </label>
                  <div className="relative">
                    <input
                      id="check-in-search"
                      type="text"
                      value={checkInSearchTerm}
                      onChange={(event) =>
                        setCheckInSearchTerm(event.target.value)
                      }
                      placeholder="Search by name or LAMP ID..."
                      className="input-field h-11 min-h-[44px] pr-10 text-sm md:min-h-[44px] md:py-0"
                    />
                    <svg
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                <div className="sm:w-40 sm:shrink-0">
                  <label
                    htmlFor="check-in-mode-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Mode
                  </label>
                  <select
                    id="check-in-mode-filter"
                    value={modeFilter}
                    onChange={(event) =>
                      setModeFilter(event.target.value as "" | AttendanceMode)
                    }
                    className="input-field h-11 min-h-[44px] w-full text-sm md:min-h-[44px] md:py-0"
                  >
                    <option value="">All modes</option>
                    <option value="ONSITE">Onsite</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
                <div className="sm:w-52 sm:shrink-0">
                  <label
                    htmlFor="check-in-cluster-filter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Cluster
                  </label>
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Filters only apply to people already checked in.
              </p>
            </div>
          )}
          <div className="mt-4">
            {attendanceLoading ? (
              <LoadingSpinner />
            ) : recentCheckIns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No check-ins yet
              </p>
            ) : filteredRecentCheckIns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No matching check-ins
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto pr-1">
                <ul className="divide-y divide-primary/10">
                  {filteredRecentCheckIns.map((record) => (
                    <li
                      key={record.id}
                      className="group flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-lighthouse-navy">
                          {formatPersonName(record.person)}
                        </p>
                        {record.person.member_id && (
                          <span className="chip-sky-sm shrink-0">
                            {formatLampIdDisplay(record.person.member_id)}
                          </span>
                        )}
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            (record.attendance_mode || "ONSITE") === "ONLINE"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {(record.attendance_mode || "ONSITE") === "ONLINE"
                            ? "Online"
                            : "Onsite"}
                        </span>
                        {record.attendance_venue_label ? (
                          <span
                            className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              borderColor:
                                record.attendance_venue_color || "#0ea5e9",
                              color: record.attendance_venue_color || "#0369a1",
                            }}
                          >
                            {record.attendance_venue_label}
                          </span>
                        ) : null}
                        {record.person.status && (
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonStatusColor(record.person.status)}`}
                          >
                            {formatPersonStatusLabel(record.person.status)}
                          </span>
                        )}
                        {record.person.role && (
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonRoleColor(record.person.role)}`}
                          >
                            {record.person.role}
                          </span>
                        )}
                        {record.person.cluster_codes?.[0] ? (
                          <span className="chip-primary-sm shrink-0">
                            {record.person.cluster_codes[0]}
                          </span>
                        ) : resolveAttendanceClusterLabel(
                            record.person.cluster_codes,
                            record.person.role
                          ) === "NO CLUSTER" ? (
                          <span className="chip-red-sm shrink-0">
                            NO CLUSTER
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs text-muted-foreground transition-transform duration-200 group-hover:-translate-x-1">
                          {new Date(record.recorded_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <EditAttendanceModeControl
                          eventId={eventId}
                          record={record}
                          venues={venues}
                          attendanceFormat={event.attendance_format ?? "hybrid"}
                          disabled={submitting || removeConfirmation.loading}
                          iconOnly
                          buttonClassName="flex h-8 w-8 translate-x-2 items-center justify-center rounded-full text-blue-600 opacity-100 transition-all duration-200 hover:bg-blue-50 disabled:opacity-50 md:translate-x-3 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
                          onSaved={async () => {
                            await fetchAttendance();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => openRemoveConfirmation(record)}
                          disabled={submitting || removeConfirmation.loading}
                          aria-label={`Remove ${formatPersonName(record.person)} from check-in`}
                          className="flex h-8 w-8 translate-x-2 items-center justify-center rounded-full text-red-600 opacity-100 transition-all duration-200 hover:bg-red-50 md:translate-x-3 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs font-medium text-lighthouse-gold">
          A soul kept is a soul won.
        </p>
      </div>

      <ConfirmationModal
        isOpen={removeConfirmation.isOpen}
        onClose={closeRemoveConfirmation}
        onConfirm={confirmRemoveCheckIn}
        title="Remove Check-In"
        message={
          removeConfirmation.record ? (
            <>
              Remove{" "}
              <strong>
                {formatPersonName(removeConfirmation.record.person)}
              </strong>{" "}
              from {formatOccurrenceLabel(occurrenceDate)}? Their attendance
              record will be deleted.
            </>
          ) : (
            "Remove this check-in? Their attendance record will be deleted."
          )
        }
        confirmText="Remove Check-In"
        cancelText="Cancel"
        variant="danger"
        loading={removeConfirmation.loading}
      />

      <EventAttendanceReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        event={event}
        occurrenceDate={occurrenceDate}
        people={people}
        attendanceRecords={attendanceRecords}
      />
    </div>
  );
}

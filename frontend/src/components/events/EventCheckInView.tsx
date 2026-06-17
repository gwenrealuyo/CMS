"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { usePeople } from "@/src/hooks/usePeople";
import { eventsApi } from "@/src/lib/api";
import { XMarkIcon } from "@heroicons/react/24/solid";
import {
  filterEligibleMembersByQuery,
  getCheckedInPersonIds,
  getEligibleMembers,
  resolvePersonFromEntry,
} from "@/src/lib/events/checkInUtils";
import { formatPersonName } from "@/src/lib/name";
import { getPersonRoleColor } from "@/src/lib/personRole";
import { Event, EventAttendanceRecord } from "@/src/types/event";
import { Person } from "@/src/types/person";

type EntryTab = "manual" | "camera";

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

function StatCard({
  label,
  value,
  icon,
  iconClassName,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-primary/15 bg-white p-5 shadow-sm">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconClassName}`}
      >
        {icon}
      </div>
      <div className="text-3xl font-semibold text-lighthouse-navy">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
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
  const [entryValue, setEntryValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<{
    isOpen: boolean;
    record: EventAttendanceRecord | null;
    loading: boolean;
  }>({ isOpen: false, record: null, loading: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const fetchEvent = useCallback(async () => {
    setEventLoading(true);
    try {
      const response = await eventsApi.getById(eventId);
      setEvent(response.data);
      setEventError(null);
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
      setActionError(null);
    } catch {
      setActionError("Unable to load attendance for this occurrence.");
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

  const eligibleMembers = useMemo(() => {
    if (!event) return [];
    return getEligibleMembers(people, event);
  }, [people, event]);

  const checkedInIds = useMemo(
    () => getCheckedInPersonIds(attendanceRecords),
    [attendanceRecords]
  );

  const totalCount = eligibleMembers.length;
  const checkedInCount = checkedInIds.size;
  const remainingCount = Math.max(0, totalCount - checkedInCount);

  const recentCheckIns = useMemo(
    () =>
      [...attendanceRecords].sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      ),
    [attendanceRecords]
  );

  const suggestions = useMemo(
    () => filterEligibleMembersByQuery(eligibleMembers, entryValue),
    [eligibleMembers, entryValue]
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
      setActionError(`${formatPersonName(person)} is already checked in.`);
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      await eventsApi.addAttendance(eventId, {
        person_id: String(person.id),
        occurrence_date: occurrenceDate,
        status: "PRESENT",
      });
      await fetchAttendance();
      setEntryValue("");
      setShowSuggestions(false);
      toast.success(`${formatPersonName(person)} checked in`);
      inputRef.current?.focus();
    } catch {
      setActionError("Unable to check in this person. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!event || submitting) return;

    const resolved = resolvePersonFromEntry(entryValue, eligibleMembers);
    if (!resolved.ok) {
      setActionError(resolved.error);
      return;
    }

    await checkInPerson(resolved.person);
  };

  const handleSelectSuggestion = (person: Person) => {
    if (checkedInIds.has(String(person.id))) {
      setActionError(`${formatPersonName(person)} is already checked in.`);
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
      setActionError(null);
      toast.success(
        `${formatPersonName(record.person)} removed from check-in`
      );
      closeRemoveConfirmation();
    } catch {
      setActionError("Unable to remove this check-in. Please try again.");
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
        <p className="text-sm text-red-600">{eventError ?? "Event not found."}</p>
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
      <header className="border-b border-primary/10 bg-gradient-to-r from-lighthouse-navy to-primary">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-lighthouse-gold">
              The Lighthouse
            </p>
            <p className="text-[11px] text-white/70">LAMP Church Care System</p>
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
        <div className="mb-8 rounded-xl border border-primary/20 bg-gradient-to-r from-lighthouse-ivory to-muted p-6">
          <h1 className="text-2xl font-bold text-primary md:text-3xl">
            Check-In
          </h1>
          <p className="mt-1 text-lg font-medium text-lighthouse-navy">
            {event.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatOccurrenceLabel(occurrenceDate)}
            {event.branch_name ? ` · ${event.branch_name}` : ""}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total"
            value={totalCount}
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
          <StatCard
            label="Checked In"
            value={checkedInCount}
            iconClassName="bg-lighthouse-olive/15 text-lighthouse-olive"
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
          <StatCard
            label="Remaining"
            value={remainingCount}
            iconClassName="bg-lighthouse-gold/15 text-lighthouse-gold"
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
        </div>

        <div className="mb-5 flex rounded-lg border border-primary/10 bg-muted p-1">
          <button
            type="button"
            onClick={() => setEntryTab("manual")}
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
          <button
            type="button"
            disabled
            title="QR scanning coming soon"
            className="relative flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium text-muted-foreground/60"
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
            <span className="absolute -top-2 right-2 rounded-full bg-lighthouse-gold/20 px-2 py-0.5 text-[10px] font-semibold text-lighthouse-navy">
              Soon
            </span>
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-primary/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-lighthouse-navy">
            Enter Attendee
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a name or LAMP ID. QR and barcode scanning are planned for a
            future update.
          </p>

          {actionError && (
            <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {actionError}
            </div>
          )}

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
                  setActionError(null);
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
                          String(person.id)
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
                                    LAMP ID: {person.member_id}
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
        </div>

        <div className="rounded-xl border border-primary/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-lighthouse-navy">
            Recent Check-Ins
          </h2>
          <div className="mt-4">
            {attendanceLoading ? (
              <LoadingSpinner />
            ) : recentCheckIns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No check-ins yet
              </p>
            ) : (
              <ul className="divide-y divide-primary/10">
                {recentCheckIns.map((record) => (
                  <li
                    key={record.id}
                    className="group flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-lighthouse-navy">
                        {formatPersonName(record.person)}
                      </p>
                      {record.person.role && (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonRoleColor(record.person.role)}`}
                        >
                          {record.person.role}
                        </span>
                      )}
                      {record.person.member_id && (
                        <span className="chip-sky-sm shrink-0">
                          {record.person.member_id}
                        </span>
                      )}
                      {record.person.cluster_codes?.[0] && (
                        <span className="chip-primary-sm shrink-0">
                          {record.person.cluster_codes[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-muted-foreground transition-transform duration-200 group-hover:-translate-x-1">
                        {new Date(record.recorded_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
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
    </div>
  );
}

"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

import AppLogo from "@/src/components/brand/AppLogo";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { eventsApi } from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import {
  DEFAULT_COUNTRY,
  UNIQUE_DIAL_CODES,
  findCountryForDialCode,
  getCountryDialCode,
  getCountryLocalMax,
} from "@/src/lib/countries";
import { formatLampIdDisplay } from "@/src/lib/events/checkInUtils";
import { formatPersonName } from "@/src/lib/name";
import { getPersonRoleColor } from "@/src/lib/personRole";
import { AttendanceVenueOption } from "@/src/types/event";
import {
  SelfCheckInAgeGroup,
  SelfCheckInEventOption,
  SelfCheckInPerson,
  SelfCheckInSessionDetails,
  SelfCheckInSessionResponse,
  SelfCheckInVisitorMatch,
} from "@/src/types/selfCheckIn";

type Step =
  | "landing"
  | "member"
  | "visitor-search"
  | "visitor-encode"
  | "success"
  | "undo";

function formatServiceWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type VisitorMatchKey = {
  kind: "visitor" | "prospect";
  id: number;
};

function visitorMatchKind(
  person: SelfCheckInVisitorMatch,
): "visitor" | "prospect" {
  return person.kind === "prospect" ? "prospect" : "visitor";
}

function visitorMatchKey(person: SelfCheckInVisitorMatch): VisitorMatchKey {
  const kind = visitorMatchKind(person);
  return {
    kind,
    id: kind === "prospect" ? (person.prospect_id ?? person.id) : person.id,
  };
}

function sameVisitorMatch(
  left: VisitorMatchKey | null,
  right: VisitorMatchKey,
) {
  return Boolean(left && left.kind === right.kind && left.id === right.id);
}

function eventIdFromOption(option: SelfCheckInEventOption) {
  return option.id ?? option.event_id;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 text-sm font-medium text-lighthouse-navy shadow-sm hover:border-primary/40 hover:bg-primary/5"
    >
      <ArrowLeftIcon className="h-4 w-4 shrink-0 text-primary" />
      Back
    </button>
  );
}

function formatVenue(event: SelfCheckInEventOption) {
  const room = (event.room_name || "").trim();
  const location = (event.location || "").trim();
  if (room && location && room.toLowerCase() === location.toLowerCase()) {
    return room;
  }
  return [room, location].filter(Boolean).join(" · ");
}

function ServiceCard({ event }: { event: SelfCheckInEventOption }) {
  const venue = formatVenue(event);
  return (
    <div className="rounded-2xl bg-primary/5 px-4 py-3.5 text-left">
      <p className="text-base font-semibold text-lighthouse-navy">
        {event.title}
      </p>
      {event.branch_name && (
        <p className="mt-0.5 text-sm font-medium text-primary">
          {event.branch_name}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDaysIcon className="h-4 w-4 shrink-0" />
        {formatServiceWhen(event.start)}
      </p>
      {venue && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon className="h-4 w-4 shrink-0" />
          {venue}
        </p>
      )}
    </div>
  );
}

function OnlineVenuePicker({
  venues,
  value,
  onChange,
  disabled,
}: {
  venues: AttendanceVenueOption[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const options = venues.map((venue) => ({
    value: venue.code,
    label: venue.label,
  }));
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-lighthouse-navy">
        Online venue *
      </label>
      <ScalableSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Select where you are joining from…"
        emptyMessage="No active online venues"
        showSearch={false}
        disabled={disabled}
        className="w-full"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Required (Home altar, Cluster house, etc.). Use this page only if
        attending online.
      </p>
    </div>
  );
}

function axiosStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function axiosDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

function PersonRow({
  person,
  selected,
  onToggle,
}: {
  person: SelfCheckInPerson | SelfCheckInVisitorMatch;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const already = person.already_checked_in;
  const clickable = Boolean(onToggle) && !already;
  return (
    <button
      type="button"
      onClick={clickable ? onToggle : undefined}
      disabled={already || !onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        already
          ? "border-emerald-200 bg-emerald-50"
          : selected
            ? "border-primary bg-primary/5"
            : "border-gray-200 bg-white hover:border-primary/40"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          already ? "bg-emerald-600 text-white" : "bg-primary/10 text-primary"
        }`}
      >
        {already ? (
          <CheckIcon className="h-5 w-5" />
        ) : (
          (person.first_name || person.full_name || "?").charAt(0).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-lighthouse-navy">
          {person.full_name || formatPersonName(person)}
          {"is_self" in person && person.is_self ? " (You)" : ""}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              visitorMatchKind(person as SelfCheckInVisitorMatch) === "prospect"
                ? "bg-amber-100 text-amber-900"
                : getPersonRoleColor(person.role)
            }`}
          >
            {visitorMatchKind(person as SelfCheckInVisitorMatch) === "prospect"
              ? "Invited"
              : person.role === "VISITOR"
                ? "Visitor"
                : "Member"}
          </span>
          {"invited_by_name" in person && person.invited_by_name ? (
            <span>Invited by {person.invited_by_name}</span>
          ) : null}
          {person.member_id ? (
            <span>#{formatLampIdDisplay(person.member_id)}</span>
          ) : null}
          {already ? (
            <span className="text-emerald-700">Checked in</span>
          ) : null}
        </span>
      </span>
      {clickable && (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            selected
              ? "border-primary bg-primary text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        </span>
      )}
    </button>
  );
}

export default function EventSelfCheckInView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event") ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SelfCheckInSessionResponse | null>(
    null,
  );
  const [step, setStep] = useState<Step>("landing");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [successNames, setSuccessNames] = useState<string[]>([]);
  const [lastCheckInIds, setLastCheckInIds] = useState<number[]>([]);
  const [visitorQuery, setVisitorQuery] = useState("");
  const [visitorResults, setVisitorResults] = useState<
    SelfCheckInVisitorMatch[]
  >([]);
  const [visitorSearching, setVisitorSearching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<VisitorMatchKey | null>(
    null,
  );
  const [encode, setEncode] = useState({
    first_name: "",
    last_name: "",
    email: "",
    gender: "" as "" | "MALE" | "FEMALE",
    age_group: "" as "" | SelfCheckInAgeGroup,
  });
  const [phoneDialCountry, setPhoneDialCountry] = useState(DEFAULT_COUNTRY);
  const [phoneLocal, setPhoneLocal] = useState("");
  const phoneCountryCode = getCountryDialCode(phoneDialCountry);
  const [duplicateMatches, setDuplicateMatches] = useState<
    SelfCheckInVisitorMatch[]
  >([]);
  const [attendanceVenue, setAttendanceVenue] = useState("");
  const [firstTimeAttending, setFirstTimeAttending] = useState(true);

  const session: SelfCheckInSessionDetails | null = payload?.session ?? null;
  const selectedEventId =
    eventParam || (session ? String(eventIdFromOption(session.event)) : "");

  const activeVenues = useMemo(() => {
    const venues = payload?.attendance_venues ?? [];
    return venues
      .filter((venue) => venue.is_active !== false)
      .slice()
      .sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
      );
  }, [payload?.attendance_venues]);

  const applySession = useCallback((data: SelfCheckInSessionResponse) => {
    setPayload(data);
    if (data.session) {
      const household = data.session.household;
      setSelectedIds(
        household
          .filter((person) => person.is_self && !person.already_checked_in)
          .map((person) => person.id),
      );
    }
  }, []);

  const loadSession = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await eventsApi.selfCheckInSession(
          eventParam ? { event: eventParam } : undefined,
        );
        applySession(response.data);
      } catch (err) {
        if (!opts?.silent) {
          setError(formatApiErrorMessage(err, "Unable to load self check-in."));
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [applySession, eventParam],
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const query = visitorQuery.trim();
    if (step !== "visitor-search" || query.length < 2 || !selectedEventId) {
      setVisitorResults([]);
      setSelectedMatch(null);
      return;
    }
    let cancelled = false;
    setVisitorSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await eventsApi.searchSelfCheckInVisitors(query, {
          event: selectedEventId,
        });
        if (!cancelled) {
          const results = response.data.results;
          setVisitorResults(results);
          setSelectedMatch((current) =>
            current &&
            results.some(
              (person) =>
                sameVisitorMatch(current, visitorMatchKey(person)) &&
                !person.already_checked_in,
            )
              ? current
              : null,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setVisitorResults([]);
          setSelectedMatch(null);
          toast.error(formatApiErrorMessage(err, "Search failed."));
        }
      } finally {
        if (!cancelled) setVisitorSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, visitorQuery, selectedEventId]);

  const selectedHousehold = useMemo(() => {
    if (!session) return [];
    return session.household.filter((person) =>
      selectedIds.includes(person.id),
    );
  }, [session, selectedIds]);

  const chooseEvent = (option: SelfCheckInEventOption) => {
    router.replace(`/events/self-check-in?event=${eventIdFromOption(option)}`);
  };

  const goLanding = () => {
    setStep("landing");
    setVisitorQuery("");
    setVisitorResults([]);
    setSelectedMatch(null);
    setDuplicateMatches([]);
    setAttendanceVenue("");
    setError(null);
    setEncode({
      first_name: "",
      last_name: "",
      email: "",
      gender: "",
      age_group: "",
    });
    setPhoneDialCountry(DEFAULT_COUNTRY);
    setPhoneLocal("");
    setFirstTimeAttending(true);
  };

  const requireVenue = () => {
    if (attendanceVenue.trim()) return true;
    setError("Select an online venue before checking in.");
    return false;
  };

  const togglePerson = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleVisitor = (person: SelfCheckInVisitorMatch) => {
    const key = visitorMatchKey(person);
    setSelectedMatch((current) =>
      sameVisitorMatch(current, key) ? null : key,
    );
  };

  const handleHouseholdCheckIn = async () => {
    if (!session || selectedHousehold.length === 0) return;
    if (!requireVenue()) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await eventsApi.selfCheckIn({
        person_ids: selectedHousehold.map((person) => person.id),
        event_id: eventIdFromOption(session.event),
        attendance_venue: attendanceVenue,
      });
      applySession(response.data);
      setLastCheckInIds(selectedHousehold.map((person) => person.id));
      setSuccessNames(selectedHousehold.map((person) => person.full_name));
      setAttendanceVenue("");
      setStep("success");
    } catch (err) {
      if (axiosStatus(err) === 409) {
        setError(
          axiosDetail(err) ||
            "Already checked in. Mode and venue cannot be changed.",
        );
        await loadSession({ silent: true });
      } else {
        setError(formatApiErrorMessage(err, "Unable to check in."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const checkInVisitorPerson = async (person: SelfCheckInVisitorMatch) => {
    if (person.already_checked_in) {
      toast.success(`${person.full_name} is already checked in.`);
      return;
    }
    if (!requireVenue()) return;
    setSubmitting(true);
    setError(null);
    try {
      const isProspect = visitorMatchKind(person) === "prospect";
      const response = await eventsApi.selfCheckInVisitor({
        ...(isProspect
          ? { prospect_id: person.prospect_id ?? person.id }
          : { person_id: person.id }),
        event_id: selectedEventId ? Number(selectedEventId) : undefined,
        attendance_venue: attendanceVenue,
      });
      const checkedPerson = response.data.person;
      setSuccessNames([checkedPerson?.full_name || person.full_name]);
      setLastCheckInIds(
        checkedPerson?.id ? [checkedPerson.id] : isProspect ? [] : [person.id],
      );
      setSelectedMatch(null);
      setAttendanceVenue("");
      setStep("success");
      await loadSession({ silent: true });
    } catch (err) {
      if (axiosStatus(err) === 409) {
        const detail =
          axiosDetail(err) ||
          `${person.full_name} is already checked in. Mode and venue cannot be changed.`;
        setError(detail);
        toast.success(`${person.full_name} is already checked in.`);
        await loadSession({ silent: true });
      } else {
        setError(formatApiErrorMessage(err, "Unable to check in this guest."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVisitor =
    visitorResults.find((person) =>
      sameVisitorMatch(selectedMatch, visitorMatchKey(person)),
    ) ||
    duplicateMatches.find((person) =>
      sameVisitorMatch(selectedMatch, visitorMatchKey(person)),
    ) ||
    null;

  const handleConfirmVisitorCheckIn = async () => {
    if (!selectedVisitor) return;
    await checkInVisitorPerson(selectedVisitor);
  };

  const handleUndoCheckIn = async () => {
    if (lastCheckInIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await eventsApi.undoSelfCheckIn({
        person_ids: lastCheckInIds,
        event_id: selectedEventId ? Number(selectedEventId) : undefined,
      });
      applySession(response.data);
      setLastCheckInIds([]);
      setSuccessNames([]);
      toast.success("Check-in removed.");
      goLanding();
    } catch (err) {
      setError(formatApiErrorMessage(err, "Unable to undo this check-in."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEncode = async (event: FormEvent) => {
    event.preventDefault();
    if (!encode.first_name.trim() || !encode.last_name.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!encode.gender || !encode.age_group) {
      setError("Gender and age group are required.");
      return;
    }
    if (!requireVenue()) return;
    setSubmitting(true);
    setError(null);
    setDuplicateMatches([]);
    try {
      const response = await eventsApi.selfCheckInVisitor({
        first_name: encode.first_name.trim(),
        last_name: encode.last_name.trim(),
        gender: encode.gender,
        age_group: encode.age_group,
        phone: phoneLocal ? `${phoneCountryCode}${phoneLocal}` : undefined,
        email: encode.email.trim() || undefined,
        event_id: selectedEventId ? Number(selectedEventId) : undefined,
        attendance_venue: attendanceVenue,
        first_time_attending: firstTimeAttending,
      });
      setSuccessNames([response.data.person.full_name]);
      setLastCheckInIds([response.data.person.id]);
      setAttendanceVenue("");
      setStep("success");
      await loadSession({ silent: true });
    } catch (err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            matches?: SelfCheckInVisitorMatch[];
            detail?: string;
            already_checked_in?: boolean;
            person?: SelfCheckInVisitorMatch;
          };
        };
      };
      if (
        axiosErr.response?.status === 409 &&
        axiosErr.response.data?.matches
      ) {
        setDuplicateMatches(axiosErr.response.data.matches);
        setSelectedMatch(null);
        setError(
          axiosErr.response.data.detail ||
            "A person with this name already exists. Select them, then check in.",
        );
      } else if (
        axiosErr.response?.status === 409 &&
        axiosErr.response.data?.already_checked_in
      ) {
        const name =
          axiosErr.response.data.person?.full_name || formatPersonName(encode);
        setError(
          axiosErr.response.data.detail ||
            `${name} is already checked in. Mode and venue cannot be changed.`,
        );
        toast.success(`${name} is already checked in.`);
        await loadSession({ silent: true });
      } else {
        setError(formatApiErrorMessage(err, "Unable to add this guest."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-5 shadow-md sm:p-7">
          <div className="mb-5 flex flex-col items-center text-center">
            <AppLogo imageClassName="h-12 w-auto object-contain" />
            <h1 className="mt-3 text-xl font-semibold text-lighthouse-navy">
              Online Check-In
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Only if you are attending Sunday Service online
            </p>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !payload) {
    return shell(<p className="text-center text-sm text-red-600">{error}</p>);
  }

  if (!payload?.available) {
    return shell(
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {payload?.reason === "restricted"
            ? "Online check-in is not open to members yet."
            : "Online check-in is only available on Sunday Service days."}
        </p>
        <Link href="/dashboard" className="mt-5 inline-block w-full">
          <Button className="w-full">Back to dashboard</Button>
        </Link>
      </div>,
    );
  }

  if (payload.needs_selection) {
    return shell(
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Choose the service you are attending online.
        </p>
        {payload.options.map((option) => (
          <button
            key={eventIdFromOption(option)}
            type="button"
            onClick={() => chooseEvent(option)}
            className="w-full rounded-2xl border border-gray-200 p-1 text-left transition hover:border-primary/40"
          >
            <ServiceCard event={option} />
          </button>
        ))}
      </div>,
    );
  }

  if (!session) {
    return shell(
      <p className="text-center text-sm text-muted-foreground">
        Unable to load this service.
      </p>,
    );
  }

  const eventCard = <ServiceCard event={session.event} />;
  const actionError = error ? (
    <p className="text-sm text-red-600">{error}</p>
  ) : null;

  if (step === "success") {
    return shell(
      <div className="space-y-5 text-center">
        {eventCard}
        <div className="flex flex-col items-center gap-2 pt-2">
          <CheckCircleIcon className="h-14 w-14 text-emerald-600" />
          <p className="text-lg font-semibold text-lighthouse-navy">
            You&apos;re checked in online
          </p>
          <p className="text-sm text-muted-foreground">
            {successNames.join(", ")}
          </p>
        </div>
        <div className="grid gap-2">
          <Button className="w-full" onClick={goLanding}>
            Check in someone else
          </Button>
          <Button
            variant="tertiary"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            Done
          </Button>
          {lastCheckInIds.length > 0 && (
            <button
              type="button"
              className="w-full py-2 text-center text-sm font-medium text-red-600 hover:text-red-700"
              onClick={() => {
                setError(null);
                setStep("undo");
              }}
            >
              I made a mistake
            </button>
          )}
        </div>
      </div>,
    );
  }

  if (step === "undo") {
    return shell(
      <div className="space-y-5 text-center">
        {eventCard}
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-lg font-semibold text-lighthouse-navy">
            Undo this check-in?
          </p>
          <p className="text-md font-medium text-primary">
            {successNames.join(", ") || "The people you just checked in"}
          </p>
          <p className="text-sm text-muted-foreground">
            This removes their online check-in from today&apos;s service.
          </p>
        </div>
        {actionError}
        <div className="grid gap-2">
          <Button
            className="w-full"
            disabled={submitting || lastCheckInIds.length === 0}
            onClick={() => void handleUndoCheckIn()}
          >
            {submitting ? "Removing…" : "Undo check-in"}
          </Button>
          <Button
            variant="tertiary"
            className="w-full"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setStep("success");
            }}
          >
            Keep check-in
          </Button>
        </div>
      </div>,
    );
  }

  if (step === "member") {
    return shell(
      <div className="space-y-4">
        {eventCard}
        <div className="flex items-center gap-3">
          <BackButton onClick={goLanding} />
          <h2 className="text-base font-semibold text-lighthouse-navy">
            Your household
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Check in only if they are attending this service online.
        </p>
        <div className="space-y-2">
          {session.household.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              selected={selectedIds.includes(person.id)}
              onToggle={
                person.already_checked_in
                  ? undefined
                  : () => togglePerson(person.id)
              }
            />
          ))}
        </div>
        <OnlineVenuePicker
          venues={activeVenues}
          value={attendanceVenue}
          disabled={submitting}
          onChange={(code) => {
            setAttendanceVenue(code);
            setError(null);
          }}
        />
        {actionError}
        <Button
          className="w-full min-h-12"
          disabled={
            submitting || selectedHousehold.length === 0 || !attendanceVenue
          }
          onClick={() => void handleHouseholdCheckIn()}
        >
          {submitting
            ? "Checking in…"
            : `Check in online${selectedHousehold.length ? ` (${selectedHousehold.length})` : ""}`}
        </Button>
      </div>,
    );
  }

  if (step === "visitor-search") {
    const showEncode =
      visitorQuery.trim().length >= 2 &&
      !visitorSearching &&
      visitorResults.length === 0;
    return shell(
      <div className="space-y-4">
        {eventCard}
        <div className="flex items-center gap-3">
          <BackButton onClick={goLanding} />
          <h2 className="text-base font-semibold text-lighthouse-navy">
            Find guest
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Someone attending online with you. Search first. Add visitor if not
          found.
        </p>
        <label className="block text-sm font-medium text-lighthouse-navy">
          Search by name
          <span className="relative mt-1 block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-full border border-gray-200 py-3 pl-10 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Type their name…"
              value={visitorQuery}
              onChange={(event) => {
                const next = event.target.value;
                setVisitorQuery(next);
                if (next.trim().length >= 2) {
                  setVisitorSearching(true);
                } else {
                  setVisitorSearching(false);
                  setVisitorResults([]);
                }
              }}
              autoComplete="off"
            />
          </span>
        </label>
        {visitorSearching && (
          <p className="text-sm text-muted-foreground">Searching…</p>
        )}
        <div className="space-y-2">
          {visitorResults.map((person) => (
            <PersonRow
              key={`${visitorMatchKind(person)}-${visitorMatchKey(person).id}`}
              person={person}
              selected={sameVisitorMatch(
                selectedMatch,
                visitorMatchKey(person),
              )}
              onToggle={
                person.already_checked_in
                  ? undefined
                  : () => toggleVisitor(person)
              }
            />
          ))}
        </div>
        {visitorResults.some((person) => !person.already_checked_in) && (
          <>
            <OnlineVenuePicker
              venues={activeVenues}
              value={attendanceVenue}
              disabled={submitting}
              onChange={(code) => {
                setAttendanceVenue(code);
                setError(null);
              }}
            />
            <Button
              className="w-full min-h-12"
              disabled={submitting || !selectedVisitor || !attendanceVenue}
              onClick={() => void handleConfirmVisitorCheckIn()}
            >
              {submitting
                ? "Checking in…"
                : selectedVisitor
                  ? `Check in ${selectedVisitor.full_name}`
                  : "Select a guest to check in"}
            </Button>
          </>
        )}
        {showEncode && (
          <Button
            className="w-full min-h-12"
            onClick={() => {
              const parts = visitorQuery.trim().split(/\s+/);
              setEncode((current) => ({
                ...current,
                first_name: parts[0] || "",
                last_name: parts.slice(1).join(" "),
              }));
              setSelectedMatch(null);
              setStep("visitor-encode");
            }}
          >
            No match — add guest
          </Button>
        )}
        {!visitorSearching && visitorResults.length > 0 && (
          <button
            type="button"
            className="w-full text-center text-sm font-medium text-primary"
            onClick={() => {
              const parts = visitorQuery.trim().split(/\s+/);
              setEncode((current) => ({
                ...current,
                first_name: parts[0] || "",
                last_name: parts.slice(1).join(" "),
              }));
              setSelectedMatch(null);
              setStep("visitor-encode");
            }}
          >
            Not listed? Add a new guest
          </button>
        )}
        {actionError}
      </div>,
    );
  }

  if (step === "visitor-encode") {
    return shell(
      <form className="space-y-4" onSubmit={handleEncode}>
        {eventCard}
        <div className="flex items-center gap-3">
          <BackButton onClick={() => setStep("visitor-search")} />
          <h2 className="text-base font-semibold text-lighthouse-navy">
            Guest check-in
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            First name *
            <input
              required
              className="mt-1 w-full rounded-full border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Juan"
              value={encode.first_name}
              onChange={(event) =>
                setEncode((current) => ({
                  ...current,
                  first_name: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Last name *
            <input
              required
              className="mt-1 w-full rounded-full border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Santos"
              value={encode.last_name}
              onChange={(event) =>
                setEncode((current) => ({
                  ...current,
                  last_name: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Phone (optional)
          <span className="mt-1 flex gap-2">
            <select
              aria-label="Phone country code"
              className="w-[6.75rem] shrink-0 rounded-full border border-gray-200 bg-white px-3 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={
                UNIQUE_DIAL_CODES.includes(phoneCountryCode)
                  ? phoneCountryCode
                  : getCountryDialCode(DEFAULT_COUNTRY)
              }
              onChange={(event) => {
                const nextCountry = findCountryForDialCode(
                  event.target.value,
                  phoneDialCountry,
                );
                const max = getCountryLocalMax(nextCountry);
                setPhoneDialCountry(nextCountry);
                setPhoneLocal((current) => current.slice(0, max));
              }}
            >
              {UNIQUE_DIAL_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="##########"
              value={phoneLocal}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, "");
                const max = getCountryLocalMax(phoneDialCountry);
                setPhoneLocal(digitsOnly.slice(0, max));
              }}
            />
          </span>
        </label>
        <label className="block text-sm font-medium">
          Email (optional)
          <input
            type="email"
            className="mt-1 w-full rounded-full border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="name@email.com"
            value={encode.email}
            onChange={(event) =>
              setEncode((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Gender *</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["MALE", "FEMALE"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setEncode((current) => ({ ...current, gender: value }))
                }
                className={`min-h-20 rounded-full border px-4 text-base font-medium ${
                  encode.gender === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200"
                }`}
              >
                {value === "MALE" ? "Male" : "Female"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Age group *</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["ADULT", "Adult", "18+"],
                ["YOUTH", "Youth", "13–17"],
                ["CHILD", "Child", "under 13"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setEncode((current) => ({ ...current, age_group: value }))
                }
                className={`min-h-12 rounded-2xl border px-1 text-center ${
                  encode.age_group === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200"
                }`}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 rounded-2xl border border-gray-200 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={firstTimeAttending}
            onChange={(event) => setFirstTimeAttending(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-lighthouse-navy">
              First time attending
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              When checked, first invited date is set to the same day as first
              attended.
            </span>
          </span>
        </label>
        <p className="text-sm text-muted-foreground">
          Inviter is you. This guest is recorded as attending online with you.
        </p>
        <OnlineVenuePicker
          venues={activeVenues}
          value={attendanceVenue}
          disabled={submitting}
          onChange={(code) => {
            setAttendanceVenue(code);
            setError(null);
          }}
        />
        {duplicateMatches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Existing matches</p>
            {duplicateMatches.map((person) => (
              <PersonRow
                key={`${visitorMatchKind(person)}-${visitorMatchKey(person).id}`}
                person={person}
                selected={sameVisitorMatch(
                  selectedMatch,
                  visitorMatchKey(person),
                )}
                onToggle={
                  person.already_checked_in
                    ? undefined
                    : () => toggleVisitor(person)
                }
              />
            ))}
            {duplicateMatches.some((person) => !person.already_checked_in) && (
              <Button
                type="button"
                className="w-full min-h-12"
                disabled={submitting || !selectedVisitor || !attendanceVenue}
                onClick={() => void handleConfirmVisitorCheckIn()}
              >
                {submitting
                  ? "Checking in…"
                  : selectedVisitor
                    ? `Check in ${selectedVisitor.full_name}`
                    : "Select a match to check in"}
              </Button>
            )}
          </div>
        )}
        {actionError}
        <Button
          type="submit"
          className="w-full min-h-12"
          disabled={submitting || !attendanceVenue}
        >
          {submitting ? "Saving…" : "Check in guest online"}
        </Button>
      </form>,
    );
  }

  return shell(
    <div className="space-y-5">
      {eventCard}
      <p className="text-center text-sm text-muted-foreground">
        Use this only if you are attending online.
      </p>
      <p className="text-center text-sm font-medium text-lighthouse-navy">
        I am checking in…
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setAttendanceVenue("");
            setError(null);
            setStep("member");
          }}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 px-3 py-4 text-center hover:border-primary/40"
        >
          <UserGroupIcon className="h-8 w-8 text-primary" />
          <span className="font-medium text-lighthouse-navy">My household</span>
          <span className="text-xs text-muted-foreground">
            Yourself and family attending online
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedMatch(null);
            setAttendanceVenue("");
            setError(null);
            setStep("visitor-search");
          }}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 px-3 py-4 text-center hover:border-primary/40"
        >
          <UserPlusIcon className="h-8 w-8 text-primary" />
          <span className="font-medium text-lighthouse-navy">A guest</span>
          <span className="text-xs text-muted-foreground">
            Someone attending online with you
          </span>
        </button>
      </div>
      {actionError}
    </div>,
  );
}

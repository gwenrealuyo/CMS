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
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
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
import type { SelfCheckInEventOption } from "@/src/types/selfCheckIn";
import type {
  OnsiteGuestAgeGroup,
  OnsiteGuestInviter,
  OnsiteGuestSessionDetails,
  OnsiteGuestSessionResponse,
  OnsiteGuestVisitorMatch,
} from "@/src/types/onsiteGuest";

type Step = "search" | "encode" | "success";

type VisitorMatchKey = {
  kind: "visitor" | "prospect";
  id: number;
};

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

function visitorMatchKind(
  person: OnsiteGuestVisitorMatch,
): "visitor" | "prospect" {
  return person.kind === "prospect" ? "prospect" : "visitor";
}

function visitorMatchKey(
  person: OnsiteGuestVisitorMatch,
): VisitorMatchKey {
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

function PersonRow({
  person,
  selected,
  onToggle,
}: {
  person: OnsiteGuestVisitorMatch;
  selected: boolean;
  onToggle?: () => void;
}) {
  const already = person.already_checked_in;
  const clickable = Boolean(onToggle) && !already;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${
        selected
          ? "border-primary bg-primary/5"
          : "border-gray-200 bg-white"
      } ${already ? "opacity-60" : ""} ${
        clickable ? "hover:border-primary/40" : "cursor-default"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-lighthouse-navy">
          {person.full_name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span
            className={`rounded-full px-1.5 py-0.5 font-medium ${getPersonRoleColor(
              person.role === "INVITED" ? "VISITOR" : person.role,
            )}`}
          >
            {person.kind === "prospect"
              ? "Invited"
              : person.role === "VISITOR"
                ? "Visitor"
                : person.role}
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

export default function GuestFormView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event") ?? "";
  const occurrenceParam = searchParams.get("occurrence") ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] =
    useState<OnsiteGuestSessionResponse | null>(null);
  const [step, setStep] = useState<Step>("search");
  const [successName, setSuccessName] = useState("");
  const [visitorQuery, setVisitorQuery] = useState("");
  const [visitorResults, setVisitorResults] = useState<
    OnsiteGuestVisitorMatch[]
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
    age_group: "" as "" | OnsiteGuestAgeGroup,
  });
  const [phoneDialCountry, setPhoneDialCountry] = useState(DEFAULT_COUNTRY);
  const [phoneLocal, setPhoneLocal] = useState("");
  const phoneCountryCode = getCountryDialCode(phoneDialCountry);
  const [duplicateMatches, setDuplicateMatches] = useState<
    OnsiteGuestVisitorMatch[]
  >([]);
  const [inviterQuery, setInviterQuery] = useState("");
  const [inviterResults, setInviterResults] = useState<
    OnsiteGuestInviter[]
  >([]);
  const [inviterSearching, setInviterSearching] = useState(false);
  const [selectedInviter, setSelectedInviter] =
    useState<OnsiteGuestInviter | null>(null);
  const [firstTimeAttending, setFirstTimeAttending] = useState(true);

  const session: OnsiteGuestSessionDetails | null =
    payload?.session ?? null;
  const selectedEventId =
    eventParam || (session ? String(eventIdFromOption(session.event)) : "");
  const selectedOccurrence =
    occurrenceParam || session?.occurrence_date || "";

  const sessionParams = useMemo(() => {
    const params: { event?: string; occurrence?: string } = {};
    if (selectedEventId) params.event = selectedEventId;
    if (selectedOccurrence) params.occurrence = selectedOccurrence;
    return params;
  }, [selectedEventId, selectedOccurrence]);

  const loadSession = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const params: { event?: string; occurrence?: string } = {};
        if (eventParam) params.event = eventParam;
        if (occurrenceParam) params.occurrence = occurrenceParam;
        const response = await eventsApi.onsiteGuestSession(
          Object.keys(params).length ? params : undefined,
        );
        setPayload(response.data);
      } catch (err) {
        if (!opts?.silent) {
          setError(
            formatApiErrorMessage(
              err,
              "Unable to load guest check-in.",
            ),
          );
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [eventParam, occurrenceParam],
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const query = visitorQuery.trim();
    if (step !== "search" || query.length < 2 || !selectedEventId) {
      setVisitorResults([]);
      setSelectedMatch(null);
      return;
    }
    let cancelled = false;
    setVisitorSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await eventsApi.searchOnsiteGuestVisitors(
          query,
          sessionParams,
        );
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
  }, [step, visitorQuery, selectedEventId, sessionParams]);

  useEffect(() => {
    const query = inviterQuery.trim();
    if (step !== "encode" || query.length < 2 || !selectedEventId) {
      setInviterResults([]);
      return;
    }
    let cancelled = false;
    setInviterSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await eventsApi.searchOnsiteGuestInviters(
          query,
          sessionParams,
        );
        if (!cancelled) setInviterResults(response.data.results);
      } catch {
        if (!cancelled) setInviterResults([]);
      } finally {
        if (!cancelled) setInviterSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, inviterQuery, selectedEventId, sessionParams]);

  const chooseEvent = (option: SelfCheckInEventOption) => {
    const id = eventIdFromOption(option);
    const occurrence = option.occurrence_date || "";
    const query = new URLSearchParams();
    query.set("event", String(id));
    if (occurrence) query.set("occurrence", occurrence);
    router.replace(`/events/guest?${query.toString()}`);
  };

  const resetEncode = () => {
    setEncode({
      first_name: "",
      last_name: "",
      email: "",
      gender: "",
      age_group: "",
    });
    setPhoneDialCountry(DEFAULT_COUNTRY);
    setPhoneLocal("");
    setDuplicateMatches([]);
    setSelectedInviter(null);
    setInviterQuery("");
    setInviterResults([]);
    setFirstTimeAttending(true);
    setError(null);
  };

  const goSearch = () => {
    setStep("search");
    setVisitorQuery("");
    setVisitorResults([]);
    setSelectedMatch(null);
    resetEncode();
  };

  const goEncode = () => {
    resetEncode();
    const trimmed = visitorQuery.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      setEncode((current) => ({
        ...current,
        first_name: parts[0],
        last_name: parts.slice(1).join(" "),
      }));
    } else if (parts.length === 1) {
      setEncode((current) => ({ ...current, first_name: parts[0] }));
    }
    setStep("encode");
  };

  const selectedVisitor =
    visitorResults.find((person) =>
      sameVisitorMatch(selectedMatch, visitorMatchKey(person)),
    ) ||
    duplicateMatches.find((person) =>
      sameVisitorMatch(selectedMatch, visitorMatchKey(person)),
    ) ||
    null;

  const checkInVisitorPerson = async (
    person: OnsiteGuestVisitorMatch,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const payloadBody =
        person.kind === "prospect"
          ? {
              prospect_id: person.prospect_id ?? person.id,
              event_id: selectedEventId ? Number(selectedEventId) : undefined,
              occurrence_date: selectedOccurrence || undefined,
              inviter_id: selectedInviter?.id,
            }
          : {
              person_id: person.id,
              event_id: selectedEventId ? Number(selectedEventId) : undefined,
              occurrence_date: selectedOccurrence || undefined,
              inviter_id: selectedInviter?.id,
            };
      const response = await eventsApi.onsiteGuestVisitor(payloadBody);
      setSuccessName(response.data.person.full_name);
      setStep("success");
      toast.success(`${response.data.person.full_name} checked in onsite.`);
      await loadSession({ silent: true });
    } catch (err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            already_checked_in?: boolean;
            person?: OnsiteGuestVisitorMatch;
            detail?: string;
          };
        };
      };
      if (
        axiosErr.response?.status === 409 &&
        axiosErr.response.data?.already_checked_in
      ) {
        const name =
          axiosErr.response.data.person?.full_name || person.full_name;
        toast.success(`${name} is already checked in.`);
        await loadSession({ silent: true });
        setStep("success");
        setSuccessName(name);
      } else {
        setError(formatApiErrorMessage(err, "Unable to check in this guest."));
      }
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
    setSubmitting(true);
    setError(null);
    setDuplicateMatches([]);
    try {
      const response = await eventsApi.onsiteGuestVisitor({
        first_name: encode.first_name.trim(),
        last_name: encode.last_name.trim(),
        gender: encode.gender,
        age_group: encode.age_group,
        phone: phoneLocal ? `${phoneCountryCode}${phoneLocal}` : undefined,
        email: encode.email.trim() || undefined,
        inviter_id: selectedInviter?.id,
        event_id: selectedEventId ? Number(selectedEventId) : undefined,
        occurrence_date: selectedOccurrence || undefined,
        first_time_attending: firstTimeAttending,
      });
      setSuccessName(response.data.person.full_name);
      setStep("success");
      toast.success(`${response.data.person.full_name} checked in onsite.`);
      await loadSession({ silent: true });
    } catch (err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            matches?: OnsiteGuestVisitorMatch[];
            detail?: string;
            already_checked_in?: boolean;
            person?: OnsiteGuestVisitorMatch;
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
        toast.success(`${name} is already checked in.`);
        setSuccessName(name);
        setStep("success");
        await loadSession({ silent: true });
      } else {
        setError(formatApiErrorMessage(err, "Unable to add this guest."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const checkInHref =
    selectedEventId && selectedOccurrence
      ? `/events/check-in?event=${selectedEventId}&occurrence=${selectedOccurrence}`
      : "/events";

  const shell = (body: ReactNode) => (
    <div className="min-h-screen bg-background">
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
            href={checkInHref}
            className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Check-in
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-8">{body}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>,
    );
  }

  if (error && !payload) {
    return shell(
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        {error}
      </div>,
    );
  }

  if (!payload?.available) {
    return shell(
      <div className="space-y-4 text-center">
        <p className="text-base font-medium text-lighthouse-navy">
          Guest check-in unavailable
        </p>
        <p className="text-sm text-muted-foreground">
          {payload?.detail ||
            "No approved Sunday Service is open for onsite guest encoding right now."}
        </p>
        <Link
          href="/events"
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          Back to Events
        </Link>
      </div>,
    );
  }

  if (payload.needs_selection) {
    return shell(
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Select which Sunday Service this guest is attending.
        </p>
        <div className="space-y-3">
          {payload.options.map((option) => (
            <button
              key={`${eventIdFromOption(option)}-${option.start}`}
              type="button"
              onClick={() => chooseEvent(option)}
              className="w-full rounded-2xl border border-gray-200 bg-white p-1 text-left hover:border-primary/40"
            >
              <ServiceCard event={option} />
            </button>
          ))}
        </div>
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
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  ) : null;

  if (step === "success") {
    return shell(
      <div className="space-y-5 text-center">
        {eventCard}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-8">
          <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
          <p className="text-lg font-semibold text-lighthouse-navy">
            {successName}
          </p>
          <p className="text-sm text-emerald-800">Checked in onsite</p>
        </div>
        <Button type="button" className="w-full min-h-12" onClick={goSearch}>
          Add another guest
        </Button>
        <Link
          href={checkInHref}
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          Back to check-in station
        </Link>
      </div>,
    );
  }

  if (step === "encode") {
    return shell(
      <form className="space-y-5" onSubmit={(e) => void handleEncode(e)}>
        <div className="flex items-center justify-between gap-3">
          <BackButton onClick={goSearch} />
          <p className="text-sm font-medium text-lighthouse-navy">
            New guest
          </p>
        </div>
        {eventCard}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div>
          <label className="block text-sm font-medium">
            Inviter (optional)
            {selectedInviter ? (
              <span className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-lighthouse-navy">
                    {selectedInviter.full_name}
                  </span>
                  {selectedInviter.member_id ? (
                    <span className="text-xs text-muted-foreground">
                      #{formatLampIdDisplay(selectedInviter.member_id)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-label="Clear inviter"
                  className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-lighthouse-navy"
                  onClick={() => {
                    setSelectedInviter(null);
                    setInviterQuery("");
                    setInviterResults([]);
                  }}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </span>
            ) : (
              <>
                <span className="relative mt-1 block">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full rounded-full border border-gray-200 py-3 pl-9 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Search who brought them…"
                    value={inviterQuery}
                    onChange={(event) => setInviterQuery(event.target.value)}
                  />
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank for a walk-in (no inviter).
                </p>
                {inviterSearching ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Searching…
                  </p>
                ) : null}
                {inviterResults.length > 0 ? (
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {inviterResults.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-3 py-2.5 text-left hover:border-primary/40"
                        onClick={() => {
                          setSelectedInviter(person);
                          setInviterQuery("");
                          setInviterResults([]);
                        }}
                      >
                        <span>
                          <span className="block font-medium text-lighthouse-navy">
                            {person.full_name}
                          </span>
                          {person.member_id ? (
                            <span className="text-xs text-muted-foreground">
                              #{formatLampIdDisplay(person.member_id)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </label>
        </div>
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
                    : () => setSelectedMatch(visitorMatchKey(person))
                }
              />
            ))}
            {duplicateMatches.some((person) => !person.already_checked_in) && (
              <Button
                type="button"
                className="w-full min-h-12"
                disabled={submitting || !selectedVisitor}
                onClick={() =>
                  selectedVisitor && void checkInVisitorPerson(selectedVisitor)
                }
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
        <Button type="submit" className="w-full min-h-12" disabled={submitting}>
          {submitting ? "Saving…" : "Check in guest onsite"}
        </Button>
      </form>,
    );
  }

  return shell(
    <div className="space-y-5">
      <div className="mb-1 rounded-lg border border-primary/20 bg-gradient-to-r from-lighthouse-ivory to-muted px-4 py-3">
        <h1 className="text-xs font-semibold uppercase tracking-wide text-primary">
          Guest
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Search first, then encode a new walk-in for this Sunday Service
          (onsite).
        </p>
      </div>
      {eventCard}
      <label className="block">
        <span className="sr-only">Search guests</span>
        <span className="relative block">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            className="w-full rounded-full border border-gray-200 py-3 pl-9 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Search visitor or invited guest…"
            value={visitorQuery}
            onChange={(event) => setVisitorQuery(event.target.value)}
          />
        </span>
      </label>
      {visitorSearching ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : null}
      {visitorResults.length > 0 ? (
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
                  : () => setSelectedMatch(visitorMatchKey(person))
              }
            />
          ))}
        </div>
      ) : visitorQuery.trim().length >= 2 && !visitorSearching ? (
        <p className="text-sm text-muted-foreground">
          No matches. Encode them as a new guest.
        </p>
      ) : null}
      {selectedVisitor && !selectedVisitor.already_checked_in ? (
        <Button
          type="button"
          className="w-full min-h-12"
          disabled={submitting}
          onClick={() => void checkInVisitorPerson(selectedVisitor)}
        >
          {submitting
            ? "Checking in…"
            : `Check in ${selectedVisitor.full_name}`}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="w-full min-h-12"
        onClick={goEncode}
      >
        <UserPlusIcon className="mr-2 h-5 w-5" />
        Encode new guest
      </Button>
      {actionError}
    </div>,
  );
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

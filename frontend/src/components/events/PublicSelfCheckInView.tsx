"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  CalendarDaysIcon,
  CameraIcon,
  CheckCircleIcon,
  MapPinIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

import AppLogo from "@/src/components/brand/AppLogo";
import CheckInQrScanner from "@/src/components/events/CheckInQrScanner";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { publicSelfCheckInApi } from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import { decodeQrFromFile } from "@/src/lib/events/decodeQrFromFile";
import { formatPersonName } from "@/src/lib/name";
import { AttendanceVenueOption } from "@/src/types/event";
import {
  PublicSelfCheckInPerson,
  PublicSelfCheckInSessionResponse,
  SelfCheckInEventOption,
} from "@/src/types/selfCheckIn";

const SCAN_COOLDOWN_MS = 2000;

type Step = "identify" | "select-event" | "confirm" | "success";
type IdPrefix = "LAMP" | "GUEST";

function composeMemberId(prefix: IdPrefix, digits: string): string {
  const rest = digits.trim().replace(/\s+/g, "");
  if (!rest) return "";
  const parsed = parseScannedMemberId(rest, prefix);
  return `${parsed.prefix}${parsed.digits}`;
}

function parseScannedMemberId(
  raw: string,
  currentPrefix: IdPrefix,
): { prefix: IdPrefix; digits: string } {
  const trimmed = raw.trim().replace(/\s+/g, "");
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("GUEST")) {
    return { prefix: "GUEST", digits: trimmed.slice(5) };
  }
  if (upper.startsWith("LAMP")) {
    return { prefix: "LAMP", digits: trimmed.slice(4) };
  }
  return { prefix: currentPrefix, digits: trimmed };
}

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

function axiosDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return typeof detail === "string" ? detail : undefined;
}

export default function PublicSelfCheckInView() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event") ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanCooldownUntilRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decodingPhoto, setDecodingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] =
    useState<PublicSelfCheckInSessionResponse | null>(null);
  const [step, setStep] = useState<Step>("identify");
  const [idPrefix, setIdPrefix] = useState<IdPrefix>("LAMP");
  const [idNumber, setIdNumber] = useState("");
  const [person, setPerson] = useState<PublicSelfCheckInPerson | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(eventParam);
  const [attendanceVenue, setAttendanceVenue] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  const sessionEvent = payload?.session?.event ?? null;
  const memberId = composeMemberId(idPrefix, idNumber);

  const activeVenues = useMemo(() => {
    const venues = payload?.attendance_venues ?? [];
    return venues
      .filter((venue) => venue.is_active !== false)
      .slice()
      .sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
      );
  }, [payload?.attendance_venues]);

  const applyPayload = useCallback(
    (data: PublicSelfCheckInSessionResponse, nextMemberId?: string) => {
      setPayload(data);
      if (data.person) {
        setPerson(data.person);
      }
      const eventId =
        data.session?.event.id ??
        data.session?.event.event_id ??
        (data.options.length === 1 ? eventIdFromOption(data.options[0]) : "");
      if (eventId) {
        setSelectedEventId(String(eventId));
      }
      if (data.person) {
        setAlreadyCheckedIn(
          Boolean(data.already_checked_in || data.person.already_checked_in),
        );
        if (data.needs_selection) {
          setStep("select-event");
        } else if (data.already_checked_in || data.person.already_checked_in) {
          setStep("success");
        } else {
          setStep("confirm");
        }
      }
      if (nextMemberId) {
        const parsed = parseScannedMemberId(nextMemberId, "LAMP");
        setIdPrefix(parsed.prefix);
        setIdNumber(parsed.digits);
      }
    },
    [],
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await publicSelfCheckInApi.session(
        eventParam ? { event: eventParam } : undefined,
      );
      setPayload(response.data);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Unable to load self check-in."));
    } finally {
      setLoading(false);
    }
  }, [eventParam]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const identifyMember = async (rawMemberId: string, eventId?: string) => {
    const trimmed = rawMemberId.trim();
    if (!trimmed) {
      setError("Enter your LAMP ID.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await publicSelfCheckInApi.identify({
        member_id: trimmed,
        ...(eventId
          ? { event_id: eventId }
          : eventParam
            ? { event_id: eventParam }
            : {}),
      });
      applyPayload(response.data, trimmed);
      if (
        response.data.already_checked_in ||
        response.data.person?.already_checked_in
      ) {
        toast.success("You are already checked in.");
      }
    } catch (err) {
      setPerson(null);
      setError(
        axiosDetail(err) ||
          formatApiErrorMessage(err, "Unable to find this LAMP ID."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleIdentifySubmit = (event: FormEvent) => {
    event.preventDefault();
    void identifyMember(memberId);
  };

  const handleQrScan = (text: string) => {
    const now = Date.now();
    if (submitting || now < scanCooldownUntilRef.current) return;
    scanCooldownUntilRef.current = now + SCAN_COOLDOWN_MS;
    const scanned = text.trim();
    if (!scanned) {
      setError("No LAMP ID found in this QR code.");
      return;
    }
    const parsed = parseScannedMemberId(scanned, idPrefix);
    setIdPrefix(parsed.prefix);
    setIdNumber(parsed.digits);
    setShowScanner(false);
    void identifyMember(composeMemberId(parsed.prefix, parsed.digits));
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDecodingPhoto(true);
    setError(null);
    try {
      const text = await decodeQrFromFile(file);
      if (!text) {
        setError(
          "Couldn't read a QR code from that photo. Try typing your LAMP ID.",
        );
        return;
      }
      const parsed = parseScannedMemberId(text, idPrefix);
      setIdPrefix(parsed.prefix);
      setIdNumber(parsed.digits);
      await identifyMember(composeMemberId(parsed.prefix, parsed.digits));
    } catch {
      setError(
        "Couldn't read a QR code from that photo. Try typing your LAMP ID.",
      );
    } finally {
      setDecodingPhoto(false);
    }
  };

  const chooseEvent = (option: SelfCheckInEventOption) => {
    const eventId = String(eventIdFromOption(option));
    setSelectedEventId(eventId);
    void identifyMember(memberId, eventId);
  };

  const handleCheckIn = async () => {
    const trimmed = memberId.trim();
    if (!trimmed) {
      setError("Enter your LAMP ID.");
      return;
    }
    if (!attendanceVenue) {
      setError("Select an online venue before checking in.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await publicSelfCheckInApi.checkIn({
        member_id: trimmed,
        attendance_venue: attendanceVenue,
        ...(selectedEventId ? { event_id: selectedEventId } : {}),
      });
      applyPayload(response.data, trimmed);
      setAlreadyCheckedIn(
        Boolean(
          response.data.already_checked_in ||
          response.data.person?.already_checked_in,
        ),
      );
      setStep("success");
      if (response.data.already_checked_in) {
        toast.success("You are already checked in.");
      } else {
        toast.success("You're checked in online.");
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const data = (
        err as { response?: { data?: PublicSelfCheckInSessionResponse } }
      )?.response?.data;
      if (status === 409 && data) {
        applyPayload(data, trimmed);
        setAlreadyCheckedIn(true);
        setStep("success");
        toast.success("You are already checked in.");
        return;
      }
      setError(
        axiosDetail(err) ||
          formatApiErrorMessage(err, "Unable to check in. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetIdentify = () => {
    setStep("identify");
    setPerson(null);
    setIdPrefix("LAMP");
    setIdNumber("");
    setAttendanceVenue("");
    setAlreadyCheckedIn(false);
    setError(null);
    setShowScanner(false);
    void loadSession();
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
          <Link href="/" className="text-primary hover:underline">
            Back to home
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
        <Link href="/" className="mt-5 inline-block w-full">
          <Button className="w-full">Back to home</Button>
        </Link>
      </div>,
    );
  }

  const actionError = error ? (
    <p className="text-sm text-red-600">{error}</p>
  ) : null;

  if (step === "success" && person) {
    return shell(
      <div className="space-y-5 text-center">
        {sessionEvent ? <ServiceCard event={sessionEvent} /> : null}
        <div className="flex flex-col items-center gap-2 pt-2">
          <CheckCircleIcon className="h-14 w-14 text-emerald-600" />
          <p className="text-lg font-semibold text-lighthouse-navy">
            {alreadyCheckedIn
              ? "You're already checked in online"
              : "You're checked in online"}
          </p>
          <p className="text-sm text-muted-foreground">
            {person.full_name || formatPersonName(person)}
          </p>
        </div>
        <Button className="w-full" onClick={resetIdentify}>
          Check in someone else
        </Button>
      </div>,
    );
  }

  if (step === "select-event") {
    return shell(
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Choose the service you are attending online.
        </p>
        {actionError}
        {(payload.options.length ? payload.options : []).map((option) => (
          <button
            key={eventIdFromOption(option)}
            type="button"
            disabled={submitting}
            onClick={() => chooseEvent(option)}
            className="w-full rounded-2xl border border-gray-200 p-1 text-left transition hover:border-primary/40 disabled:opacity-60"
          >
            <ServiceCard event={option} />
          </button>
        ))}
        <Button variant="tertiary" className="w-full" onClick={resetIdentify}>
          Use a different LAMP ID
        </Button>
      </div>,
    );
  }

  if (step === "confirm" && person) {
    return shell(
      <div className="space-y-5">
        {sessionEvent ? <ServiceCard event={sessionEvent} /> : null}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3">
          {person.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.photo}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(person.first_name || person.full_name || "?")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-lighthouse-navy">
              {person.full_name || formatPersonName(person)}
            </p>
            <p className="text-sm text-muted-foreground">{person.member_id}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Is this you?</p>
          </div>
        </div>
        <OnlineVenuePicker
          venues={activeVenues}
          value={attendanceVenue}
          onChange={setAttendanceVenue}
          disabled={submitting}
        />
        {actionError}
        <div className="grid gap-2">
          <Button
            className="w-full"
            disabled={submitting || !attendanceVenue}
            onClick={() => void handleCheckIn()}
          >
            {submitting ? "Checking in…" : "Check in online"}
          </Button>
          <Button
            variant="tertiary"
            className="w-full"
            disabled={submitting}
            onClick={resetIdentify}
          >
            Use a different LAMP ID
          </Button>
        </div>
      </div>,
    );
  }

  return shell(
    <form className="space-y-4" onSubmit={handleIdentifySubmit}>
      {sessionEvent ? <ServiceCard event={sessionEvent} /> : null}
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-lighthouse-navy">
            Prefix on your card
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["LAMP", "GUEST"] as const).map((prefix) => {
              const selected = idPrefix === prefix;
              return (
                <button
                  key={prefix}
                  type="button"
                  disabled={submitting || decodingPhoto}
                  onClick={() => setIdPrefix(prefix)}
                  aria-pressed={selected}
                  className={`min-h-12 rounded-md border px-3 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-lighthouse-gold bg-lighthouse-gold text-[#5f2b0d] shadow-sm"
                      : "border-gray-300 bg-white text-muted-foreground hover:border-lighthouse-gold/60 hover:text-lighthouse-navy"
                  }`}
                >
                  {prefix}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="flex overflow-hidden rounded-md border border-gray-300 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <span className="flex min-w-[5.5rem] shrink-0 items-center justify-center border-r border-gray-200 bg-amber-50 px-3 text-sm font-bold tracking-wide text-[#5f2b0d]">
              {idPrefix}
            </span>
            <input
              id="public-lamp-id"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              placeholder="12345"
              className="min-w-0 flex-1 border-0 px-3 py-2.5 text-lg font-medium tracking-wide text-lighthouse-navy outline-none focus:ring-0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Match the prefix printed on your card or label, then type the number.
        </p>
      </div>
      {actionError}
      <Button
        className="w-full"
        type="submit"
        disabled={submitting || decodingPhoto}
      >
        {submitting ? "Looking up…" : "Continue"}
      </Button>
      <div className="grid gap-2">
        <Button
          type="button"
          variant="tertiary"
          className="w-full gap-2"
          disabled={submitting || decodingPhoto}
          onClick={() => setShowScanner((open) => !open)}
        >
          <CameraIcon className="h-5 w-5" />
          {showScanner ? "Hide camera" : "Scan member QR"}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          className="w-full gap-2"
          disabled={submitting || decodingPhoto}
          onClick={() => fileInputRef.current?.click()}
        >
          <PhotoIcon className="h-5 w-5" />
          {decodingPhoto ? "Reading photo…" : "Upload QR photo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handlePhotoUpload(event)}
        />
      </div>
      {showScanner ? (
        <CheckInQrScanner onScan={handleQrScan} paused={submitting} />
      ) : null}
    </form>,
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { usePeople } from "@/src/hooks/usePeople";
import { eventRegistrationApi, eventsApi } from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import { filterEligibleMembersByQuery } from "@/src/lib/events/checkInUtils";
import { formatPersonName } from "@/src/lib/name";
import {
  AttendanceMode,
  Event,
  EventRegistration,
  EventRegistrationPaymentMethod,
  EventRegistrationTier,
} from "@/src/types/event";
import { Person } from "@/src/types/person";

const PAYMENT_METHODS: { value: EventRegistrationPaymentMethod; label: string }[] =
  [
    { value: "CASH", label: "Cash" },
    { value: "CHECK", label: "Check" },
    { value: "BANK_TRANSFER", label: "Bank transfer" },
    { value: "CARD", label: "Card" },
    { value: "DIGITAL_WALLET", label: "Digital wallet" },
  ];

interface EventRegistrationDeskProps {
  eventId: string;
  occurrenceDate?: string;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export default function EventRegistrationDesk({
  eventId,
  occurrenceDate,
}: EventRegistrationDeskProps) {
  const { people, loading: peopleLoading } = usePeople();
  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<EventRegistrationTier[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [personQuery, setPersonQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mode, setMode] = useState<AttendanceMode>("ONSITE");
  const [tierId, setTierId] = useState<number | "">("");
  const [regOccurrenceDate, setRegOccurrenceDate] = useState(
    occurrenceDate ?? ""
  );
  const [allowCapacityOverride, setAllowCapacityOverride] = useState(false);

  const [paymentForId, setPaymentForId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<EventRegistrationPaymentMethod>("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, tiersRes, regsRes] = await Promise.all([
        eventsApi.getById(eventId),
        eventRegistrationApi.listTiers(eventId),
        eventRegistrationApi.listRegistrations(eventId),
      ]);
      setEvent(eventRes.data);
      setTiers(tiersRes.data);
      setRegistrations(regsRes.data);
      const format = eventRes.data.attendance_format ?? "hybrid";
      if (format === "online_only") {
        setMode("ONLINE");
      } else if (format === "onsite_only") {
        setMode("ONSITE");
      }
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Failed to load registration desk.")
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (occurrenceDate) {
      setRegOccurrenceDate(occurrenceDate);
    }
  }, [occurrenceDate]);

  const personCandidates = useMemo(() => people, [people]);

  const suggestions = useMemo(
    () => filterEligibleMembersByQuery(personCandidates, personQuery),
    [personCandidates, personQuery]
  );

  const tiersForMode = useMemo(
    () =>
      tiers.filter((tier) =>
        mode === "ONSITE" ? tier.onsite_offered : tier.online_offered
      ),
    [tiers, mode]
  );

  useEffect(() => {
    if (tierId !== "" && !tiersForMode.some((t) => t.id === tierId)) {
      setTierId("");
    }
  }, [tiersForMode, tierId]);

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setPersonQuery(formatPersonName(person));
    setShowSuggestions(false);
  };

  const handleRequestRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) {
      toast.error("Select a person to register.");
      return;
    }
    setSubmitting(true);
    try {
      await eventRegistrationApi.requestRegistration(eventId, {
        person: Number(selectedPerson.id),
        mode,
        tier: tierId === "" ? null : Number(tierId),
        occurrence_date: regOccurrenceDate || null,
        allow_capacity_override: allowCapacityOverride,
      });
      toast.success("Registration created.");
      setSelectedPerson(null);
      setPersonQuery("");
      setTierId("");
      setAllowCapacityOverride(false);
      await loadAll();
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Failed to create registration.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (registrationId: number) => {
    if (!window.confirm("Cancel this registration?")) return;
    try {
      await eventRegistrationApi.cancelRegistration(registrationId);
      toast.success("Registration cancelled.");
      await loadAll();
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Failed to cancel registration.")
      );
    }
  };

  const handleRefund = async (registrationId: number) => {
    if (!window.confirm("Mark this registration as refunded?")) return;
    try {
      await eventRegistrationApi.refundRegistration(registrationId);
      toast.success("Registration refunded.");
      await loadAll();
    } catch (error) {
      toast.error(
        formatApiErrorMessage(error, "Failed to refund registration.")
      );
    }
  };

  const openPayment = (reg: EventRegistration) => {
    setPaymentForId(reg.id);
    const due = Number(reg.amount_due) - Number(reg.amount_paid);
    setPaymentAmount(due > 0 ? due.toFixed(2) : "");
    setPaymentMethod("CASH");
    setPaymentNote("");
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentForId == null) return;
    if (!paymentAmount.trim()) {
      toast.error("Enter a payment amount.");
      return;
    }
    setPaymentSaving(true);
    try {
      await eventRegistrationApi.addPayment(paymentForId, {
        amount: paymentAmount,
        method: paymentMethod,
        note: paymentNote.trim() || undefined,
      });
      toast.success("Payment recorded.");
      setPaymentForId(null);
      await loadAll();
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Failed to record payment."));
    } finally {
      setPaymentSaving(false);
    }
  };

  const downloadCsv = () => {
    const header = [
      "person",
      "mode",
      "tier",
      "status",
      "amount_due",
      "amount_paid",
      "occurrence_date",
      "created_at",
    ];
    const rows = registrations.map((reg) =>
      [
        csvEscape(reg.person_name ?? reg.person),
        csvEscape(reg.mode),
        csvEscape(reg.tier_label ?? ""),
        csvEscape(reg.status),
        csvEscape(reg.amount_due),
        csvEscape(reg.amount_paid),
        csvEscape(reg.occurrence_date ?? ""),
        csvEscape(reg.created_at),
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-${eventId}-registrations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">Event not found.</p>
        <Link href="/events" className="mt-3 text-sm text-primary underline">
          Back to events
        </Link>
      </div>
    );
  }

  const format = event.attendance_format ?? "hybrid";
  const showModeSelect = format === "hybrid";

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Registration desk
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {event.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.registration_enabled
                ? "Paid registration is enabled."
                : "Registration is not enabled on this event yet."}
              {regOccurrenceDate ? ` Occurrence: ${regOccurrenceDate}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="tertiary" onClick={downloadCsv} type="button">
              Download CSV
            </Button>
            <Link href="/events">
              <Button variant="secondary" type="button">
                Back to events
              </Button>
            </Link>
          </div>
        </div>

        <form
          onSubmit={handleRequestRegistration}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            New registration
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="relative block text-sm text-gray-700 md:col-span-2">
              Person
              <input
                className="input-field mt-1 text-sm"
                value={personQuery}
                onChange={(e) => {
                  setPersonQuery(e.target.value);
                  setSelectedPerson(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search name or LAMP ID"
                autoComplete="off"
              />
              {showSuggestions && personQuery.trim() && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {peopleLoading ? (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      Loading people…
                    </li>
                  ) : suggestions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">
                      No matches
                    </li>
                  ) : (
                    suggestions.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => handleSelectPerson(person)}
                        >
                          {formatPersonName(person)}
                          {person.member_id ? (
                            <span className="ml-2 text-xs text-gray-500">
                              {person.member_id}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </label>

            {showModeSelect ? (
              <label className="block text-sm text-gray-700">
                Mode
                <select
                  className="input-field mt-1 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as AttendanceMode)}
                >
                  <option value="ONSITE">Onsite</option>
                  <option value="ONLINE">Online</option>
                </select>
              </label>
            ) : (
              <div className="text-sm text-gray-700">
                Mode
                <p className="mt-2 text-sm font-medium">{mode}</p>
              </div>
            )}

            <label className="block text-sm text-gray-700">
              Tier
              <select
                className="input-field mt-1 text-sm"
                value={tierId}
                onChange={(e) =>
                  setTierId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">No tier</option>
                {tiersForMode.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label} (
                    {mode === "ONSITE" ? tier.onsite_price : tier.online_price})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-gray-700">
              Occurrence date
              <input
                type="date"
                className="input-field mt-1 text-sm"
                value={regOccurrenceDate}
                onChange={(e) => setRegOccurrenceDate(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
              <input
                type="checkbox"
                checked={allowCapacityOverride}
                onChange={(e) => setAllowCapacityOverride(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
              />
              Allow capacity override
            </label>
          </div>
          <Button type="submit" disabled={submitting} className="min-h-[44px]">
            {submitting ? "Submitting…" : "Create registration"}
          </Button>
        </form>

        {paymentForId != null && (
          <form
            onSubmit={handleAddPayment}
            className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-800">
                Record payment
              </h2>
              <Button
                type="button"
                variant="tertiary"
                className="!px-2 !py-1 text-xs min-h-0"
                onClick={() => setPaymentForId(null)}
              >
                Close
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-sm text-gray-700">
                Amount
                <input
                  className="input-field mt-1 text-sm"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
              <label className="block text-sm text-gray-700">
                Method
                <select
                  className="input-field mt-1 text-sm"
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as EventRegistrationPaymentMethod
                    )
                  }
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-700">
                Note
                <input
                  className="input-field mt-1 text-sm"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </label>
            </div>
            <Button
              type="submit"
              disabled={paymentSaving}
              className="min-h-[44px]"
            >
              {paymentSaving ? "Saving…" : "Add payment"}
            </Button>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 font-semibold">Mode</th>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Paid</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No registrations yet.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => {
                  const terminal =
                    reg.status === "cancelled" || reg.status === "refunded";
                  return (
                    <tr key={reg.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {reg.person_name ?? `Person #${reg.person}`}
                        </div>
                        {reg.occurrence_date ? (
                          <div className="text-xs text-gray-500">
                            {reg.occurrence_date}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{reg.mode}</td>
                      <td className="px-3 py-2">{reg.tier_label ?? "—"}</td>
                      <td className="px-3 py-2 capitalize">
                        {reg.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2">{reg.amount_due}</td>
                      <td className="px-3 py-2">{reg.amount_paid}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {!terminal && (
                            <Button
                              type="button"
                              variant="tertiary"
                              className="!px-2 !py-1 text-xs min-h-0"
                              onClick={() => openPayment(reg)}
                            >
                              Record payment
                            </Button>
                          )}
                          {!terminal && (
                            <Button
                              type="button"
                              variant="tertiary"
                              className="!px-2 !py-1 text-xs min-h-0"
                              onClick={() => void handleCancel(reg.id)}
                            >
                              Cancel
                            </Button>
                          )}
                          {reg.status !== "refunded" &&
                            Number(reg.amount_paid) > 0 && (
                              <Button
                                type="button"
                                variant="tertiary"
                                className="!px-2 !py-1 text-xs min-h-0 !text-red-600"
                                onClick={() => void handleRefund(reg.id)}
                              >
                                Refund
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

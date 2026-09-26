"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import EventRegistrationDesk from "@/src/components/events/EventRegistrationDesk";
import { useAuth } from "@/src/contexts/AuthContext";

function EventRegistrationContent({
  eventId,
  occurrenceDate,
}: {
  eventId: string;
  occurrenceDate?: string;
}) {
  const { user } = useAuth();

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Registration desk is available to Admins only.
        </p>
      </div>
    );
  }

  return (
    <EventRegistrationDesk
      eventId={eventId}
      occurrenceDate={occurrenceDate}
    />
  );
}

export default function EventRegistrationsPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event") ?? "";
  const occurrenceParam = searchParams.get("occurrence");

  const occurrenceDate = useMemo(
    () => occurrenceParam ?? undefined,
    [occurrenceParam]
  );

  return (
    <ProtectedRoute>
      {eventId ? (
        <EventRegistrationContent
          eventId={eventId}
          occurrenceDate={occurrenceDate}
        />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Missing event. Open the registration desk from an event details
            page.
          </p>
        </div>
      )}
    </ProtectedRoute>
  );
}

"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import EventCheckInView from "@/src/components/events/EventCheckInView";

export default function EventCheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event") ?? "";
  const occurrenceParam = searchParams.get("occurrence");

  const occurrenceDate = useMemo(() => occurrenceParam ?? "", [occurrenceParam]);

  return (
    <ProtectedRoute>
      {eventId && occurrenceDate ? (
        <EventCheckInView eventId={eventId} occurrenceDate={occurrenceDate} />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Missing event or occurrence date. Open check-in from the event
            details page.
          </p>
        </div>
      )}
    </ProtectedRoute>
  );
}

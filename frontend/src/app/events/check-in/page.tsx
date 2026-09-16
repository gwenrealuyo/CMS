"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import EventCheckInView from "@/src/components/events/EventCheckInView";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { canWriteEvents } from "@/src/lib/events/eventPermissions";

function EventCheckInContent({
  eventId,
  occurrenceDate,
}: {
  eventId: string;
  occurrenceDate: string;
}) {
  const { user } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const allowed = canWriteEvents({ user, moduleEnabled });

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          You don’t have access to staff check-in. Use online self-check-in when
          it is available, or ask an Events coordinator for help.
        </p>
      </div>
    );
  }

  return <EventCheckInView eventId={eventId} occurrenceDate={occurrenceDate} />;
}

export default function EventCheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event") ?? "";
  const occurrenceParam = searchParams.get("occurrence");

  const occurrenceDate = useMemo(() => occurrenceParam ?? "", [occurrenceParam]);

  return (
    <ProtectedRoute>
      {eventId && occurrenceDate ? (
        <EventCheckInContent eventId={eventId} occurrenceDate={occurrenceDate} />
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

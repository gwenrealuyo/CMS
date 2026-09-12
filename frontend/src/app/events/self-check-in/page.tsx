"use client";

import { Suspense } from "react";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import EventSelfCheckInView from "@/src/components/events/EventSelfCheckInView";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";

export default function EventSelfCheckInPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <LoadingSpinner />
          </div>
        }
      >
        <EventSelfCheckInView />
      </Suspense>
    </ProtectedRoute>
  );
}

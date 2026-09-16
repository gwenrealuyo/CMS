"use client";

import { Suspense } from "react";

import EventSelfCheckInView from "@/src/components/events/EventSelfCheckInView";
import PublicSelfCheckInView from "@/src/components/events/PublicSelfCheckInView";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { useAuth } from "@/src/contexts/AuthContext";

function EventSelfCheckInContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (isAuthenticated) {
    return <EventSelfCheckInView />;
  }

  return <PublicSelfCheckInView />;
}

export default function EventSelfCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <LoadingSpinner />
        </div>
      }
    >
      <EventSelfCheckInContent />
    </Suspense>
  );
}

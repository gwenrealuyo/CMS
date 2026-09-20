"use client";

import { Suspense } from "react";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import GuestFormView from "@/src/components/events/GuestFormView";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { canWriteEvents } from "@/src/lib/events/eventPermissions";

function GuestContent() {
  const { user } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const allowed = canWriteEvents({ user, moduleEnabled });

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">
          You don’t have access to guest check-in. Ask an Events
          coordinator for help, or use the staff check-in station if you have
          Events write access.
        </p>
      </div>
    );
  }

  return <GuestFormView />;
}

export default function GuestPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <LoadingSpinner />
          </div>
        }
      >
        <GuestContent />
      </Suspense>
    </ProtectedRoute>
  );
}

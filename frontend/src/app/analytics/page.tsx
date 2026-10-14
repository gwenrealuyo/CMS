"use client";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import { usePageTitle } from "@/src/hooks/usePageTitle";
import AnalyticsPageContainer from "./AnalyticsPageContainer";

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PASTOR"]}>
      <AnalyticsPageContainer />
    </ProtectedRoute>
  );
}

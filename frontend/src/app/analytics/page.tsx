"use client";

import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import AnalyticsPageContainer from "./AnalyticsPageContainer";

export default function AnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PASTOR"]}>
      <AnalyticsPageContainer />
    </ProtectedRoute>
  );
}

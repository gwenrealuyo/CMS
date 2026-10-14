"use client";

import ClustersPageContainer from "./ClustersPageContainer";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import { usePageTitle } from "@/src/hooks/usePageTitle";

export default function ClustersPage() {
  usePageTitle("Clusters");
  return (
    <ProtectedRoute allowedRoles={["MEMBER", "PASTOR", "ADMIN"]}>
      <ClustersPageContainer />
    </ProtectedRoute>
  );
}

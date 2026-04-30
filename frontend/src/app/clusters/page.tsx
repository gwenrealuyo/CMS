"use client";

import ClustersPageContainer from "./ClustersPageContainer";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";

export default function ClustersPage() {
  return (
    <ProtectedRoute allowedRoles={["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"]}>
      <ClustersPageContainer />
    </ProtectedRoute>
  );
}

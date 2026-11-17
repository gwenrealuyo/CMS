"use client";

import { usePageTitle } from "@/src/hooks/usePageTitle";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import LessonsPageContainer from "./LessonsPageContainer";

export default function LessonsPage() {
  usePageTitle("Lessons");
  return (
    <ProtectedRoute>
      <LessonsPageContainer />
    </ProtectedRoute>
  );
}

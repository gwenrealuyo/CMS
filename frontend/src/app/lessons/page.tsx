"use client";

import { usePageTitle } from "@/src/hooks/usePageTitle";
import LessonsPageContainer from "./LessonsPageContainer";

export default function LessonsPage() {
  usePageTitle("Lessons");
  return <LessonsPageContainer />;
}

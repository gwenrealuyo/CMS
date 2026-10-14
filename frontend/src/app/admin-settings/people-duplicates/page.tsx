"use client";

import { useEffect } from "react";
import { usePageTitle } from "@/src/hooks/usePageTitle";
import { useRouter } from "next/navigation";

/** Old route — redirects into Admin Settings (People Duplicates tab). */
export default function PeopleDuplicatesRedirectPage() {
  usePageTitle("Admin Settings");
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin-settings");
  }, [router]);

  return null;
}

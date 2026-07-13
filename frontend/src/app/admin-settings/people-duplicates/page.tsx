"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old route — redirects into Admin Settings (People Duplicates tab). */
export default function PeopleDuplicatesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin-settings");
  }, [router]);

  return null;
}

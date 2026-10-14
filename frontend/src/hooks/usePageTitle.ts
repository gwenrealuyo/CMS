"use client";

import { useEffect } from "react";
import { formatPageTitle } from "@/src/lib/pageTitle";

export function usePageTitle(page?: string | null) {
  useEffect(() => {
    document.title = formatPageTitle(page);
  }, [page]);
}

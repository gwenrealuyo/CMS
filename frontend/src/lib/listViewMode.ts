"use client";

import { useEffect, useState } from "react";

export function getInitialListViewMode(
  desktopDefault: "table" | "cards" = "table",
): "table" | "cards" {
  if (typeof window !== "undefined" && window.innerWidth < 768) {
    return "cards";
  }
  return desktopDefault;
}

export function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsMdUp(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isMdUp;
}

export function effectiveListViewMode(
  viewMode: "table" | "cards",
  isMdUp: boolean,
): "table" | "cards" {
  if (!isMdUp && viewMode === "table") return "cards";
  return viewMode;
}

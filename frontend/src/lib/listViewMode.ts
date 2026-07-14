"use client";

import { useEffect, useState } from "react";
import { TABLET_MIN } from "@/src/lib/breakpoints";

export function getInitialListViewMode(
  desktopDefault: "table" | "cards" = "table",
): "table" | "cards" {
  if (typeof window !== "undefined" && window.innerWidth < TABLET_MIN) {
    return "cards";
  }
  return desktopDefault;
}

export function useIsMdUp(): boolean {
  // Default true to match typical SSR / desktop-first rendering; sync after mount.
  const [isMdUp, setIsMdUp] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => setIsMdUp(event.matches);
    setIsMdUp(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isMdUp;
}

export function useIsTabletUp(): boolean {
  // Default true to match typical SSR / desktop-first rendering; sync after mount.
  const [isTabletUp, setIsTabletUp] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);
    const onChange = (event: MediaQueryListEvent) =>
      setIsTabletUp(event.matches);
    setIsTabletUp(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isTabletUp;
}

export function effectiveListViewMode(
  viewMode: "table" | "cards",
  isTabletUp: boolean,
): "table" | "cards" {
  if (!isTabletUp && viewMode === "table") return "cards";
  return viewMode;
}

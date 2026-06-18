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

export function useIsTabletUp(): boolean {
  const [isTabletUp, setIsTabletUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(`(min-width: ${TABLET_MIN}px)`).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${TABLET_MIN}px)`);
    const onChange = (event: MediaQueryListEvent) =>
      setIsTabletUp(event.matches);
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

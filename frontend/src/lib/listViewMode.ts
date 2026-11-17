"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DESKTOP_MIN, TABLET_MIN } from "@/src/lib/breakpoints";

export function getInitialListViewMode(
  desktopDefault: "table" | "cards" = "table",
): "table" | "cards" {
  if (typeof window !== "undefined" && window.innerWidth < TABLET_MIN) {
    return "cards";
  }
  return desktopDefault;
}

/**
 * Mobile-first list mode. Starts on cards so SSR/hydration does not lock phones
 * to table; after mount, applies the desktop default on tablet+ widths.
 * User toggles are preserved.
 */
export function useListViewMode(
  desktopDefault: "table" | "cards" = "table",
): ["table" | "cards", Dispatch<SetStateAction<"table" | "cards">>] {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const userChoseRef = useRef(false);

  useEffect(() => {
    if (userChoseRef.current) {
      return;
    }
    setViewMode(getInitialListViewMode(desktopDefault));
  }, [desktopDefault]);

  const setViewModeWithChoice = useCallback<
    Dispatch<SetStateAction<"table" | "cards">>
  >((value) => {
    userChoseRef.current = true;
    setViewMode(value);
  }, []);

  return [viewMode, setViewModeWithChoice];
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

export function useIsDesktopUp(): boolean {
  // Default true to match typical SSR / desktop-first rendering; sync after mount.
  const [isDesktopUp, setIsDesktopUp] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const onChange = (event: MediaQueryListEvent) =>
      setIsDesktopUp(event.matches);
    setIsDesktopUp(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isDesktopUp;
}

export function effectiveListViewMode(
  viewMode: "table" | "cards",
  isTabletUp: boolean,
): "table" | "cards" {
  if (!isTabletUp && viewMode === "table") return "cards";
  return viewMode;
}

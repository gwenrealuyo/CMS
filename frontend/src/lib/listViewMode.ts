"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  DESKTOP_MIN,
  MD_MIN,
  SIDEBAR_COLLAPSED_WIDTH_PX,
  SIDEBAR_EXPANDED_WIDTH_PX,
  TABLET_MIN,
} from "@/src/lib/breakpoints";
import { useOptionalSidebar } from "@/src/components/layout/SidebarContext";

export function getContentLayoutWidth(
  windowWidth: number,
  sidebarCollapsed: boolean | null,
): number {
  // Below md the sidebar is an overlay, so content uses the full viewport.
  if (windowWidth < MD_MIN || sidebarCollapsed == null) {
    return windowWidth;
  }
  return (
    windowWidth -
    (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : SIDEBAR_EXPANDED_WIDTH_PX)
  );
}

export function getInitialListViewMode(
  desktopDefault: "table" | "cards" = "table",
  contentWidth?: number,
): "table" | "cards" {
  if (typeof window === "undefined" && contentWidth == null) {
    return "cards";
  }
  const width =
    contentWidth ??
    (typeof window !== "undefined" ? window.innerWidth : TABLET_MIN);
  if (width < TABLET_MIN) {
    return "cards";
  }
  return desktopDefault;
}

/**
 * Mobile-first list mode. Starts on cards so SSR/hydration does not lock phones
 * to table; after mount, uses available content width (viewport minus open
 * sidebar) so tablet/laptop layouts with the rail open still default to cards.
 * User toggles are preserved.
 */
export function useListViewMode(
  desktopDefault: "table" | "cards" = "table",
): ["table" | "cards", Dispatch<SetStateAction<"table" | "cards">>] {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const userChoseRef = useRef(false);
  const sidebar = useOptionalSidebar();
  const sidebarCollapsed = sidebar?.collapsed ?? null;

  useEffect(() => {
    if (userChoseRef.current) {
      return;
    }

    const syncFromLayout = () => {
      if (userChoseRef.current) {
        return;
      }
      const contentWidth = getContentLayoutWidth(
        window.innerWidth,
        sidebarCollapsed,
      );
      setViewMode(getInitialListViewMode(desktopDefault, contentWidth));
    };

    syncFromLayout();
    window.addEventListener("resize", syncFromLayout);
    return () => window.removeEventListener("resize", syncFromLayout);
  }, [desktopDefault, sidebarCollapsed]);

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

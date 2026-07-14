"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DESKTOP_MIN, MD_MIN } from "@/src/lib/breakpoints";

type SidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined
);

function readCollapsedPreference(): boolean {
  try {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      return saved === "1";
    }
    const width = window.innerWidth;
    if (width >= MD_MIN && width < DESKTOP_MIN) {
      return true;
    }
  } catch {
    // ignore storage / window access errors
  }
  return false;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Always start expanded so server HTML matches the first client render.
  // Restore preference after mount to avoid hydration mismatches (e.g. span labels).
  const [collapsed, setCollapsed] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedPreference());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed, hasHydrated]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = () => setCollapsed((prev) => !prev);
  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        setCollapsed,
        toggle,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

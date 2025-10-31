"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined
);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      if (saved != null) {
        setCollapsed(saved === "1");
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  const toggle = () => setCollapsed(!collapsed);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}


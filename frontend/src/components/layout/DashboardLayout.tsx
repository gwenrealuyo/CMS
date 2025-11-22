import React, { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { SidebarProvider } from "./SidebarContext";
import { useSidebar } from "./SidebarContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

function LayoutShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      <Sidebar />
      <div
        className={`${
          collapsed ? "md:ml-16" : "md:ml-64"
        } transition-all`}
      >
        <Navbar />
        <main className="p-4 md:p-6 mt-16">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <LayoutShell>{children}</LayoutShell>
    </SidebarProvider>
  );
}

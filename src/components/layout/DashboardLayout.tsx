import React, { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      <Sidebar />
      <div className="ml-64">
        <Navbar />
        <main className="p-6 mt-16">{children}</main>
      </div>
    </div>
  );
}

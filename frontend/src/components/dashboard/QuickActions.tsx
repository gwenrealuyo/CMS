"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Card from "@/src/components/ui/Card";
import { CalendarPlus, HandCoins, UserPlus } from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";

const ACTIONS = [
  {
    key: "people",
    label: "Add Person",
    href: "/people?action=create",
    icon: UserPlus,
    blurb: "Capture new members and returning guests.",
  },
  {
    key: "events",
    label: "Create Event",
    href: "/events?action=create",
    icon: CalendarPlus,
    blurb: "Schedule services, clusters, or special gatherings.",
  },
  {
    key: "finance",
    label: "Record Donation",
    href: "/finance?action=add-donation",
    icon: HandCoins,
    blurb: "Track donations, offerings, and pledges.",
  },
] as const;

export default function QuickActions() {
  const router = useRouter();
  const { user, isModuleCoordinator, isSeniorCoordinator } = useAuth();

  const canViewPeople = useMemo(() => {
    if (!user) return false;
    return (
      ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
      isSeniorCoordinator()
    );
  }, [user, isSeniorCoordinator]);

  const canViewEvents = useMemo(() => {
    if (!user) return false;
    return (
      ["MEMBER", "COORDINATOR", "PASTOR", "ADMIN"].includes(user.role) ||
      isModuleCoordinator("EVENTS") ||
      isSeniorCoordinator()
    );
  }, [user, isModuleCoordinator, isSeniorCoordinator]);

  const canViewFinance = useMemo(() => {
    if (!user) return false;
    return (
      user.role === "ADMIN" ||
      user.role === "PASTOR" ||
      isModuleCoordinator("FINANCE")
    );
  }, [user, isModuleCoordinator]);

  const availableActions = useMemo(
    () =>
      ACTIONS.filter((action) => {
        if (action.key === "people") return canViewPeople;
        if (action.key === "events") return canViewEvents;
        if (action.key === "finance") return canViewFinance;
        return false;
      }),
    [canViewEvents, canViewFinance, canViewPeople]
  );

  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Quick Actions
      </h3>
      {availableActions.length === 0 ? (
        <p className="text-sm text-gray-500">No quick actions available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableActions.map(({ label, blurb, icon: Icon, href }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className="group rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/10 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm shadow-[#2563EB]/20">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {label}
                </span>
              </div>
              {/* <p className="mt-2 text-xs text-[#4B5563] leading-snug">{blurb}</p> */}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

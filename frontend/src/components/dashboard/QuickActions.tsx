import Card from "@/src/components/ui/Card";
import {
  CalendarPlus,
  ClipboardCheck,
  HandCoins,
  UserPlus,
} from "lucide-react";

const ACTIONS = [
  {
    label: "Add Person",
    href: "/people/new",
    icon: UserPlus,
    blurb: "Capture new members and returning guests.",
  },
  {
    label: "Create Event",
    href: "/events/new",
    icon: CalendarPlus,
    blurb: "Schedule services, clusters, or special gatherings.",
  },
  {
    label: "Record Donation",
    href: "/donations/new",
    icon: HandCoins,
    blurb: "Log offerings, tithes, and faith pledges.",
  },
  {
    label: "Take Attendance",
    href: "/attendance/new",
    icon: ClipboardCheck,
    blurb: "Track attendance for services or clusters.",
  },
] as const;

export default function QuickActions() {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ACTIONS.map(({ label, blurb, icon: Icon, href }) => (
          <button
            key={label}
            onClick={() => (window.location.href = href)}
            className="group rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:bg-[#2563EB]/10 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm shadow-[#2563EB]/20">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {label}
              </span>
              {/* <span className="text-xs font-semibold uppercase tracking-wide text-[#2563EB] opacity-80 group-hover:opacity-100">
                Start
              </span> */}
            </div>
            {/* <p className="mt-2 text-xs text-[#4B5563] leading-snug">{blurb}</p> */}
          </button>
        ))}
      </div>
    </Card>
  );
}

import type { SegmentedControlOption } from "@/src/components/ui/SegmentedControl";

export type AnalyticsTab =
  | "overview"
  | "v2b"
  | "engagement"
  | "conversion"
  | "compliance"
  | "stewardship"
  | "people"
  | "builder";

export const ANALYTICS_TABS: SegmentedControlOption<AnalyticsTab>[] = [
  { id: "overview", label: "Overview" },
  { id: "v2b", label: "V2B" },
  { id: "engagement", label: "Engagement" },
  { id: "conversion", label: "Conversion" },
  { id: "compliance", label: "Compliance" },
  { id: "stewardship", label: "Stewardship" },
  { id: "people", label: "People" },
  { id: "builder", label: "Builder" },
];

export const ANALYTICS_TAB_META: Record<
  AnalyticsTab,
  { title: string; description: string }
> = {
  overview: {
    title: "Executive Overview",
    description:
      "A cross-module KPI summary will live here, composing one headline number from each dashboard.",
  },
  v2b: {
    title: "Visitor to Brethren",
    description:
      "The end-to-end visitor-to-brethren journey with conversion rates and leakage overlay is coming soon.",
  },
  engagement: {
    title: "Engagement & Attendance",
    description:
      "Sunday Service headcount plus cluster and evangelism weekly report attendance trends.",
  },
  conversion: {
    title: "Conversion & Formation",
    description:
      "NCC lesson progress and Sunday School formation metrics are coming soon.",
  },
  compliance: {
    title: "Compliance & Operations",
    description:
      "Report submission, overdue tasks, and coordinator coverage are coming soon.",
  },
  stewardship: {
    title: "Stewardship",
    description: "Giving and pledge fulfillment trends are coming soon.",
  },
  people: {
    title: "People & Demographics",
    description:
      "Membership composition, demographics, baptism milestones, and family/cluster coverage.",
  },
  builder: {
    title: "Report Builder",
    description:
      "Build ad-hoc reports by picking a subject, measure, dimension, and filters. Coming soon.",
  },
};

import type { SegmentedControlOption } from "@/src/components/ui/SegmentedControl";

export type AnalyticsTab =
  | "overview"
  | "v2b"
  | "e1r1"
  | "engagement"
  | "ncc"
  | "cym"
  | "compliance"
  | "stewardship"
  | "people"
  | "builder";

export const ANALYTICS_TABS: SegmentedControlOption<AnalyticsTab>[] = [
  { id: "overview", label: "Overview" },
  { id: "v2b", label: "V2B" },
  { id: "e1r1", label: "E1R1" },
  { id: "engagement", label: "Engagement" },
  { id: "ncc", label: "NCC" },
  { id: "cym", label: "CYM" },
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
      "Cross-module headline KPIs from People, V2B, Engagement, NCC, CYM, and Compliance. Click a card to open the full dashboard.",
  },
  v2b: {
    title: "Visitor to Brethren",
    description:
      "Pipeline funnel, monthly conversion trends, and drop-off leakage across the visitor-to-brethren journey.",
  },
  e1r1: {
    title: "Each 1 Reach 1",
    description:
      "Monthly people tally — invited, attended, students, baptized, received Holy Ghost, and reached counts by month.",
  },
  engagement: {
    title: "Engagement & Attendance",
    description:
      "Sunday Service headcount plus cluster and evangelism weekly report attendance trends.",
  },
  ncc: {
    title: "New Converts Course",
    description:
      "Lesson progress, participant status, and unassigned visitors across the NCC journey.",
  },
  cym: {
    title: "Children Youth Ministry",
    description:
      "Class enrollment, attendance rates, and formation coverage for Sunday School.",
  },
  compliance: {
    title: "Compliance & Operations",
    description:
      "Cluster report submission rates, overdue tasks, at-risk clusters, and coordinator notes.",
  },
  stewardship: {
    title: "Stewardship",
    description:
      "Giving totals, monthly trends, donation purpose mix, weekly offerings, and pledge fulfillment.",
  },
  people: {
    title: "People & Demographics",
    description:
      "Membership composition, demographics, baptism milestones, and family/cluster coverage.",
  },
  builder: {
    title: "Report Builder",
    description:
      "Pick a report subject, set filters, preview headline metrics, and export CSV.",
  },
};

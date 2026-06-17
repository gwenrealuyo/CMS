import type { AnalyticsTab } from "@/src/app/analytics/analyticsTabs";

/** Mirrors --chart-* and lighthouse tokens from globals.css for Recharts. */
export const ANALYTICS_CHART_COLORS = [
  "hsl(220, 80%, 56%)", // chart-1 / primary blue
  "hsl(38, 92%, 50%)", // chart-2 / accent gold
  "hsl(120, 18%, 36%)", // chart-3 / success olive
  "hsl(215, 16%, 47%)", // chart-4 / slate
  "hsl(0, 84%, 60%)", // chart-5 / destructive
  "#F59E0B", // lighthouse-gold
  "#4A6B4A", // lighthouse-olive
] as const;

export const ANALYTICS_CHART_STROKE_WIDTH = 3;
export const ANALYTICS_CHART_TICK_SIZE = 13;
export const ANALYTICS_CHART_GRID_STROKE = "hsl(214, 32%, 91%)";

export const ANALYTICS_MODULE_ACCENTS: Record<AnalyticsTab, string> = {
  overview: "border-l-primary",
  people: "border-l-primary",
  v2b: "border-l-chart-2",
  e1r1: "border-l-chart-2",
  engagement: "border-l-success",
  ncc: "border-l-chart-3",
  cym: "border-l-chart-2",
  compliance: "border-l-destructive",
  stewardship: "border-l-success",
  builder: "border-l-chart-4",
};

export function analyticsChartColor(index: number): string {
  return ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length];
}

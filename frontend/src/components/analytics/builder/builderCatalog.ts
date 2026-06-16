import { reportsApi } from "@/src/lib/api";
import type { ComplianceData, ComplianceStatus } from "@/src/types/cluster";
import type {
  CymSummary,
  EngagementSummary,
  NccSummary,
  PeopleSummary,
  V2bSummary,
} from "@/src/types/reports";

export interface BuilderPreviewKpi {
  label: string;
  value: string | number;
  hint?: string;
}

export type BuilderReportId =
  | "people"
  | "engagement"
  | "v2b"
  | "ncc"
  | "cym"
  | "compliance";

export type BuilderFilterField =
  | "months"
  | "year"
  | "month"
  | "start_date"
  | "end_date"
  | "status";

export interface BuilderFilterValues {
  months: number;
  year: number;
  month: number | "";
  start_date: string;
  end_date: string;
  status: ComplianceStatus | "ALL";
}

function daysAgoISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function currentYear() {
  return new Date().getFullYear();
}

export function defaultBuilderFilters(): BuilderFilterValues {
  return {
    months: 12,
    year: currentYear(),
    month: "",
    start_date: daysAgoISO(28),
    end_date: todayISO(),
    status: "ALL",
  };
}

export interface BuilderCatalogEntry {
  id: BuilderReportId;
  label: string;
  description: string;
  filterFields: BuilderFilterField[];
  csvFilename: string;
  fetchSummary: (params: {
    branch_id?: number;
    filters: BuilderFilterValues;
  }) => Promise<unknown>;
  exportCsv: (params: {
    branch_id?: number;
    filters: BuilderFilterValues;
  }) => Promise<BlobPart>;
  extractPreviewKpis: (data: unknown) => BuilderPreviewKpi[];
}

function peopleKpis(data: unknown): BuilderPreviewKpi[] {
  const summary = (data as PeopleSummary).summary;
  return [
    { label: "Total People", value: summary.total_people },
    { label: "Members", value: summary.total_members },
    { label: "Visitors", value: summary.total_visitors },
    { label: "Active Members", value: summary.active_members },
    { label: "In Cluster", value: summary.in_cluster },
  ];
}

function engagementKpis(data: unknown): BuilderPreviewKpi[] {
  const summary = (data as EngagementSummary).summary;
  return [
    { label: "Cluster Reports", value: summary.cluster_reports },
    { label: "Evangelism Reports", value: summary.evangelism_reports },
    {
      label: "Sunday Service Occurrences",
      value: summary.service_occurrences,
    },
    {
      label: "Avg Sunday Attendance",
      value: summary.service_avg_headcount.toFixed(1),
    },
    {
      label: "Cluster Avg Members",
      value: summary.cluster_avg_members.toFixed(1),
    },
  ];
}

function v2bKpis(data: unknown): BuilderPreviewKpi[] {
  const summary = (data as V2bSummary).summary;
  return [
    { label: "Active Prospects", value: summary.active_prospects },
    { label: "Completed Conversions", value: summary.completed_conversions },
    { label: "Total Reached", value: summary.total_reached },
    { label: "Drop-offs", value: summary.drop_offs },
    {
      label: "Recovery Rate",
      value: `${summary.recovery_rate.toFixed(1)}%`,
    },
  ];
}

function nccKpis(data: unknown): BuilderPreviewKpi[] {
  const payload = data as NccSummary;
  const overall = payload.overall;
  return [
    { label: "Participants", value: payload.total_participants },
    { label: "Completed", value: overall.COMPLETED ?? 0 },
    { label: "In Progress", value: overall.IN_PROGRESS ?? 0 },
    { label: "Assigned", value: overall.ASSIGNED ?? 0 },
    { label: "Unassigned Visitors", value: payload.unassigned_visitors ?? 0 },
  ];
}

function cymKpis(data: unknown): BuilderPreviewKpi[] {
  const summary = data as CymSummary;
  return [
    { label: "Active Classes", value: summary.active_classes },
    { label: "Students", value: summary.total_students },
    { label: "Teachers", value: summary.total_teachers },
    {
      label: "Avg Attendance",
      value:
        summary.average_attendance_rate != null
          ? `${summary.average_attendance_rate.toFixed(1)}%`
          : "—",
    },
    { label: "Total Classes", value: summary.total_classes },
  ];
}

function complianceKpis(data: unknown): BuilderPreviewKpi[] {
  const summary = (data as ComplianceData).summary;
  return [
    { label: "Total Clusters", value: summary.total_clusters },
    { label: "Compliant", value: summary.compliant_clusters },
    { label: "Non-compliant", value: summary.non_compliant_clusters },
    {
      label: "Compliance Rate",
      value: `${summary.compliance_rate.toFixed(1)}%`,
    },
    { label: "Partial", value: summary.partial_compliant_clusters },
  ];
}

export const BUILDER_CATALOG: BuilderCatalogEntry[] = [
  {
    id: "people",
    label: "People & Demographics",
    description:
      "Membership composition, demographics, and structural coverage.",
    filterFields: ["months"],
    csvFilename: "people_demographics.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getPeopleSummary({
        branch_id,
        months: filters.months,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportPeopleCSV({
        branch_id,
        months: filters.months,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: peopleKpis,
  },
  {
    id: "engagement",
    label: "Engagement & Attendance",
    description:
      "Cluster and evangelism weekly reports plus Sunday service attendance.",
    filterFields: ["months"],
    csvFilename: "engagement_attendance.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getEngagementSummary({
        branch_id,
        months: filters.months,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportEngagementCSV({
        branch_id,
        months: filters.months,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: engagementKpis,
  },
  {
    id: "v2b",
    label: "Visitor to Brethren",
    description: "Pipeline funnel and conversion metrics for the V2B journey.",
    filterFields: ["year"],
    csvFilename: "visitor_to_brethren.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getV2bSummary({
        branch_id,
        year: filters.year,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportV2bCSV({
        branch_id,
        year: filters.year,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: v2bKpis,
  },
  {
    id: "ncc",
    label: "New Converts Course",
    description: "Lesson progress and participant status across NCC.",
    filterFields: ["year"],
    csvFilename: "ncc_summary.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getNccSummary({
        branch_id,
        year: filters.year,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportNccCSV({
        branch_id,
        year: filters.year,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: nccKpis,
  },
  {
    id: "cym",
    label: "Children Youth Ministry",
    description: "Sunday School enrollment and attendance rates.",
    filterFields: ["year", "month"],
    csvFilename: "cym_summary.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getCymSummary({
        branch_id,
        year: filters.year,
        month: filters.month === "" ? undefined : filters.month,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportCymCSV({
        branch_id,
        year: filters.year,
        month: filters.month === "" ? undefined : filters.month,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: cymKpis,
  },
  {
    id: "compliance",
    label: "Compliance & Operations",
    description: "Cluster report submission rates for a date range.",
    filterFields: ["start_date", "end_date", "status"],
    csvFilename: "compliance_report.csv",
    fetchSummary: async ({ branch_id, filters }) => {
      const res = await reportsApi.getCompliance({
        branch_id,
        start_date: filters.start_date,
        end_date: filters.end_date,
        status: filters.status !== "ALL" ? filters.status : undefined,
      });
      return res.data;
    },
    exportCsv: async ({ branch_id, filters }) => {
      const res = await reportsApi.exportComplianceCSV({
        branch_id,
        start_date: filters.start_date,
        end_date: filters.end_date,
        status: filters.status !== "ALL" ? filters.status : undefined,
      });
      return res.data as BlobPart;
    },
    extractPreviewKpis: complianceKpis,
  },
];

export function getBuilderCatalogEntry(
  id: BuilderReportId,
): BuilderCatalogEntry | undefined {
  return BUILDER_CATALOG.find((entry) => entry.id === id);
}

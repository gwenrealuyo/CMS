export interface ReportsBranchOption {
  id: number;
  name: string;
}

/**
 * Reporting scope for the current user, returned by `GET /reports/meta/`.
 * This is the single source of truth for branch scoping in the analytics hub.
 */
export interface ReportsScopeMeta {
  role: string;
  /** ADMIN / HQ pastor may freely switch branches. */
  can_pick_branch: boolean;
  /** Branch pastors are locked to their own branch. */
  branch_locked: boolean;
  /** Branch to filter by, or null for "all branches". */
  effective_branch_id: number | null;
  /** Branches the user is allowed to select. */
  branches: ReportsBranchOption[];
}

export interface PeopleBreakdownItem {
  key: string;
  label: string;
  count: number;
}

export interface PeopleBranchBreakdownItem {
  branch_id: number;
  branch_name: string;
  count: number;
}

export interface PeopleSummaryKpis {
  total_people: number;
  total_members: number;
  total_visitors: number;
  active_members: number;
  semiactive_members: number;
  inactive_members: number;
  deceased: number;
  with_family: number;
  without_family: number;
  in_cluster: number;
  without_cluster: number;
}

export interface PeopleBaptismTrendPoint {
  period: string;
  count: number;
}

export interface PeopleBaptismTrend {
  months: number;
  water: PeopleBaptismTrendPoint[];
  spirit: PeopleBaptismTrendPoint[];
}

export interface PeopleSummary {
  summary: PeopleSummaryKpis;
  by_role: PeopleBreakdownItem[];
  by_status: PeopleBreakdownItem[];
  by_gender: PeopleBreakdownItem[];
  by_age_band: PeopleBreakdownItem[];
  by_entry_channel: PeopleBreakdownItem[];
  by_branch: PeopleBranchBreakdownItem[];
  baptism_trend: PeopleBaptismTrend;
}

export interface EngagementSummaryKpis {
  cluster_reports: number;
  cluster_avg_members: number;
  cluster_avg_visitors: number;
  evangelism_reports: number;
  evangelism_avg_members: number;
  evangelism_avg_visitors: number;
  service_occurrences: number;
  service_avg_headcount: number;
}

export interface EngagementMonthlyTrendPoint {
  period: string;
  members: number;
  visitors: number;
}

export interface EngagementGatheringTypeRow {
  gathering_type: string;
  count: number;
}

export interface EngagementClusterRow {
  cluster_id: number;
  cluster_label: string;
  report_count: number;
  sum_members_attended: number;
}

export interface EngagementGroupRow {
  group_id: number;
  group_label: string;
  report_count: number;
  sum_members_attended: number;
}

export interface EngagementWeeklySection {
  total_reports: number;
  total_attendance: {
    members: number;
    visitors: number;
  };
  average_attendance: {
    avg_members: number;
    avg_visitors: number;
  };
  gathering_type_distribution: EngagementGatheringTypeRow[];
  monthly_trend: EngagementMonthlyTrendPoint[];
}

export interface EngagementClusterSection extends EngagementWeeklySection {
  by_cluster: EngagementClusterRow[];
}

export interface EngagementEvangelismSection extends EngagementWeeklySection {
  by_group: EngagementGroupRow[];
}

export interface EngagementServiceTrendPoint {
  period: string;
  headcount: number;
}

export interface EngagementServiceOccurrence {
  event_id: number;
  event_title: string;
  occurrence_date: string;
  headcount: number;
}

export interface EngagementServiceSection {
  occurrence_count: number;
  avg_headcount: number;
  monthly_trend: EngagementServiceTrendPoint[];
  occurrences: EngagementServiceOccurrence[];
}

export interface EngagementBranchRow {
  branch_id: number;
  branch_name: string;
  cluster_members: number;
  evangelism_members: number;
  service_headcount: number;
}

export interface EngagementSummary {
  summary: EngagementSummaryKpis;
  cluster: EngagementClusterSection;
  evangelism: EngagementEvangelismSection;
  service: EngagementServiceSection;
  by_branch: EngagementBranchRow[];
}

export type NccProgressStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";

export interface NccLessonBreakdown {
  lesson_id: number;
  lesson_title: string;
  version_label: string;
  is_latest: boolean;
  order: number;
  total: number;
  completed: number;
  in_progress: number;
  assigned: number;
  skipped: number;
}

export interface NccSummary {
  overall: Record<NccProgressStatus, number>;
  total_participants: number;
  year: number;
  lessons: NccLessonBreakdown[];
  unassigned_visitors: number;
}

export interface CymClassRow {
  class_id: number;
  class_name: string;
  attendance_rate: number | null;
  student_count: number;
}

export interface CymUnenrolledCategory {
  category_id: number;
  category_name: string;
  age_range: string;
  unenrolled_count: number;
}

export interface CymSummary {
  total_classes: number;
  active_classes: number;
  inactive_classes: number;
  total_students: number;
  total_teachers: number;
  average_attendance_rate: number | null;
  by_class: CymClassRow[];
  unenrolled_by_category: CymUnenrolledCategory[];
}

export type V2bPipelineStage =
  | "INVITED"
  | "ATTENDED"
  | "TAKEN_NCC"
  | "BAPTIZED"
  | "RECEIVED_HG"
  | "CONVERTED";

export interface V2bFunnelStage {
  stage: V2bPipelineStage;
  label: string;
  count: number;
  rate_from_previous: number | null;
}

export interface V2bMonthlyTrendPoint {
  year: number;
  month: number;
  invited_count: number;
  attended_count: number;
  taken_ncc_count: number;
  baptized_count: number;
  received_hg_count: number;
  converted_count: number;
}

export interface V2bLeakageBreakdownItem {
  stage?: string;
  reason?: string;
  label: string;
  count: number;
}

export interface V2bLeakageSection {
  total_drop_offs: number;
  recovered: number;
  recovery_rate: number;
  by_stage: V2bLeakageBreakdownItem[];
  by_reason: V2bLeakageBreakdownItem[];
}

export interface V2bClusterRow {
  cluster_id: number;
  cluster_name: string;
  active_prospects: number;
  completed_conversions: number;
  drop_offs: number;
}

export interface V2bSummaryKpis {
  active_prospects: number;
  completed_conversions: number;
  total_reached: number;
  drop_offs: number;
  recovery_rate: number;
}

export interface V2bSummary {
  year: number;
  summary: V2bSummaryKpis;
  funnel: V2bFunnelStage[];
  monthly_trend: V2bMonthlyTrendPoint[];
  leakage: V2bLeakageSection;
  by_cluster: V2bClusterRow[];
}

export interface StewardshipSummaryKpis {
  total_collected: number;
  donation_total: number;
  offering_total: number;
  pledge_received_in_year: number;
  total_pledged: number;
  outstanding_balance: number;
  donation_count: number;
  offering_count: number;
  includes_offerings: boolean;
}

export interface StewardshipDonationStats {
  total_amount: number;
  donation_count: number;
  average_donation: number;
  purpose_breakdown: Record<string, number>;
}

export interface StewardshipOfferingWeeklyRow {
  week_start: string | null;
  total_amount: number;
}

export interface StewardshipMonthlyTrendPoint {
  month: number;
  donation_total: number;
  offering_total: number;
  pledge_contribution_total: number;
}

export interface StewardshipPledgeRow {
  id: number;
  pledge_title: string;
  pledge_amount: number;
  amount_received: number;
  balance: number;
  progress_percent: number;
  status: string;
}

export interface StewardshipSummary {
  year: number;
  summary: StewardshipSummaryKpis;
  donations: StewardshipDonationStats;
  offerings_weekly: StewardshipOfferingWeeklyRow[];
  monthly_trend: StewardshipMonthlyTrendPoint[];
  pledges: StewardshipPledgeRow[];
}

export type OverviewModuleTab =
  | "people"
  | "v2b"
  | "engagement"
  | "ncc"
  | "cym"
  | "compliance"
  | "stewardship";

export interface OverviewModuleKpi {
  tab: OverviewModuleTab;
  title: string;
  headline: {
    label: string;
    value: string | number;
  };
  hint: string | null;
}

export interface OverviewSummary {
  year: number;
  months: number;
  modules: OverviewModuleKpi[];
}

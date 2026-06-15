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

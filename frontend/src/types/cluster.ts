export type GatheringType = "PHYSICAL" | "ONLINE" | "HYBRID";

/** Privacy-safe person summary on cluster browse payloads. */
export interface ClusterMemberDetail {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  photo?: string | null;
}

/** Privacy-safe family summary on cluster browse payloads. */
export interface ClusterFamilyDetail {
  id: number;
  name: string;
  member_count: number;
}

export interface Cluster {
  id: number;
  code: string | null;
  name: string | null;
  coordinator: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  coordinator_id?: number | null;
  families: number[];
  members: number[];
  members_details?: ClusterMemberDetail[];
  families_details?: ClusterFamilyDetail[];
  /** Person IDs with CLUSTER REPORTER assignment for this cluster */
  reporter_ids?: number[];
  branch?: number | null;
  location: string;
  meeting_schedule: string;
  description: string;
  is_active?: boolean;
  created_at: string;
}

export interface ClusterInput {
  code?: string | null;
  name?: string | null;
  coordinator_id?: number | null;
  families?: number[];
  members?: number[];
  branch?: number | null;
  location?: string;
  meeting_schedule?: string;
  description?: string;
  is_active?: boolean;
}

export interface ClusterWeeklyReport {
  id: number;
  cluster: number;
  cluster_name: string;
  cluster_code: string | null;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended: number[];
  visitors_attended: number[];
  prospects_invited?: number[];
  members_attended_details?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    role?: string;
    status?: string;
  }>;
  visitors_attended_details?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    role?: string;
    status?: string;
  }>;
  prospects_invited_details?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    middle_name?: string;
    suffix?: string;
    display_name?: string;
    pipeline_stage?: string;
    pipeline_stage_display?: string;
    invited_by?: {
      id: number;
      first_name: string;
      last_name: string;
      username: string;
    } | null;
    person_id?: number | null;
  }>;
  members_present: number;
  visitors_present: number;
  prospects_invited_count?: number;
  member_attendance_rate: number;
  gathering_type: GatheringType;
  activities_held: string;
  prayer_requests: string;
  testimonies: string;
  offerings: string;
  highlights: string;
  lowlights: string;
  submitted_by: number | null;
  submitted_by_details?: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  submitted_at: string;
  updated_at: string;
}

export interface ClusterReportNewProspectInput {
  first_name: string;
  last_name: string;
  invited_by_id: number | string;
  middle_name?: string;
  suffix?: string;
  gender?: string;
  contact_info?: string;
  facebook_name?: string;
  notes?: string;
  date_first_invited?: string | null;
}

export interface ClusterReportNewVisitorInput {
  first_name: string;
  last_name: string;
  inviter_id?: number | string | null;
  middle_name?: string;
  suffix?: string;
  gender?: string;
  facebook_name?: string;
  note?: string;
  date_first_attended?: string | null;
  first_activity_attended?: string | null;
}

export interface ClusterWeeklyReportInput {
  cluster: number;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended?: number[];
  visitors_attended?: number[];
  prospects_invited?: number[];
  new_prospects?: ClusterReportNewProspectInput[];
  new_visitors?: ClusterReportNewVisitorInput[];
  prospects_attended?: number[];
  gathering_type: GatheringType;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  offerings?: string;
  highlights?: string;
  lowlights?: string;
  submitted_by?: number | null;
}

/** Form state before API payload build (visitors may include `prospect:{id}` / `newvisitor:{id}`). */
export interface ClusterWeeklyReportFormValues {
  cluster?: number;
  year?: number;
  week_number?: number;
  meeting_date?: string;
  members_attended: string[];
  visitors_attended: string[];
  prospects_invited: string[];
  pending_new_prospects: Record<string, ClusterReportNewProspectInput>;
  pending_new_visitors: Record<string, ClusterReportNewVisitorInput>;
  gathering_type?: GatheringType;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  offerings?: string | number;
  highlights?: string;
  lowlights?: string;
  submitted_by?: number | null;
}

export interface ClusterAnalyticsMonthlyBucket {
  month_key: string;
  month_label: string;
  members: number;
  visitors: number;
}

export interface ClusterAnalyticsClusterRow {
  cluster_id: number;
  cluster_label: string;
  report_count: number;
  sum_members_attended: number;
}

export interface ClusterAnalyticsChartSeries {
  monthly_attendance: ClusterAnalyticsMonthlyBucket[];
  cluster_comparison: ClusterAnalyticsClusterRow[];
}

export interface ClusterAnalytics {
  total_reports: number;
  total_attendance: {
    members: number;
    visitors: number;
  };
  average_attendance: {
    avg_members: number;
    avg_visitors: number;
  };
  total_offerings: number;
  gathering_type_distribution: Array<{
    gathering_type: string;
    count: number;
  }>;
  chart_series?: ClusterAnalyticsChartSeries;
}

export interface OverdueClusters {
  current_year: number;
  current_week: number;
  overdue_count: number;
  overdue_clusters: Cluster[];
}

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
export type ComplianceTrend = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface ComplianceNote {
  id: number;
  cluster: number;
  note: string;
  created_by: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  created_at: string;
  updated_at: string;
  period_start: string;
  period_end: string;
}

export interface ClusterCompliance {
  cluster: Cluster;
  status: ComplianceStatus;
  reports_submitted: number;
  reports_expected: number;
  compliance_rate: number;
  missing_weeks: number[];
  last_report_date: string | null;
  days_since_last_report: number | null;
  consecutive_missing_weeks: number;
  trend: ComplianceTrend;
  compliance_notes: ComplianceNote[];
}

export interface ComplianceSummary {
  total_clusters: number;
  compliant_clusters: number;
  non_compliant_clusters: number;
  partial_compliant_clusters: number;
  compliance_rate: number;
  period: {
    start_date: string;
    end_date: string;
    weeks_expected: number;
  };
}

export interface ComplianceData {
  summary: ComplianceSummary;
  clusters: ClusterCompliance[];
  by_status: {
    compliant: ClusterCompliance[];
    non_compliant: ClusterCompliance[];
    partial: ClusterCompliance[];
  };
}

export interface ComplianceHistoryPoint {
  period: string;  // Week or month identifier
  compliance_rate: number;
  reports_expected: number;
  reports_submitted: number;
}

export interface ComplianceHistory {
  data: ComplianceHistoryPoint[];
  group_by: 'week' | 'month';
  period_start: string;
  period_end: string;
}

export interface AtRiskCluster {
  cluster: Cluster;
  compliance: ClusterCompliance;
  risk_reason: string;
}

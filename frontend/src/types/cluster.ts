export type GatheringType = "PHYSICAL" | "ONLINE" | "HYBRID";

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
  branch?: number | null;
  location: string;
  meeting_schedule: string;
  description: string;
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
  members_attended_details?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  }>;
  visitors_attended_details?: Array<{
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  }>;
  members_present: number;
  visitors_present: number;
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

export interface ClusterWeeklyReportInput {
  cluster: number;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended?: number[];
  visitors_attended?: number[];
  gathering_type: GatheringType;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  offerings?: string;
  highlights?: string;
  lowlights?: string;
  submitted_by?: number | null;
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

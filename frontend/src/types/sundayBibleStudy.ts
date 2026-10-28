export type SundaySessionType = "BEFORE_SERVICE" | "AFTER_SERVICE";
export type SundayGatheringType = "PHYSICAL" | "ONLINE" | "HYBRID";
export type SundayVisitorKind = "FIRST_TIME" | "RETURNING";
export type SundayBibleStudyProgress =
  | "FOR_FOLLOW_UP"
  | "ENDORSED_BIBLE_STUDY"
  | "ENDORSED_NCC"
  | "ATTENDS_CLUSTERING"
  | "NO_FURTHER_ACTION"
  | "";

export interface SundayBibleStudyFacilitatorInput {
  person_id: number;
  is_lead?: boolean;
}

export interface SundayBibleStudyFacilitatorDetail {
  id: number;
  person_id: number;
  name: string;
  is_lead: boolean;
  evangelism_group_names: string[];
}

export interface SundayBibleStudyVisitorInput {
  person_id: number;
  attendance_kind: SundayVisitorKind;
  progress?: SundayBibleStudyProgress;
  note?: string;
  inviter_id?: number | null;
  date_first_attended?: string | null;
  first_activity_attended?: string | null;
}

export interface SundayBibleStudyNewVisitorInput {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  gender?: string;
  facebook_name?: string;
  inviter_id?: number | null;
  note?: string;
  progress?: SundayBibleStudyProgress;
  attendance_kind?: SundayVisitorKind;
  date_first_attended?: string | null;
  first_activity_attended?: string | null;
  prospect_id?: number | null;
}

export interface SundayBibleStudyVisitorDetail {
  id: number;
  person_id: number;
  name: string;
  attendance_kind: SundayVisitorKind;
  progress: SundayBibleStudyProgress;
  note: string;
  inviter_id: number | null;
  inviter_name: string;
  date_attended: string;
}

export interface SundayBibleStudyPersonDetail {
  id: number;
  name: string;
  role: string;
}

export interface SundayBibleStudyReport {
  id: number;
  branch: number;
  branch_name: string;
  session_date: string;
  year: number;
  week_number: number;
  session_type: SundaySessionType;
  gathering_type: SundayGatheringType | null;
  cancelled: boolean;
  cancellation_reason: string;
  topic: string;
  scripture_reference: string;
  study_summary: string;
  observation: string;
  testimonies: string;
  prayer_requests?: string;
  notes?: string;
  facilitator_details: SundayBibleStudyFacilitatorDetail[];
  visitor_details: SundayBibleStudyVisitorDetail[];
  members_attended: number[];
  members_attended_details: SundayBibleStudyPersonDetail[];
  facilitator_warnings: string[];
  member_count: number;
  first_time_count: number;
  returning_count: number;
  total_attendance: number;
  submitted_by: number | null;
  submitted_at: string;
  updated_at: string;
}

export interface SundayBibleStudyReportWrite {
  branch_id?: number;
  session_date: string;
  session_type: SundaySessionType;
  gathering_type?: SundayGatheringType | null;
  cancelled?: boolean;
  cancellation_reason?: string;
  topic?: string;
  scripture_reference?: string;
  study_summary?: string;
  observation?: string;
  testimonies?: string;
  prayer_requests?: string;
  notes?: string;
  facilitators?: SundayBibleStudyFacilitatorInput[];
  visitors?: SundayBibleStudyVisitorInput[];
  new_visitors?: SundayBibleStudyNewVisitorInput[];
  members_attended?: number[];
}

export interface SundayBibleStudySummaryBucket {
  report_count: number;
  cancelled_count: number;
  member_attendance: number;
  first_time_visitors: number;
  returning_visitors: number;
  total_attendance: number;
}

export interface SundayBibleStudySummary {
  report_count: number;
  cancelled_count: number;
  member_attendance: number;
  first_time_visitors: number;
  returning_visitors: number;
  total_attendance: number;
  unique_people: number;
  by_session_type: {
    BEFORE_SERVICE: SundayBibleStudySummaryBucket;
    AFTER_SERVICE: SundayBibleStudySummaryBucket;
  };
}

export const SUNDAY_PROGRESS_OPTIONS: {
  value: SundayBibleStudyProgress;
  label: string;
}[] = [
  { value: "", label: "None" },
  { value: "FOR_FOLLOW_UP", label: "For follow-up" },
  {
    value: "ENDORSED_BIBLE_STUDY",
    label: "Endorsed to existing Bible Study",
  },
  { value: "ENDORSED_NCC", label: "Interested in NCC" },
  { value: "ATTENDS_CLUSTERING", label: "Attends clustering" },
  { value: "NO_FURTHER_ACTION", label: "No further action" },
];

export function sessionTypeLabel(value: SundaySessionType): string {
  return value === "BEFORE_SERVICE" ? "Before Service" : "After Service";
}

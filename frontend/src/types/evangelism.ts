import { Person } from "./person";
import { Cluster } from "./cluster";

export interface EvangelismGroup {
  id: string;
  name: string;
  description?: string;
  coordinator?: Person;
  coordinator_id?: string;
  cluster?: Cluster;
  cluster_id?: string;
  location?: string;
  meeting_time?: string;
  meeting_day?: string;
  is_active: boolean;
  is_bible_sharers_group?: boolean;
  created_at: string;
  updated_at: string;
  members?: EvangelismGroupMember[];
  members_count?: number;
  conversions_count?: number;
}

export type ClassMemberRole = "LEADER" | "MEMBER" | "ASSISTANT_LEADER";

export interface EvangelismGroupMember {
  id: string;
  evangelism_group: string;
  person: Person;
  person_id: string;
  role: ClassMemberRole;
  role_display: string;
  joined_date: string;
  is_active: boolean;
  notes?: string;
}

export interface EvangelismSession {
  id: string;
  evangelism_group: EvangelismGroup;
  evangelism_group_id: string;
  event?: string;
  event_id?: string;
  session_date: string;
  session_time?: string;
  topic?: string;
  notes?: string;
  is_recurring_instance: boolean;
  recurring_group_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EvangelismWeeklyReport {
  id: string;
  evangelism_group: EvangelismGroup;
  year: number;
  week_number: number;
  meeting_date: string;
  members_attended: string[];
  visitors_attended: string[];
  members_attended_details?: Person[];
  visitors_attended_details?: Person[];
  gathering_type: "PHYSICAL" | "ONLINE" | "HYBRID";
  topic?: string;
  activities_held?: string;
  prayer_requests?: string;
  testimonies?: string;
  new_prospects: number;
  conversions_this_week: number;
  notes?: string;
  submitted_by?: Person;
  submitted_at: string;
  updated_at: string;
}

export interface EvangelismTallyRow {
  cluster_id?: number;
  cluster_name?: string;
  year: number;
  week_number: number;
  meeting_date?: string;
  gathering_type: "PHYSICAL" | "ONLINE" | "HYBRID" | "MIXED" | "UNKNOWN";
  members_count: number;
  visitors_count: number;
  evangelism_reports_count: number;
  cluster_reports_count: number;
  new_prospects: number;
  conversions_this_week: number;
}

export interface EvangelismPeopleTallyRow {
  month: number;
  year: number;
  invited_count: number;
  attended_count: number;
  students_count: number;
  baptized_count: number;
  received_hg_count: number;
}

export type PipelineStage = "INVITED" | "ATTENDED" | "BAPTIZED" | "RECEIVED_HG" | "CONVERTED";
export type FastTrackReason = "NONE" | "GOING_ABROAD" | "HEALTH_ISSUES" | "OTHER";

export interface Prospect {
  id: string;
  name: string;
  contact_info?: string;
  facebook_name?: string;
  invited_by: Person;
  invited_by_id: string;
  inviter_cluster?: Cluster;
  evangelism_group?: EvangelismGroup;
  evangelism_group_id?: string;
  endorsed_cluster?: Cluster;
  endorsed_cluster_id?: string;
  person?: Person;
  pipeline_stage: PipelineStage;
  pipeline_stage_display: string;
  first_contact_date?: string;
  last_activity_date?: string;
  is_attending_cluster: boolean;
  is_dropped_off: boolean;
  drop_off_date?: string;
  drop_off_stage?: PipelineStage;
  drop_off_reason?: string;
  has_finished_lessons: boolean;
  commitment_form_signed: boolean;
  fast_track_reason: FastTrackReason;
  notes?: string;
  days_since_last_activity?: number;
  created_at: string;
  updated_at: string;
}

export type TaskType = "PHONE_CALL" | "TEXT_MESSAGE" | "VISIT" | "EMAIL" | "PRAYER" | "OTHER";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface FollowUpTask {
  id: string;
  prospect: Prospect;
  prospect_id: string;
  assigned_to: Person;
  assigned_to_id: string;
  task_type: TaskType;
  task_type_display: string;
  due_date: string;
  completed_date?: string;
  status: TaskStatus;
  status_display: string;
  notes?: string;
  priority: TaskPriority;
  priority_display: string;
  created_by?: Person;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
}

export type DropOffReason = "NO_CONTACT" | "NO_SHOW" | "LOST_INTEREST" | "MOVED" | "OTHER";

export interface DropOff {
  id: string;
  prospect: Prospect;
  drop_off_date: string;
  drop_off_stage: PipelineStage;
  drop_off_stage_display: string;
  days_inactive: number;
  reason?: DropOffReason;
  reason_display?: string;
  reason_details?: string;
  recovery_attempted: boolean;
  recovery_date?: string;
  recovered: boolean;
  recovered_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversion {
  id: string;
  person: Person;
  person_id: string;
  prospect?: Prospect;
  prospect_id?: string;
  converted_by: Person;
  converted_by_id: string;
  evangelism_group?: EvangelismGroup;
  evangelism_group_id?: string;
  cluster?: Cluster;
  cluster_id?: string;
  conversion_date: string;
  water_baptism_date?: string;
  spirit_baptism_date?: string;
  is_complete: boolean;
  notes?: string;
  verified_by?: Person;
  verified_by_id?: string;
  created_at: string;
  updated_at: string;
}

export type MonthlyTrackingStage = "INVITED" | "ATTENDED" | "BAPTIZED" | "RECEIVED_HG";

export interface MonthlyConversionTracking {
  id: string;
  cluster: Cluster;
  prospect: Prospect;
  person?: Person;
  year: number;
  month: number;
  stage: MonthlyTrackingStage;
  stage_display: string;
  count: number;
  first_date_in_stage: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyStatistics {
  year: number;
  month: number;
  cluster_id: number;
  cluster_name: string;
  invited_count: number;
  attended_count: number;
  baptized_count: number;
  received_hg_count: number;
  converted_count: number;
}

export type GoalStatus = "IN_PROGRESS" | "COMPLETED" | "NOT_STARTED";

export interface Each1Reach1Goal {
  id: string;
  cluster: Cluster;
  cluster_id: string;
  year: number;
  target_conversions: number;
  achieved_conversions: number;
  status: GoalStatus;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface EvangelismSummary {
  total_groups: number;
  active_groups: number;
  total_prospects: number;
  total_conversions: number;
  monthly_statistics?: MonthlyStatistics[];
}

export interface RecurringSessionData {
  evangelism_group_id: number;
  start_date: string;
  end_date?: string;
  num_occurrences?: number;
  recurrence_pattern: "weekly" | "bi_weekly" | "monthly";
  day_of_week?: number;
  default_topic?: string;
}

export interface BulkEnrollData {
  person_ids: number[];
  role: ClassMemberRole;
}

export interface EvangelismGroupFormValues {
  name: string;
  description: string;
  coordinator_id?: string;
  cluster_id?: string;
  location: string;
  meeting_time: string;
  meeting_day: string;
  is_active: boolean;
  is_bible_sharers_group?: boolean;
}

export interface BibleSharersGroupInfo {
  id: string;
  name: string;
  coordinator: string | null;
  members_count: number;
}

export interface BibleSharersCoverageItem {
  cluster: Cluster;
  has_bible_sharers: boolean;
  bible_sharers_groups: BibleSharersGroupInfo[];
  bible_sharers_count: number;
}

export interface BibleSharersCoverage {
  coverage: BibleSharersCoverageItem[];
  summary: {
    total_clusters: number;
    clusters_with_bible_sharers: number;
    clusters_without_bible_sharers: number;
    clusters_without_names: string[];
    total_bible_sharers_groups: number;
  };
}


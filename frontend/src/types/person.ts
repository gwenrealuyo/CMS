// types/person.ts

export type PersonRole =
  | "MEMBER"
  | "VISITOR"
  | "PASTOR"
  | "ADMIN";

export type PersonStatus =
  | "ACTIVE"
  | "SEMIACTIVE"
  | "INACTIVE"
  | "DORMANT"
  | "FALLAWAY"
  | "DECEASED"
  | "ONGOING"
  | "NO_RESPONSE";

export type PersonStatusChangeSource =
  | "MANUAL"
  | "AUTO_ATTENDANCE"
  | "SYSTEM";

export interface PersonStatusChange {
  id: number;
  from_status: PersonStatus | "";
  to_status: PersonStatus;
  reason: string;
  source: PersonStatusChangeSource;
  changed_by: number | string | null;
  created_at: string;
  needs_follow_up: boolean;
}

export type MemberCareRecommendedAction =
  | "FOLLOW_UP_MONITOR"
  | "VISITATION"
  | "NO_ACTION"
  | "OTHER"
  | "";

export type MemberCareCaseStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "NO_ACTION"
  | "COMPLETED"
  | "RECOVERED";

export interface MemberCareCasePerson {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  role: PersonRole;
  status: PersonStatus;
  cluster_ids: number[];
  cluster_labels: string[];
}

export interface MemberCareAssignee {
  id: number;
  full_name: string;
}

export interface MemberCareCase {
  id: number;
  person: MemberCareCasePerson;
  details: string;
  recommended_action: MemberCareRecommendedAction;
  recommended_action_display: string;
  recommended_action_other: string;
  assigned_to: number[];
  assigned_to_details: MemberCareAssignee[];
  assigned_to_label: string;
  due_date: string | null;
  case_status: MemberCareCaseStatus;
  case_status_display: string;
  remarks: string;
  source_status_change: number | null;
  opened_at: string;
  updated_at: string;
  updated_by: number | null;
  needs_attention: boolean;
}

export type Gender = "MALE" | "FEMALE" | "";

export type JourneyType =
  | "LESSON"
  | "BAPTISM"
  | "SPIRIT"
  | "CLUSTER"
  | "NOTE"
  | "EVENT_ATTENDANCE"
  | "SUNDAY_SCHOOL"
  | "MINISTRY"
  | "BRANCH_TRANSFER";

export interface Journey {
  id: string;
  user: string; // refers to Person ID
  title?: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: JourneyType;
  type_display?: string;
  description?: string;
  verified_by?: string; // Person ID
  verified_by_display_name?: string | null;
  historical_verified_first_name?: string;
  historical_verified_last_name?: string;
  created_at?: string; // ISO datetime
}

/** Retrieve-only cluster row used for profile Quick Facts links. */
export interface ClusterMembership {
  id: number;
  name: string;
  code: string | null;
}

export interface Person {
  id: string;
  username: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  nickname?: string;
  maiden_name?: string;
  full_name?: string; // Computed full name from backend (includes nickname, middle initial, suffix)
  phone?: string;
  photo?: string | null; // URL to profile image; send null to clear
  gender?: Gender;
  facebook_name?: string;
  role: PersonRole;
  address?: string;
  country?: string;
  date_of_birth?: string; // ISO date string
  date_first_invited?: string; // ISO date string
  date_first_attended?: string; // ISO date string
  water_baptism_date?: string; // ISO date string
  spirit_baptism_date?: string; // ISO date string
  baptized_by?: string | null;
  baptized_by_display_name?: string | null;
  baptized_by_first_name?: string;
  baptized_by_last_name?: string;
  hg_witnessed_by?: string | null;
  hg_witnessed_by_display_name?: string | null;
  hg_witnessed_by_first_name?: string;
  hg_witnessed_by_last_name?: string;
  has_finished_lessons?: boolean;
  lessons_started_at?: string; // ISO date string
  lessons_finished_at?: string | null; // ISO date string
  /** Derived from LessonStudentEnrollment; writable on person form (write-through) */
  commitment_form_signed?: boolean;
  commitment_signed_at?: string | null; // ISO date or datetime
  has_lesson_enrollment?: boolean;
  lesson_teacher_display_name?: string | null;
  /** Write-only: assign teacher when creating enrollment via person form */
  lesson_teacher_id?: number | string | null;
  historical_teacher_first_name?: string;
  historical_teacher_last_name?: string;
  first_activity_attended?: string;
  inviter?: string; // ID of another Person
  /** Read-only display name of the inviter (retrieve/detail) */
  inviter_display_name?: string | null;
  /** Branch ID; may be absent/null on legacy records created before branch was enforced */
  branch?: number | null;
  branch_name?: string; // Branch name (if nested data included)
  branch_code?: string; // Branch code (if nested data included)
  member_id?: string;
  status: PersonStatus;
  /** Write-only: required when changing to Semi-active, Inactive, Dormant, Fall Away, or Deceased */
  status_change_reason?: string;
  /** Retrieve-only latest PersonStatusChange */
  latest_status_change?: PersonStatusChange | null;
  /** Retrieve-only open MemberCareCase when the requester can access member care */
  open_care_case?: MemberCareCase | null;
  journeys?: Journey[];
  groups?: string[]; // Group IDs
  user_permissions?: string[]; // Permission IDs
  cluster_codes?: string[];
  /** Formatted cluster membership for export: "(CODE) Name" */
  cluster_labels?: string[];
  /** Retrieve-only memberships for profile links; omitted from list payloads */
  cluster_memberships?: ClusterMembership[];
  family_names?: string[];
  /** Writable membership IDs (create/update); also returned on read for form prefill */
  family_ids?: string[];
  cluster_ids?: string[];
  module_coordinator_assignments?: ModuleCoordinator[];
  can_view_journey_timeline?: boolean;
  /** False when listed for search/assign but profile retrieve is out of scope */
  can_view_profile?: boolean;
  /** One-time value returned when an admin creates a user with auto-generated password */
  temporary_password?: string;
  /** Write-only: admin create flow */
  initial_password?: string;
  generate_temporary_password?: boolean;
}

// UI-normalized view of a person for components
export interface PersonUI extends Person {
  name: string;
  dateFirstAttended?: string;
}

export interface FamilyMemberPreview {
  id: number | string;
  first_name?: string;
  last_name?: string;
  role?: string;
  photo?: string | null;
}

export interface Family {
  id: string;
  name: string;
  leader?: string; // Person ID
  members?: string[]; // List of Person IDs (full detail / retrieve)
  branch?: number | null;
  address?: string; // Physical address/location
  notes?: string; // Family notes/description
  is_active?: boolean;
  created_at?: string;
  /** MEMBER + PASTOR household size (admins and visitors excluded). */
  member_count?: number;
  /** VISITOR-role household size. */
  visitor_count?: number;
  member_preview?: FamilyMemberPreview[];
  /** Present on retrieve — full slim roster for detail panel */
  members_details?: FamilyMemberPreview[];
}

export interface ModuleCoordinator {
  id: number;
  person: number;
  person_name?: string;
  module:
    | "CLUSTER"
    | "FINANCE"
    | "EVANGELISM"
    | "SUNDAY_SCHOOL"
    | "LESSONS"
    | "EVENTS"
    | "MINISTRIES";
  module_display?: string;
  level:
    | "COORDINATOR"
    | "SENIOR_COORDINATOR"
    | "TEACHER"
    | "BIBLE_SHARER"
    | "REPORTER";
  level_display?: string;
  resource_id?: number | null;
  resource_type?: string;
  resource_scope_label?: string | null;
  created_at?: string;
}

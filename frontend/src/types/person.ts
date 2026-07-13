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
  created_at?: string; // ISO datetime
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
  has_finished_lessons?: boolean;
  lessons_finished_at?: string; // ISO date string
  first_activity_attended?: string;
  inviter?: string; // ID of another Person
  /** Branch ID; may be absent/null on legacy records created before branch was enforced */
  branch?: number | null;
  branch_name?: string; // Branch name (if nested data included)
  branch_code?: string; // Branch code (if nested data included)
  member_id?: string;
  status: PersonStatus;
  journeys?: Journey[];
  groups?: string[]; // Group IDs
  user_permissions?: string[]; // Permission IDs
  cluster_codes?: string[];
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

export interface Family {
  id: string;
  name: string;
  leader?: string; // Person ID
  members: string[]; // List of Person IDs
  branch?: number | null;
  address?: string; // Physical address/location
  notes?: string; // Family notes/description
  is_active?: boolean;
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

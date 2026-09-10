export type MinistryCategory =
  | "worship"
  | "outreach"
  | "care"
  | "logistics"
  | "other"
  | "";

export type MinistryCadence =
  | "weekly"
  | "monthly"
  | "seasonal"
  | "event_driven"
  | "holiday"
  | "ad_hoc";

export type MinistryRole =
  | "primary_coordinator"
  | "coordinator"
  | "team_member"
  | "guest_helper";

export type MinistryScope = "BRANCH" | "NATIONAL";

export interface UserSummary {
  id: number;
  username: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  email: string;
}

export interface MinistryMember {
  id: number;
  ministry: number;
  member: UserSummary;
  member_id?: number; // For write operations (create/update)
  role: MinistryRole;
  join_date: string;
  is_active: boolean;
  availability: Record<string, unknown>;
  skills: string;
  notes: string;
  grant_lessons_teacher_access?: boolean;
  has_lessons_teacher_access?: boolean;
  grant_evangelism_bible_sharer_access?: boolean;
  has_evangelism_bible_sharer_access?: boolean;
}

export interface Ministry {
  id: number;
  name: string;
  code?: string | null;
  /** Present on retrieve/write payloads; omitted from slim directory list. */
  description?: string;
  category: MinistryCategory;
  scope: MinistryScope;
  branch?: number | null;
  activity_cadence: MinistryCadence;
  primary_coordinator: UserSummary | null;
  /** Present on retrieve/write payloads; omitted from slim directory list. */
  support_coordinators?: UserSummary[];
  meeting_location: string;
  meeting_schedule: Record<string, unknown> | null;
  communication_channel?: string;
  is_active: boolean;
  is_system?: boolean;
  created_at?: string;
  updated_at?: string;
  /** Present on retrieve/write payloads; omitted from slim directory list. */
  memberships?: MinistryMember[];
  /** Annotated count on slim directory list rows. */
  member_count?: number;
}

export interface MinistryCreateInput {
  name: string;
  code?: string;
  description?: string;
  category?: MinistryCategory | "";
  scope?: MinistryScope;
  branch?: number | null;
  activity_cadence: MinistryCadence;
  primary_coordinator_id?: number | string | null;
  support_coordinator_ids?: Array<number | string>;
  meeting_location?: string;
  meeting_schedule?: Record<string, unknown> | null;
  communication_channel?: string;
  is_active?: boolean;
}

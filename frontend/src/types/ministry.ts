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
}

export interface Ministry {
  id: number;
  name: string;
  description: string;
  category: MinistryCategory;
  activity_cadence: MinistryCadence;
  primary_coordinator: UserSummary | null;
  support_coordinators: UserSummary[];
  meeting_location: string;
  meeting_schedule: Record<string, unknown> | null;
  communication_channel: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  memberships: MinistryMember[];
}

export interface MinistryCreateInput {
  name: string;
  description?: string;
  category?: MinistryCategory | "";
  activity_cadence: MinistryCadence;
  primary_coordinator_id?: number | string | null;
  support_coordinator_ids?: Array<number | string>;
  meeting_location?: string;
  meeting_schedule?: Record<string, unknown> | null;
  communication_channel?: string;
  is_active?: boolean;
}

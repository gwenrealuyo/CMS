import type { AttendanceVenueOption } from "@/src/types/event";

export type SelfCheckInAgeGroup = "ADULT" | "YOUTH" | "CHILD";

export interface SelfCheckInEventOption {
  event_id: number;
  id?: number;
  title: string;
  branch: number | null;
  branch_name: string | null;
  location: string;
  room_name: string | null;
  start: string;
  end: string;
  occurrence_date: string | null;
  type?: string;
  type_display?: string;
}

export interface SelfCheckInPerson {
  id: number;
  first_name: string;
  last_name: string;
  nickname: string;
  full_name: string;
  role: string;
  status: string;
  member_id: string;
  photo: string | null;
  is_self: boolean;
  already_checked_in: boolean;
}

export interface SelfCheckInSessionDetails {
  event: SelfCheckInEventOption;
  occurrence_date: string;
  start: string;
  end: string;
  already_checked_in_ids: number[];
  household: SelfCheckInPerson[];
}

export interface SelfCheckInSessionResponse {
  available: boolean;
  reason: string | null;
  occurrence_date: string | null;
  needs_selection: boolean;
  can_encode_visitors: boolean;
  session: SelfCheckInSessionDetails | null;
  options: SelfCheckInEventOption[];
  attendance_venues?: AttendanceVenueOption[];
  detail?: string;
  attendance_records?: unknown[];
  removed_person_ids?: number[];
}

export interface SelfCheckInVisitorMatch {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string;
  full_name: string;
  role: string;
  status?: string;
  member_id?: string;
  photo?: string | null;
  already_checked_in: boolean;
  kind?: "visitor" | "prospect";
  prospect_id?: number;
  invited_by_name?: string;
}

export interface SelfCheckInInviter {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  member_id: string;
  is_self: boolean;
}

export interface SelfCheckInVisitorWrite {
  person_id?: number;
  prospect_id?: number;
  first_name?: string;
  last_name?: string;
  gender?: "MALE" | "FEMALE";
  age_group?: SelfCheckInAgeGroup;
  phone?: string;
  email?: string;
  inviter_id?: number;
  event_id?: number;
  attendance_venue: string;
}

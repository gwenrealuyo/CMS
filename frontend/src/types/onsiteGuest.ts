import type {
  SelfCheckInAgeGroup,
  SelfCheckInEventOption,
  SelfCheckInInviter,
  SelfCheckInVisitorMatch,
} from "@/src/types/selfCheckIn";

export type OnsiteGuestAgeGroup = SelfCheckInAgeGroup;

export interface OnsiteGuestSessionDetails {
  event: SelfCheckInEventOption;
  occurrence_date: string;
  start: string;
  end: string;
  already_checked_in_ids: number[];
}

export interface OnsiteGuestSessionResponse {
  available: boolean;
  reason: string | null;
  occurrence_date: string | null;
  needs_selection: boolean;
  can_encode_visitors: boolean;
  session: OnsiteGuestSessionDetails | null;
  options: SelfCheckInEventOption[];
  detail?: string;
}

export type OnsiteGuestVisitorMatch = SelfCheckInVisitorMatch;
export type OnsiteGuestInviter = SelfCheckInInviter;

export interface OnsiteGuestVisitorWrite {
  person_id?: number;
  prospect_id?: number;
  first_name?: string;
  last_name?: string;
  gender?: "MALE" | "FEMALE";
  age_group?: OnsiteGuestAgeGroup;
  phone?: string;
  email?: string;
  inviter_id?: number | null;
  event_id?: number;
  occurrence_date?: string;
  first_time_attending?: boolean;
}

import { PersonRole, PersonStatus } from "@/src/types/person";

export interface EventOccurrence {
  event_id: string | number;
  occurrence_id: string;
  start_date: string;
  end_date: string;
  occurrence_date?: string;
  is_base_occurrence: boolean;
}

export type RecurrenceFrequency = "weekly" | "monthly";
export type MonthlyRecurrenceMode = "by_date" | "by_weekday";

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdays: number[];
  monthly_mode?: MonthlyRecurrenceMode;
  month_day?: number;
  week_of_month?: number;
  through: string;
  excluded_dates?: string[];
}

/** @deprecated Use RecurrencePattern */
export type WeeklyRecurrencePattern = RecurrencePattern;

export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";
export type AttendanceMode = "ONSITE" | "ONLINE";

export interface AttendanceVenueOption {
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_system?: boolean;
  attendance_count?: number;
}

export interface EventAttendancePerson {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  nickname?: string;
  role: PersonRole;
  status: PersonStatus;
  member_id?: string;
  phone?: string;
  full_name: string;
  cluster_codes?: string[];
  family_names?: string[];
}

export interface EventAttendanceRecord {
  id: number;
  occurrence_date: string;
  status: AttendanceStatus;
  attendance_mode?: AttendanceMode;
  attendance_venue?: string | null;
  attendance_venue_label?: string | null;
  attendance_venue_color?: string | null;
  notes?: string;
  journey_id?: number | null;
  recorded_at: string;
  updated_at: string;
  person: EventAttendancePerson;
}

export interface EventTypeOption {
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_system?: boolean;
  counts_as_activity?: boolean;
  event_count?: number;
}

export interface EventRoom {
  id: number;
  branch: number;
  branch_name?: string | null;
  name: string;
  capacity?: number | null;
  notes?: string;
  is_active: boolean;
  sort_order: number;
  event_count?: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type: string;
  type_display: string;
  location: string;
  room?: number | null;
  room_name?: string | null;
  branch?: number | null;
  branch_name?: string | null;
  branch_is_headquarters?: boolean | null;
  is_recurring: boolean;
  booking_status?: "pending" | "approved" | "rejected";
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string;
  expected_include_active?: boolean;
  expected_include_semiactive?: boolean;
  expected_include_inactive?: boolean;
  expected_include_ongoing_visitors?: boolean;
  tardy_grace_minutes?: number;
  recurrence_pattern?: RecurrencePattern | null;
  occurrences?: EventOccurrence[];
  next_occurrence?: EventOccurrence | null;
  attendee_badges?: Array<{
    id: string;
    full_name: string;
    cluster_code?: string | null;
    family_name?: string | null;
  }>;
  attendance_count?: number;
  attendance_records?: EventAttendanceRecord[];
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_by?: number | null;
  updated_by_name?: string | null;
  updated_at?: string;
}

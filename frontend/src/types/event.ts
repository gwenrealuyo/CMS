import { PersonRole, PersonStatus } from "@/src/types/person";

export interface EventOccurrence {
  event_id: string | number;
  occurrence_id: string;
  start_date: string;
  end_date: string;
  is_base_occurrence: boolean;
}

export interface WeeklyRecurrencePattern {
  frequency: "weekly";
  weekdays: number[];
  through: string;
  excluded_dates?: string[];
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";

export interface EventAttendancePerson {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  role: PersonRole;
  status: PersonStatus;
  phone?: string;
  full_name: string;
  cluster_codes?: string[];
  family_names?: string[];
}

export interface EventAttendanceRecord {
  id: number;
  occurrence_date: string;
  status: AttendanceStatus;
  notes?: string;
  journey_id?: number | null;
  recorded_at: string;
  updated_at: string;
  person: EventAttendancePerson;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  type:
    | "SUNDAY_SERVICE"
    | "BIBLE_STUDY"
    | "PRAYER_MEETING"
    | "CLUSTER_BS_EVANGELISM"
    | "CLUSTERING"
    | "DOCTRINAL_CLASS"
    | "CYM_CLASS"
    | "MINI_WORSHIP"
    | "GOLDEN_WARRIORS"
    | "CAMPING"
    | "AWTA"
    | "CONFERENCE"
    | "OTHER";
  type_display: string;
  location: string;
  is_recurring: boolean;
  recurrence_pattern?: WeeklyRecurrencePattern | null;
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
  created_at: string;
}

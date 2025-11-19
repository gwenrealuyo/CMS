export type ClassMemberRole = "TEACHER" | "ASSISTANT_TEACHER" | "STUDENT";

export interface SundaySchoolCategory {
  id: number;
  name: string;
  description?: string;
  min_age?: number;
  max_age?: number;
  age_range_display?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SundaySchoolClass {
  id: number;
  name: string;
  category: SundaySchoolCategory;
  category_id?: number;
  description?: string;
  yearly_theme?: string;
  room_location?: string;
  meeting_time?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: SundaySchoolClassMember[];
  members_count?: number;
  students_count?: number;
  teachers_count?: number;
}

export interface SundaySchoolClassMember {
  id: number;
  sunday_school_class?: number;
  person: {
    id: number;
    username: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    suffix?: string;
    nickname?: string;
    full_name: string;
    date_of_birth?: string;
    status?: string;
  };
  person_id?: number;
  role: ClassMemberRole;
  role_display?: string;
  enrolled_date: string;
  is_active: boolean;
  notes?: string;
}

export interface SundaySchoolSession {
  id: number;
  sunday_school_class?: SundaySchoolClass | number; // Can be object or ID
  sunday_school_class_id?: number;
  sunday_school_class_name?: string; // Added for display purposes
  event?: number;
  event_id?: number;
  session_date: string;
  session_time?: string;
  lesson_title?: string;
  notes?: string;
  is_recurring_instance?: boolean;
  recurring_group_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UnenrolledPerson {
  id: number;
  full_name: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  age: number;
  date_of_birth?: string;
  status?: string;
  cluster_info?: string;
  family_names?: string;
}

export interface UnenrolledByCategory {
  category_id: number;
  category_name: string;
  age_range: string;
  unenrolled_count: number;
  unenrolled_people: UnenrolledPerson[];
}

export interface SundaySchoolSummary {
  total_classes: number;
  active_classes: number;
  inactive_classes: number;
  total_students: number;
  total_teachers: number;
  average_attendance_rate?: number;
  most_attended_classes?: Array<{
    class_id: number;
    class_name: string;
    attendance_rate: number;
  }>;
  least_attended_classes?: Array<{
    class_id: number;
    class_name: string;
    attendance_rate: number;
  }>;
}

export interface AttendanceReport {
  session_id: number;
  session_date: string;
  lesson_title?: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  attendance_rate: number;
}

export interface RecurringSessionData {
  sunday_school_class_id: number;
  start_date: string;
  end_date?: string;
  num_occurrences?: number;
  recurrence_pattern: "weekly" | "bi_weekly" | "monthly";
  day_of_week?: number;
  default_lesson_title?: string;
}

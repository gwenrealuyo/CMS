import { JourneyType } from "@/src/types/person";

export interface LessonJourneyConfig {
  journey_type: JourneyType;
  title_template: string;
  note_template: string;
}

export interface Lesson {
  id: number;
  code: string;
  version_label: string;
  title: string;
  summary: string;
  outline: string;
  order: number;
  is_latest: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  journey_config?: LessonJourneyConfig | null;
}

export type LessonProgressStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";

export interface LessonPersonSummary {
  id: number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
  member_id?: string;
  status?: string | null;
  cluster_codes?: string[] | null;
}

export interface PersonLessonProgress {
  id: number;
  person: LessonPersonSummary | null;
  lesson: Lesson;
  status: LessonProgressStatus;
  assigned_at: string;
  assigned_by: number | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: number | null;
  journey: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LessonCommitmentSettings {
  id: number;
  commitment_form: string | null;
  commitment_form_url: string | null;
  uploaded_by: number | null;
  updated_at: string;
}

export interface LessonProgressSummaryByLesson {
  lesson_id: number;
  lesson_title: string;
  version_label: string;
  is_latest: boolean;
  order: number;
  total: number;
  completed: number;
  in_progress: number;
  assigned: number;
  skipped: number;
}

export interface LessonProgressSummary {
  overall: Record<LessonProgressStatus, number>;
  total_participants: number;
  year?: number;
  overall_records?: Record<LessonProgressStatus, number>;
  total_records?: number;
  lessons: LessonProgressSummaryByLesson[];
  unassigned_visitors?: number;
}

export type LessonSessionType = "LESSON" | "PRE_LESSON";

export type PreLessonKind = "INTRODUCTION" | "OTHER";

export interface LessonSessionReport {
  id: number;
  teacher: LessonPersonSummary | null;
  student: LessonPersonSummary | null;
  session_type: LessonSessionType;
  pre_lesson_kind: PreLessonKind | null;
  lesson: Lesson | null;
  progress: number | null;
  session_date: string;
  session_start: string;
  score: string;
  next_session_date: string | null;
  remarks: string;
  submitted_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface LessonSessionReportInput {
  teacher_id?: number | string | null;
  student_id: number | string;
  session_type: LessonSessionType;
  pre_lesson_kind?: PreLessonKind | null;
  lesson_id?: number | string | null;
  progress_id?: number | string | null;
  session_date: string;
  session_start: string;
  score?: string;
  next_session_date?: string | null;
  remarks?: string;
}

export interface PersonProgressSummary {
  person: LessonPersonSummary;
  previousLesson: Lesson | null;
  completedCount: number;
  totalLessons: number;
  nextLesson: Lesson | null;
  progressPercentage: number;
  allProgress: PersonLessonProgress[];
}

export interface LessonStudentEnrollment {
  id: number;
  student: LessonPersonSummary;
  teacher: LessonPersonSummary;
  commitment_signed: boolean;
  commitment_signed_at: string | null;
  commitment_signed_by: number | null;
  is_active: boolean;
  assigned_at: string;
  updated_at: string;
}

export interface LessonTeacherTransfer {
  id: number;
  from_teacher: LessonPersonSummary | null;
  to_teacher: LessonPersonSummary;
  transferred_by: LessonPersonSummary | null;
  note: string;
  created_at: string;
}

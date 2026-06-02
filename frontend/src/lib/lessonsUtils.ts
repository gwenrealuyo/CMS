import {
  Lesson,
  LessonPersonSummary,
  LessonStudentEnrollment,
  PersonLessonProgress,
  PersonProgressSummary,
} from "@/src/types/lesson";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";

export type LessonPersonLike = {
  id?: string | number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username: string;
  role?: string | null;
};

/** Matches lesson session / enrollment teacher pickers (excludes VISITOR and ADMIN). */
export function isLessonTeacherCandidate(
  person: Pick<LessonPersonLike, "role" | "username">,
): boolean {
  const role = (person.role || "").toUpperCase();
  return role !== "VISITOR" && isSelectablePerson(person);
}

export type SessionFilterValues = {
  teacherId: string;
  studentId: string;
  lessonId: string;
  month: string;
  year: string;
};

export function getDefaultSessionMonthYear(): { month: string; year: string } {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

export const createDefaultSessionFilters = (): SessionFilterValues => {
  const { month, year } = getDefaultSessionMonthYear();
  return {
    teacherId: "",
    studentId: "",
    lessonId: "",
    month,
    year,
  };
};

/** @deprecated Use createDefaultSessionFilters */
export const createEmptySessionFilters = createDefaultSessionFilters;

export function hasNonDefaultSessionDateFilters(
  filters: SessionFilterValues
): boolean {
  const { month: defaultMonth, year: defaultYear } = getDefaultSessionMonthYear();
  if (!filters.month || !filters.year) {
    return true;
  }
  return filters.month !== defaultMonth || filters.year !== defaultYear;
}

export function sanitizeNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export function escapeCsvValue(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  const needsEscaping = /[",\n]/.test(stringValue);
  const sanitized = stringValue.replace(/"/g, '""');
  return needsEscaping ? `"${sanitized}"` : stringValue;
}

export function extractErrorMessage(
  error: unknown,
  defaultMessage: string
): string {
  if (error && typeof error === "object") {
    if ("response" in error && error.response) {
      const response = error.response as {
        data?: { detail?: string; message?: string };
      };
      if (response.data?.detail) {
        return response.data.detail;
      }
      if (response.data?.message) {
        return response.data.message;
      }
    }
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }
  return defaultMessage;
}

export function groupProgressByPerson(
  progress: PersonLessonProgress[],
  allLessons: Lesson[]
): PersonProgressSummary[] {
  // Group progress by person
  const progressByPerson = new Map<number, PersonLessonProgress[]>();

  for (const record of progress) {
    if (!record.person) continue;
    const personId = record.person.id;
    if (!progressByPerson.has(personId)) {
      progressByPerson.set(personId, []);
    }
    progressByPerson.get(personId)!.push(record);
  }

  // Calculate summary for each person
  const summaries: PersonProgressSummary[] = [];

  progressByPerson.forEach((personProgress) => {
    const person = personProgress[0].person!;
    const summary = calculatePersonProgress(person, personProgress, allLessons);
    summaries.push(summary);
  });

  return summaries;
}

export function calculatePersonProgress(
  person: LessonPersonSummary,
  personProgress: PersonLessonProgress[],
  allLessons: Lesson[]
): PersonProgressSummary {
  // Get active latest lessons only
  const activeLatestLessons = allLessons
    .filter((lesson) => lesson.is_latest && lesson.is_active)
    .sort((a, b) => a.order - b.order);

  const totalLessons = activeLatestLessons.length;

  // Find previous lesson (highest order COMPLETED)
  const completedLessonsByOrder = personProgress
    .filter((p) => p.status === "COMPLETED")
    .map((p) => p.lesson)
    .sort((a, b) => b.order - a.order);
  const previousLesson =
    completedLessonsByOrder.length > 0 ? completedLessonsByOrder[0] : null;

  // Count completed lessons
  const completedCount = personProgress.filter(
    (p) => p.status === "COMPLETED"
  ).length;

  // Find next lesson (first lesson in order that's not completed)
  const completedLessonIds = new Set(
    personProgress
      .filter((p) => p.status === "COMPLETED")
      .map((p) => p.lesson.id)
  );

  const nextLesson =
    activeLatestLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ||
    null;

  // Calculate progress percentage
  const progressPercentage =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return {
    person,
    previousLesson,
    completedCount,
    totalLessons,
    nextLesson,
    progressPercentage,
    allProgress: personProgress,
  };
}

export function buildStudentTeacherMapFromEnrollments(
  enrollments: LessonStudentEnrollment[],
): Map<number, LessonPersonSummary> {
  const map = new Map<number, LessonPersonSummary>();
  for (const enrollment of enrollments) {
    if (enrollment.is_active && enrollment.student?.id && enrollment.teacher) {
      map.set(enrollment.student.id, enrollment.teacher);
    }
  }
  return map;
}

export function enrollmentByStudentId(
  enrollments: LessonStudentEnrollment[],
): Map<number, LessonStudentEnrollment> {
  const map = new Map<number, LessonStudentEnrollment>();
  for (const enrollment of enrollments) {
    if (enrollment.student?.id) {
      map.set(enrollment.student.id, enrollment);
    }
  }
  return map;
}

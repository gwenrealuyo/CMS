import { User } from "@/src/lib/api";
import { ModuleCoordinator } from "@/src/types/person";
import { ModuleType } from "@/src/types/moduleSettings";

const LESSONS_WRITE_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
  "TEACHER",
  "BIBLE_SHARER",
];

const LESSONS_CATALOG_LEVELS: ModuleCoordinator["level"][] = [
  "COORDINATOR",
  "SENIOR_COORDINATOR",
];

function lessonsAssignments(user: User | null): ModuleCoordinator[] {
  return (
    user?.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "LESSONS",
    ) ?? []
  );
}

/** Admin, pastor, and Lessons coordinators can browse every student/teacher. */
export function canBrowseAllLessonStudents(user: User | null): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  return lessonsAssignments(user).some((assignment) =>
    LESSONS_CATALOG_LEVELS.includes(assignment.level),
  );
}

/**
 * Lessons TEACHER without coordinator/admin/pastor access.
 * Session Reports is limited to this user's students and defaults the teacher filter to them.
 */
export function isLessonsTeacherScoped(user: User | null): boolean {
  if (!user || canBrowseAllLessonStudents(user)) return false;
  return lessonsAssignments(user).some(
    (assignment) => assignment.level === "TEACHER",
  );
}

export type CanWriteLessonsContext = {
  user: User | null;
  moduleEnabled?: Partial<Record<ModuleType, boolean>>;
};

/** Matches backend HasModuleAccess("LESSONS", "write") for create/update actions. */
export function canWriteLessons({
  user,
  moduleEnabled,
}: CanWriteLessonsContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.LESSONS === false) return false;

  if (user.role === "PASTOR") return true;

  return lessonsAssignments(user).some((assignment) =>
    LESSONS_WRITE_LEVELS.includes(assignment.level),
  );
}

/**
 * Matches backend CanManageLessonCatalog: Admin (any branch), or HQ Pastor /
 * Lessons Coordinator / Senior Coordinator. Teachers and non-HQ are excluded.
 */
export function canManageLessonCatalog({
  user,
  moduleEnabled,
}: CanWriteLessonsContext): boolean {
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  if (moduleEnabled?.LESSONS === false) return false;

  if (!user.branch_is_headquarters) return false;

  if (user.role === "PASTOR") return true;

  return lessonsAssignments(user).some((assignment) =>
    LESSONS_CATALOG_LEVELS.includes(assignment.level),
  );
}

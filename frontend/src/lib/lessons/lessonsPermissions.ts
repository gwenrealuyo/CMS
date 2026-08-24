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

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "LESSONS",
    ) ?? [];

  return assignments.some((assignment) =>
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

  const assignments =
    user.module_coordinator_assignments?.filter(
      (assignment) => assignment.module === "LESSONS",
    ) ?? [];

  return assignments.some((assignment) =>
    LESSONS_CATALOG_LEVELS.includes(assignment.level),
  );
}

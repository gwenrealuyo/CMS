import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";

export function canChangeLessonsBranchFilter(
  user: User | null | undefined,
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  return isSeniorCoordinator("LESSONS");
}

/** Shown on disabled branch controls for scoped users */
export const LESSONS_BRANCH_LOCKED_HINT =
  "Branch is limited to your assignment. Admins, pastors, and senior lessons coordinators can switch branches.";

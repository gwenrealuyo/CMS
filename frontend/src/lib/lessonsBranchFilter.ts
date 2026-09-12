import type { User } from "@/src/lib/api";
import { hasLessonsSeniorAccess } from "@/src/lib/lessons/lessonsPermissions";

export function canChangeLessonsBranchFilter(
  user: User | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  if (!hasLessonsSeniorAccess(user)) return false;
  return Boolean(
    user.branch_is_headquarters || user.ncc_primary_at_headquarters,
  );
}

/** Shown on disabled branch controls for scoped users */
export const LESSONS_BRANCH_LOCKED_HINT =
  "Branch is limited to your assignment.";

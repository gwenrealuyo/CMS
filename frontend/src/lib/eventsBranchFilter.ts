import type { User } from "@/src/lib/api";

/** Matches backend `can_see_all_branches` (ADMIN, HQ PASTOR). */
export function canChangeEventsBranchFilter(
  user: User | null | undefined,
): boolean {
  return Boolean(user?.can_see_all_branches);
}

/** Shown on disabled branch controls for scoped users */
export const EVENTS_BRANCH_LOCKED_HINT =
  "Branch is limited to your assignment.";

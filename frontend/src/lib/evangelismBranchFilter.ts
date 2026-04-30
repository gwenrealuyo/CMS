import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";

export function canChangeEvangelismBranchFilter(
  user: User | null | undefined,
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  return isSeniorCoordinator("EVANGELISM");
}

/** Shown on disabled branch controls for scoped users */
export const EVANGELISM_BRANCH_LOCKED_HINT =
  "Branch is limited to your assignment. Admins, pastors, and senior evangelism coordinators can switch branches.";

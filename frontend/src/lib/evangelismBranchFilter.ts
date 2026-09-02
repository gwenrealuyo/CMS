import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";
import { isAdminPerson } from "@/src/lib/peopleSelectors";

/** Default branch filter for lists when the user has an assigned branch. */
export function defaultEvangelismListBranch(
  user: User | null | undefined,
): number | "all" {
  if (user?.branch != null && user.branch !== undefined) {
    return user.branch;
  }
  return "all";
}

export function canChangeEvangelismBranchFilter(
  user: User | null | undefined,
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  return isSeniorCoordinator("EVANGELISM");
}

export function defaultProspectsListBranch(
  user: User | null | undefined,
): number | "all" {
  if (user?.branch != null && user.branch !== undefined) {
    return user.branch;
  }
  if (user && (isAdminPerson(user) || user.can_see_all_branches)) {
    return "all";
  }
  return defaultEvangelismListBranch(user);
}

export function canChangeProspectsBranchFilter(
  user: User | null | undefined,
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean,
): boolean {
  if (!user) return false;
  if (isAdminPerson(user) || user.role === "PASTOR") return true;
  return (
    isSeniorCoordinator("EVANGELISM") || isSeniorCoordinator("CLUSTER")
  );
}

/** Shown on disabled branch controls for scoped users */
export const EVANGELISM_BRANCH_LOCKED_HINT =
  "Branch is limited to your assignment. Admins, pastors, and senior evangelism coordinators can switch branches.";

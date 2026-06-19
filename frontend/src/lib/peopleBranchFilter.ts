import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";

export function canChangePeopleBranchFilter(
  user: User | null | undefined,
  isSeniorCoordinator: (module?: ModuleCoordinator["module"]) => boolean,
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  return isSeniorCoordinator("CLUSTER");
}

/** Shown on locked branch controls for branch-scoped users */
export const PEOPLE_BRANCH_LOCKED_HINT =
  "The directory only shows people in your branch. People in other branches are not visible here.";

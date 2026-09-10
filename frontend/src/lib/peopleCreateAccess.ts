import type { User } from "@/src/lib/api";
import type { ModuleCoordinator } from "@/src/types/person";

export type PeopleCreateAccess = "none" | "visitor" | "person";

const EVANGELISM_VISITOR_LEVELS: ModuleCoordinator["level"][] = [
  "SENIOR_COORDINATOR",
  "COORDINATOR",
  "BIBLE_SHARER",
];

function assignmentsOf(user: User | null | undefined): ModuleCoordinator[] {
  return user?.module_coordinator_assignments ?? [];
}

/** Admin, Pastor, Cluster Senior Coordinator, or Cluster Coordinator assignment. */
export function userCanAddPerson(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "PASTOR") return true;
  // Same Cluster checks as clusterPermissions: isSeniorCoordinator("CLUSTER")
  // or isModuleCoordinator("CLUSTER", "COORDINATOR"). Cluster.coordinator FK
  // rows are synced to ModuleCoordinator assignments.
  return assignmentsOf(user).some(
    (a) =>
      a.module === "CLUSTER" &&
      (a.level === "SENIOR_COORDINATOR" || a.level === "COORDINATOR"),
  );
}

/**
 * Cluster+ (Add Person) plus Evangelism Senior/Coordinator/Bible Sharer.
 * Teachers, plain members, and reporters cannot add visitors.
 */
export function userCanAddVisitor(user: User | null | undefined): boolean {
  if (userCanAddPerson(user)) return true;
  if (!user) return false;
  return assignmentsOf(user).some(
    (a) =>
      a.module === "EVANGELISM" && EVANGELISM_VISITOR_LEVELS.includes(a.level),
  );
}

export function getPeopleCreateAccess(
  user: User | null | undefined,
): PeopleCreateAccess {
  if (userCanAddPerson(user)) return "person";
  if (userCanAddVisitor(user)) return "visitor";
  return "none";
}

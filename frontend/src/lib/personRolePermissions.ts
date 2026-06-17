import type { User } from "@/src/lib/api";

export type PersonRole = "MEMBER" | "VISITOR" | "PASTOR" | "ADMIN";

function userHasPeopleWriteCoordinatorAssignment(user: User): boolean {
  const assignments = user.module_coordinator_assignments ?? [];
  if (assignments.length === 0) return false;
  return assignments.some((a) => a.level !== "REPORTER");
}

export function getCreatableRoles(
  user: User | null,
  isPlainMember: boolean,
): PersonRole[] {
  if (!user) return ["VISITOR"];
  if (isPlainMember) return ["VISITOR"];
  if (user.role === "ADMIN") return ["MEMBER", "VISITOR", "PASTOR", "ADMIN"];
  if (user.role === "PASTOR") return ["MEMBER", "VISITOR", "PASTOR"];
  if (userHasPeopleWriteCoordinatorAssignment(user)) {
    return ["MEMBER", "VISITOR"];
  }
  return ["MEMBER", "VISITOR", "PASTOR"];
}

export function isReporterOnlyUser(user: User | null): boolean {
  const assignments = user?.module_coordinator_assignments ?? [];
  if (assignments.length === 0) return false;
  return assignments.every((a) => a.level === "REPORTER");
}

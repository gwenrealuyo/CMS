import type { User } from "@/src/lib/api";
import {
  userCanAddPerson,
  userCanAddVisitor,
} from "@/src/lib/peopleCreateAccess";

export type PersonRole = "MEMBER" | "VISITOR" | "PASTOR" | "ADMIN";

export function getCreatableRoles(
  user: User | null,
  options?: { forEdit?: boolean; hasWaterBaptism?: boolean },
): PersonRole[] {
  if (!user) return [];
  let roles: PersonRole[];
  if (user.role === "ADMIN") {
    roles = ["MEMBER", "VISITOR", "PASTOR", "ADMIN"];
  } else if (user.role === "PASTOR") {
    roles = ["MEMBER", "VISITOR"];
  } else if (options?.forEdit) {
    roles = ["MEMBER", "VISITOR"];
  } else if (userCanAddPerson(user)) {
    roles = ["MEMBER", "VISITOR"];
  } else if (userCanAddVisitor(user)) {
    roles = ["VISITOR"];
  } else {
    return [];
  }

  if (options?.hasWaterBaptism) {
    roles = roles.filter((role) => role !== "VISITOR");
    if (!roles.includes("MEMBER")) {
      roles = ["MEMBER", ...roles];
    }
  } else {
    // MEMBER requires water baptism date.
    roles = roles.filter((role) => role !== "MEMBER");
  }
  return roles;
}

export function isReporterOnlyUser(user: User | null): boolean {
  const assignments = user?.module_coordinator_assignments ?? [];
  if (assignments.length === 0) return false;
  return assignments.every((a) => a.level === "REPORTER");
}

import type { User } from "@/src/lib/api";
import {
  userCanAddPerson,
  userCanAddVisitor,
} from "@/src/lib/peopleCreateAccess";

export type PersonRole = "MEMBER" | "VISITOR" | "PASTOR" | "ADMIN";

export function getCreatableRoles(
  user: User | null,
  options?: { forEdit?: boolean },
): PersonRole[] {
  if (!user) return [];
  if (user.role === "ADMIN") return ["MEMBER", "VISITOR", "PASTOR", "ADMIN"];
  if (user.role === "PASTOR") return ["MEMBER", "VISITOR", "PASTOR"];
  if (options?.forEdit) {
    return ["MEMBER", "VISITOR"];
  }
  if (userCanAddPerson(user)) return ["MEMBER", "VISITOR"];
  if (userCanAddVisitor(user)) return ["VISITOR"];
  return [];
}

export function isReporterOnlyUser(user: User | null): boolean {
  const assignments = user?.module_coordinator_assignments ?? [];
  if (assignments.length === 0) return false;
  return assignments.every((a) => a.level === "REPORTER");
}

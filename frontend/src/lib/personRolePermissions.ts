import type { User } from "@/src/lib/api";

export type PersonRole = "MEMBER" | "VISITOR" | "PASTOR" | "ADMIN";

export function getCreatableRoles(
  user: User | null,
  isPlainMember: boolean,
): PersonRole[] {
  if (!user) return ["VISITOR"];
  if (isPlainMember) return ["VISITOR"];
  if (user.role === "ADMIN") return ["MEMBER", "VISITOR", "PASTOR", "ADMIN"];
  if (user.role === "PASTOR") return ["MEMBER", "VISITOR", "PASTOR"];
  if (user.module_coordinator_assignments?.length) {
    return ["MEMBER", "VISITOR"];
  }
  return ["MEMBER", "VISITOR", "PASTOR"];
}

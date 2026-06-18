import type { User } from "@/src/lib/api";

/** Hard DELETE is reserved for ADMIN users; everyone else uses status/is_active changes. */
export function canHardDelete(user: User | null | undefined): boolean {
  return user?.role === "ADMIN";
}

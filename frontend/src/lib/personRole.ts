import { PersonRole } from "@/src/lib/personRolePermissions";

function normalizePersonRole(
  role: PersonRole | string | null | undefined,
): string {
  return (role ?? "").trim().toUpperCase();
}

export function getPersonRoleColor(
  role: PersonRole | string | null | undefined,
): string {
  switch (normalizePersonRole(role)) {
    case "PASTOR":
      return "bg-purple-100 text-purple-800";
    case "MEMBER":
      return "bg-blue-100 text-blue-800";
    case "VISITOR":
      return "bg-gray-300 text-gray-800";
    case "ADMIN":
      return "bg-red-100 text-red-800";
    case "LEADER":
      return "bg-purple-100 text-purple-800";
    case "":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

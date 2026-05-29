import { PersonStatus } from "@/src/types/person";

export function getPersonStatusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "SEMIACTIVE":
      return "bg-yellow-100 text-yellow-800";
    case "INVITED":
      return "bg-yellow-100 text-yellow-800";
    case "ATTENDED":
      return "bg-green-100 text-green-800";
    case "INACTIVE":
      return "bg-red-100 text-red-800";
    case "DECEASED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatPersonStatusLabel(status: PersonStatus | string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

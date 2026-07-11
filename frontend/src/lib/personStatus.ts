import { PersonStatus } from "@/src/types/person";

function normalizePersonStatus(status: PersonStatus | string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

export function getPersonStatusColor(
  status: PersonStatus | string | null | undefined,
): string {
  switch (normalizePersonStatus(status)) {
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
    case "DORMANT":
      return "bg-orange-100 text-orange-800";
    case "FALLAWAY":
      return "bg-violet-100 text-violet-800";
    case "DECEASED":
      return "bg-gray-100 text-gray-800";
    case "":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function formatPersonStatusLabel(
  status: PersonStatus | string | null | undefined,
): string {
  const normalized = normalizePersonStatus(status);
  if (!normalized) {
    return "Not set";
  }
  if (normalized === "FALLAWAY") {
    return "Fall Away";
  }
  if (normalized === "SEMIACTIVE") {
    return "Semi-active";
  }
  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPersonClusterChipClass(hasCluster: boolean): string {
  return hasCluster
    ? "inline-flex items-center rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800"
    : "inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700";
}

export function formatPersonClusterLabel(clusterCodes?: string[] | null): string {
  const codes = (clusterCodes ?? []).filter(Boolean);
  if (codes.length === 0) {
    return "No cluster";
  }
  return codes.join(", ");
}

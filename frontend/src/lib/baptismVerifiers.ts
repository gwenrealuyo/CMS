import { JourneyType, Person } from "@/src/types/person";
import type { SearchableOption } from "@/src/components/ui/SearchableSelect";

export const BAPTIZED_BY_LABEL = "Baptized by";
export const HG_WITNESSED_BY_LABEL = "Witnessed by";
export const BAPTIZED_BY_HINT = "The person who baptized this member.";
export const HG_WITNESSED_BY_HINT =
  "The person who witnessed when they received the Holy Ghost.";
export const NOT_SURE_OPTION_LABEL = "Not sure";
export const FORMER_NOT_IN_SYSTEM_LABEL = "Former / not in system";

export type VerifierEntryMode = "select" | "historical";

export function isVerifierRequiredJourneyType(
  type: JourneyType | string,
): boolean {
  return type === "BAPTISM" || type === "SPIRIT";
}

export function journeyVerifierLabel(type: JourneyType | string): string {
  if (type === "BAPTISM") return BAPTIZED_BY_LABEL;
  if (type === "SPIRIT") return HG_WITNESSED_BY_LABEL;
  return "Verified By";
}

export function journeyVerifierHint(type: JourneyType | string): string | null {
  if (type === "BAPTISM") return BAPTIZED_BY_HINT;
  if (type === "SPIRIT") return HG_WITNESSED_BY_HINT;
  return null;
}

export function verifierPeopleOptions(people: Person[]): SearchableOption[] {
  return people
    .filter(
      (p) =>
        p.role !== "ADMIN" &&
        p.role !== "VISITOR" &&
        p.username !== "admin",
    )
    .map((p) => ({
      ...p,
      id: p.id,
      username: p.username || p.email || String(p.id),
    }));
}

export function personIdString(
  value: string | number | { id?: string | number } | null | undefined,
): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    return value.id != null ? String(value.id) : "";
  }
  return String(value);
}

export function initialVerifierMode(
  personId?: string | number | { id?: string | number } | null,
  firstName?: string | null,
  lastName?: string | null,
): VerifierEntryMode {
  if (personIdString(personId)) return "select";
  if ((firstName || "").trim() && (lastName || "").trim()) return "historical";
  return "select";
}

export function historicalNamesComplete(
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  return Boolean((firstName || "").trim() && (lastName || "").trim());
}

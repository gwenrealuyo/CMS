import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";

type PersonSelectionLike = {
  role?: string | null;
  username?: string | null;
};

type PersonChipLike = {
  role?: string | null;
  status?: string | null;
  cluster_codes?: string[] | null;
  branch?: number | null;
};

const normalize = (value?: string | null): string =>
  (value || "").trim().toUpperCase();

export const isAdminPerson = (person: PersonSelectionLike): boolean =>
  normalize(person.role) === "ADMIN" || normalize(person.username) === "ADMIN";

export const isSelectablePerson = (person: PersonSelectionLike): boolean =>
  !isAdminPerson(person);

function formatRoleChipLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Colored ScalableSelect chips: role (not Visitor), status, cluster code. */
export function personDropdownChips(person: PersonChipLike) {
  const role = normalize(person.role);
  const showRole = Boolean(role) && role !== "VISITOR";
  const codes = (person.cluster_codes ?? []).filter(Boolean);
  return {
    roleLabel: showRole ? formatRoleChipLabel(role) : null,
    roleClassName: showRole ? getPersonRoleColor(role) : null,
    statusLabel: formatPersonStatusLabel(person.status),
    statusClassName: getPersonStatusColor(person.status),
    clusterCode: codes.length > 0 ? codes.join(", ") : "NO CLUSTER",
    clusterBranchId: person.branch ?? null,
  };
}

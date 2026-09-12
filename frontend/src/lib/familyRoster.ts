import {
  Family,
  FamilyMemberPreview,
  Person,
  PersonUI,
} from "@/src/types/person";

/** Roles included in family ``member_count`` (converts are stored as MEMBER). */
const FAMILY_MEMBER_ROLES = new Set(["MEMBER", "PASTOR"]);

export function isCountedFamilyMemberRole(
  role?: string | null
): boolean {
  return FAMILY_MEMBER_ROLES.has(role || "");
}

export function getFamilyMemberCount(family: Family): number {
  if (typeof family.member_count === "number") return family.member_count;
  const preview = family.members_details ?? family.member_preview ?? [];
  if (preview.length) {
    return preview.filter((m) => isCountedFamilyMemberRole(m.role)).length;
  }
  return family.members?.length ?? 0;
}

export function getFamilyVisitorCount(family: Family): number {
  if (typeof family.visitor_count === "number") return family.visitor_count;
  const preview = family.members_details ?? family.member_preview ?? [];
  if (preview.length) {
    return preview.filter((m) => m.role === "VISITOR").length;
  }
  return 0;
}

function slimToPersonUI(m: FamilyMemberPreview): PersonUI {
  return {
    id: String(m.id),
    username: "",
    email: "",
    first_name: m.first_name || "",
    last_name: m.last_name || "",
    role: (m.role || "MEMBER") as Person["role"],
    status: "ACTIVE",
    photo: m.photo ?? undefined,
    name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
  } as PersonUI;
}

/**
 * Resolve family roster for detail panels: prefer people catalog hits,
 * fall back to retrieve `members_details` / list `member_preview`.
 */
export function resolveFamilyMembers(
  family: Family,
  peopleUI: PersonUI[]
): PersonUI[] {
  const memberIds = (family.members ?? []).map((id) => String(id));
  const byId = new Map(peopleUI.map((p) => [String(p.id), p]));

  const fromCatalog: PersonUI[] = [];
  const missingIds: string[] = [];
  for (const id of memberIds) {
    const hit = byId.get(id);
    if (hit) {
      fromCatalog.push(hit);
    } else {
      missingIds.push(id);
    }
  }

  const slimSource: FamilyMemberPreview[] =
    family.members_details ?? family.member_preview ?? [];
  const slimById = new Map(
    slimSource.map((m) => [String(m.id), m] as const)
  );

  const fromSlim = missingIds
    .map((id) => slimById.get(id))
    .filter((m): m is FamilyMemberPreview => !!m)
    .map(slimToPersonUI);

  // List-only row: no member IDs but preview/details present.
  if (memberIds.length === 0 && slimSource.length > 0) {
    return slimSource.map(slimToPersonUI);
  }

  return [...fromCatalog, ...fromSlim];
}

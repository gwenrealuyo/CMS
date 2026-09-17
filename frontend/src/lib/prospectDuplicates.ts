import type { Prospect } from "@/src/types/evangelism";
import { formatPersonName } from "@/src/lib/name";

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function findPossibleProspectNameDuplicates(
  prospects: Prospect[],
  opts: {
    firstName?: string | null;
    lastName?: string | null;
    evangelismGroupId?: string | null;
    excludeId?: string | number | null;
  }
): Prospect[] {
  const first = normalizeText(opts.firstName);
  const last = normalizeText(opts.lastName);
  if (!first || !last) return [];

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;
  const groupId =
    opts.evangelismGroupId != null && opts.evangelismGroupId !== ""
      ? String(opts.evangelismGroupId)
      : null;

  const matches = prospects.filter((prospect) => {
    if (excludeId && String(prospect.id) === excludeId) return false;
    if (prospect.is_dropped_off) return false;
    return (
      normalizeText(prospect.first_name) === first &&
      normalizeText(prospect.last_name) === last
    );
  });

  if (!groupId) return matches;

  return [...matches].sort((a, b) => {
    const aGroup = String(a.evangelism_group?.id ?? a.evangelism_group_id ?? "");
    const bGroup = String(b.evangelism_group?.id ?? b.evangelism_group_id ?? "");
    const aSame = aGroup === groupId ? 0 : 1;
    const bSame = bGroup === groupId ? 0 : 1;
    return aSame - bSame;
  });
}

export function describeDuplicateProspect(prospect: Prospect): string {
  const name =
    prospect.display_name?.trim() ||
    `${prospect.first_name ?? ""} ${prospect.last_name ?? ""}`.trim() ||
    `Prospect #${prospect.id}`;
  const bits = [name];
  const stage =
    prospect.pipeline_stage_display || prospect.pipeline_stage || "";
  if (stage) bits.push(stage);
  const groupName = prospect.evangelism_group?.name?.trim();
  if (groupName) bits.push(groupName);
  return bits.join(" · ");
}

function personDisplayName(person: {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  nickname?: string | null;
  suffix?: string | null;
  username?: string | null;
  display_name?: string | null;
}): string {
  return (
    person.display_name?.trim() ||
    formatPersonName(person) ||
    ""
  );
}

export function findEncodedVisitorNameMatches(
  visitors: Array<{
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  }>,
  prospects: Prospect[],
  opts: {
    firstName?: string | null;
    lastName?: string | null;
  }
): string[] {
  const first = normalizeText(opts.firstName);
  const last = normalizeText(opts.lastName);
  if (!first || !last) return [];

  const names: string[] = [];
  const seen = new Set<string>();

  const pushName = (label: string) => {
    const key = normalizeText(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(label);
  };

  for (const visitor of visitors) {
    if (
      normalizeText(visitor.first_name) === first &&
      normalizeText(visitor.last_name) === last
    ) {
      pushName(personDisplayName(visitor) || `${opts.firstName} ${opts.lastName}`.trim());
    }
  }

  for (const prospect of prospects) {
    if (prospect.is_dropped_off) continue;
    if (!prospect.person) continue;
    if (
      normalizeText(prospect.first_name) === first &&
      normalizeText(prospect.last_name) === last
    ) {
      pushName(
        personDisplayName(prospect.person) ||
          personDisplayName(prospect) ||
          `${opts.firstName} ${opts.lastName}`.trim()
      );
    }
  }

  return names;
}

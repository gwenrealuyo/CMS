import { EvangelismGroup } from "@/src/types/evangelism";

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function groupBranchId(group: EvangelismGroup): number | null {
  const raw = group.branch ?? group.branch_id ?? group.cluster?.branch;
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function findPossibleEvangelismGroupNameDuplicates(
  groups: EvangelismGroup[],
  opts: {
    name?: string | null;
    branch?: number | null;
    excludeId?: number | string | null;
  },
): EvangelismGroup[] {
  const name = normalizeText(opts.name);
  if (!name) return [];

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;

  const matches = groups.filter((group) => {
    if (excludeId && String(group.id) === excludeId) return false;
    if (group.is_active === false) return false;
    return normalizeText(group.name) === name;
  });

  if (opts.branch == null) return matches;

  return [...matches].sort((a, b) => {
    const aSame = groupBranchId(a) === opts.branch ? 0 : 1;
    const bSame = groupBranchId(b) === opts.branch ? 0 : 1;
    return aSame - bSame;
  });
}

export function describeDuplicateEvangelismGroup(group: EvangelismGroup): string {
  const bits: string[] = [];
  if (group.name?.trim()) bits.push(group.name.trim());
  const code = group.cluster?.code?.trim();
  if (code) bits.push(code);
  if (group.location?.trim()) bits.push(group.location.trim());
  if (bits.length === 0) bits.push(`Group #${group.id}`);
  return bits.join(" · ");
}

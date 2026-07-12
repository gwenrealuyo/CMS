import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";

function normalizeNamePart(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function normalizeMemberId(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function findPossibleNameDuplicates(
  people: Person[],
  opts: {
    firstName?: string | null;
    lastName?: string | null;
    branch?: number | null;
    excludeId?: string | number | null;
  }
): Person[] {
  const first = normalizeNamePart(opts.firstName);
  const last = normalizeNamePart(opts.lastName);
  if (!first && !last) return [];

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;

  const matches = people.filter((person) => {
    if (excludeId && String(person.id) === excludeId) return false;
    return (
      normalizeNamePart(person.first_name) === first &&
      normalizeNamePart(person.last_name) === last
    );
  });

  if (opts.branch == null) return matches;

  // Prefer same-branch matches first for display ordering
  return [...matches].sort((a, b) => {
    const aSame = a.branch === opts.branch ? 0 : 1;
    const bSame = b.branch === opts.branch ? 0 : 1;
    return aSame - bSame;
  });
}

export function findMemberIdConflict(
  people: Person[],
  opts: {
    memberId?: string | null;
    excludeId?: string | number | null;
  }
): Person | null {
  const memberId = normalizeMemberId(opts.memberId);
  if (!memberId) return null;

  const excludeId =
    opts.excludeId != null && opts.excludeId !== ""
      ? String(opts.excludeId)
      : null;

  return (
    people.find((person) => {
      if (excludeId && String(person.id) === excludeId) return false;
      return normalizeMemberId(person.member_id) === memberId;
    }) ?? null
  );
}

export function describeDuplicatePerson(person: Person): string {
  const name = formatPersonName(person);
  const bits = [name];
  if (person.branch_code?.trim()) bits.push(person.branch_code.trim());
  else if (person.branch_name?.trim()) bits.push(person.branch_name.trim());
  if (person.role) bits.push(person.role);
  return bits.join(" · ");
}

import { formatPersonName } from "@/src/lib/name";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { Event } from "@/src/types/event";
import { Person } from "@/src/types/person";

export function getEligibleMembers(people: Person[], event: Event): Person[] {
  const selectable = people.filter(isSelectablePerson);
  if (event.branch == null) {
    return selectable;
  }
  return selectable.filter(
    (person) => Number(person.branch) === Number(event.branch)
  );
}

export type PersonResolveResult =
  | { ok: true; person: Person }
  | { ok: false; error: string };

export function filterEligibleMembersByQuery(
  eligibleMembers: Person[],
  query: string,
  limit = 8
): Person[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const normalized = trimmed.toLowerCase();
  return eligibleMembers
    .filter((person) => {
      const name = formatPersonName(person).toLowerCase();
      const lampId = person.member_id?.toLowerCase() || "";
      return name.includes(normalized) || lampId.includes(normalized);
    })
    .slice(0, limit);
}

export function resolvePersonFromEntry(
  query: string,
  eligibleMembers: Person[]
): PersonResolveResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a name or LAMP ID." };
  }

  const normalized = trimmed.toLowerCase();

  const byMemberId = eligibleMembers.find(
    (person) => person.member_id?.toLowerCase() === normalized
  );
  if (byMemberId) {
    return { ok: true, person: byMemberId };
  }

  const byId = eligibleMembers.find((person) => String(person.id) === trimmed);
  if (byId) {
    return { ok: true, person: byId };
  }

  const nameMatches = eligibleMembers.filter((person) =>
    formatPersonName(person).toLowerCase().includes(normalized)
  );

  if (nameMatches.length === 1) {
    return { ok: true, person: nameMatches[0] };
  }

  if (nameMatches.length > 1) {
    return {
      ok: false,
      error: "Multiple matches found. Use a LAMP ID instead.",
    };
  }

  return {
    ok: false,
    error: "Person not found. Check the name or ID and try again.",
  };
}

export function getCheckedInPersonIds(
  records: Array<{ person: { id: string } }>
): Set<string> {
  return new Set(records.map((record) => String(record.person.id)));
}

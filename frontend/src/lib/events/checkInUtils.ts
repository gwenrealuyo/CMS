import { formatPersonName } from "@/src/lib/name";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import { Event } from "@/src/types/event";
import { Person } from "@/src/types/person";

function normalizeStatus(status?: string | null): string {
  return (status || "").trim().toUpperCase();
}

function normalizeRole(role?: string | null): string {
  return (role || "").trim().toUpperCase();
}

/** People who can be checked in (branch-scoped, non-admin). */
export function getEligibleMembers(people: Person[], event: Event): Person[] {
  const selectable = people.filter(isSelectablePerson);
  if (event.branch == null) {
    return selectable;
  }
  return selectable.filter(
    (person) => Number(person.branch) === Number(event.branch)
  );
}

function isOngoingVisitor(person: Person): boolean {
  return (
    normalizeRole(person.role) === "VISITOR" &&
    normalizeStatus(person.status) === "ONGOING"
  );
}

/**
 * Expected attendees for Total / Remaining.
 * Sunday Service uses status/visitor flags; other types use the full eligible pool.
 */
export function getExpectedMembers(people: Person[], event: Event): Person[] {
  const candidates = getEligibleMembers(people, event);
  if (event.type !== "SUNDAY_SERVICE") {
    return candidates;
  }

  const includeActive = event.expected_include_active ?? true;
  const includeSemiactive = event.expected_include_semiactive ?? true;
  const includeInactive = event.expected_include_inactive ?? true;
  const includeOngoingVisitors =
    event.expected_include_ongoing_visitors ?? true;

  return candidates.filter((person) => {
    if (isOngoingVisitor(person)) {
      return includeOngoingVisitors;
    }
    const status = normalizeStatus(person.status);
    if (status === "ACTIVE") return includeActive;
    if (status === "SEMIACTIVE") return includeSemiactive;
    if (status === "INACTIVE") return includeInactive;
    return false;
  });
}

export function countExpectedOngoingVisitors(
  people: Person[],
  event: Event
): number {
  if (
    event.type !== "SUNDAY_SERVICE" ||
    !(event.expected_include_ongoing_visitors ?? true)
  ) {
    return 0;
  }
  return getExpectedMembers(people, event).filter(isOngoingVisitor).length;
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

export function resolvePersonFromMemberId(
  scannedValue: string,
  eligibleMembers: Person[]
): PersonResolveResult {
  const trimmed = scannedValue.trim();
  if (!trimmed) {
    return { ok: false, error: "No LAMP ID found in this QR code." };
  }

  const normalized = trimmed.toLowerCase();
  const match = eligibleMembers.find(
    (person) => person.member_id?.toLowerCase() === normalized
  );

  if (!match) {
    return {
      ok: false,
      error: "No member found for this LAMP ID.",
    };
  }

  return { ok: true, person: match };
}

export function formatLampIdDisplay(
  memberId?: string | null
): string {
  return (memberId ?? "").trim().replace(/^lamp/i, "");
}

export function getCheckedInPersonIds(
  records: Array<{ person: { id: string } }>
): Set<string> {
  return new Set(records.map((record) => String(record.person.id)));
}

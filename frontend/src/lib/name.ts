import { Person, PersonUI } from "@/src/types/person";
import { LessonPersonSummary } from "@/src/types/lesson";

type PersonLike =
  | Partial<Person>
  | PersonUI
  | LessonPersonSummary
  | {
      id?: string | number;
      first_name?: string | null;
      middle_name?: string | null;
      last_name?: string | null;
      suffix?: string | null;
      nickname?: string | null;
      username?: string | null;
    }
  | null
  | undefined;

interface PersonNameFields {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
  nickname?: string | null;
  username?: string | null;
  id?: string | number;
}

function hasNameFields(obj: unknown): obj is PersonNameFields {
  return typeof obj === "object" && obj !== null;
}

function trimmed(value?: string | null): string {
  return (value ?? "").trim();
}

/**
 * Combined display name: nickname (or first name) + middle initial + last + suffix.
 * Falls back to username / Person #id if no name parts are available.
 */
export function formatPersonName(person: PersonLike): string {
  if (!person || !hasNameFields(person)) {
    return "Unknown person";
  }

  const nickname = trimmed(person.nickname);
  const first = trimmed(person.first_name);
  const given = nickname || first;
  const middle = trimmed(person.middle_name);
  const last = trimmed(person.last_name);
  const suffix = trimmed(person.suffix);
  const username = trimmed(person.username);

  const pieces: string[] = [];

  if (given) {
    pieces.push(given);
  }

  if (middle) {
    const middleInitial = middle.charAt(0);
    if (middleInitial) {
      pieces.push(`${middleInitial.toUpperCase()}.`);
    }
  }

  if (last) {
    pieces.push(last);
  }

  if (suffix) {
    pieces.push(suffix);
  }

  const name = pieces.join(" ").replace(/\s+/g, " ").trim();

  if (name) {
    return name;
  }

  if (username) {
    return username;
  }

  const personId = person.id;
  return personId ? `Person #${personId}` : "Unknown person";
}

/** Legal name only: first + full middle + last + suffix (no nickname). */
export function formatPersonLegalName(person: PersonLike): string {
  if (!person || !hasNameFields(person)) {
    return "";
  }
  return [person.first_name, person.middle_name, person.last_name, person.suffix]
    .map((part) => trimmed(part))
    .filter(Boolean)
    .join(" ");
}

/** Haystack for person pickers: legal first name stays searchable when nickname is shown. */
export function personNameSearchText(person: PersonLike): string {
  if (!person || !hasNameFields(person)) {
    return "";
  }
  return [
    person.first_name,
    person.nickname,
    person.middle_name,
    person.last_name,
    person.suffix,
    person.username,
  ]
    .map((part) => trimmed(part))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True when the query matches the display name, nickname, or legal first name.
 * Each word can hit a different name part, so "Christopher Santos" still matches
 * when the label shows nickname "Topher Santos".
 */
export function personMatchesNameQuery(
  person: PersonLike,
  query: string,
): boolean {
  const trimmedQuery = trimmed(query).toLowerCase();
  if (!trimmedQuery) return false;
  const haystack = personNameSearchText(person);
  if (!haystack) return false;
  if (haystack.includes(trimmedQuery)) return true;
  const tokens = trimmedQuery.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => haystack.includes(token));
}

export function nicknameMatchesFirstName(
  firstName?: string | null,
  nickname?: string | null,
): boolean {
  const first = trimmed(firstName).toLowerCase();
  const nick = trimmed(nickname).toLowerCase();
  return Boolean(first && nick && first === nick);
}

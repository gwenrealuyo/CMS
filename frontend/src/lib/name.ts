import { Person, PersonUI } from "@/src/types/person";
import { LessonPersonSummary } from "@/src/types/lesson";

type PersonLike = 
  | Partial<Person> 
  | PersonUI 
  | LessonPersonSummary 
  | { 
      id?: string | number;
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      suffix?: string;
      username?: string;
    }
  | null 
  | undefined;

interface PersonNameFields {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  username?: string;
  id?: string | number;
}

function hasNameFields(obj: unknown): obj is PersonNameFields {
  return typeof obj === "object" && obj !== null;
}

/**
 * Formats a person's name consistently across the application.
 * Handles first name, middle name (as initial), last name, and suffix.
 * Falls back to username if no name parts are available.
 * 
 * @param person - Person object with name fields
 * @returns Formatted name string
 */
export function formatPersonName(person: PersonLike): string {
  if (!person || !hasNameFields(person)) {
    return "Unknown person";
  }

  const first = person.first_name ?? "";
  const middle = person.middle_name;
  const last = person.last_name ?? "";
  const suffix = person.suffix;
  const username = person.username ?? "";

  const pieces: string[] = [];

  if (first) {
    pieces.push(first.trim());
  }

  if (middle) {
    const middleInitial = String(middle).trim().charAt(0);
    if (middleInitial) {
      pieces.push(`${middleInitial.toUpperCase()}.`);
    }
  }

  if (last) {
    pieces.push(last.trim());
  }

  if (suffix) {
    pieces.push(suffix.trim());
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

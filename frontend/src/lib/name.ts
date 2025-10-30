import { Person, PersonUI } from "@/src/types/person";

export function formatPersonName(person: Partial<Person> | PersonUI): string {
  const first = (person as any).first_name ?? "";
  const middle = (person as any).middle_name;
  const last = (person as any).last_name ?? "";
  const suffix = (person as any).suffix;

  const middleInitial =
    middle && String(middle).trim().length > 0
      ? ` ${String(middle).trim().charAt(0)}.`
      : "";
  const suffixPart =
    suffix && String(suffix).trim().length > 0
      ? ` ${String(suffix).trim()}`
      : "";

  return `${first}${middleInitial} ${last}${suffixPart}`.trim();
}

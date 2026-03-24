import type { Journey } from "@/src/types/person";

/** Newest first: by calendar date, then created_at, then id (for same-day ordering). */
export function compareJourneysNewestFirst(a: Journey, b: Journey): number {
  const dateA = new Date(a.date || 0).getTime();
  const dateB = new Date(b.date || 0).getTime();
  if (dateB !== dateA) return dateB - dateA;
  const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (cb !== ca) return cb - ca;
  const idA = Number(a.id);
  const idB = Number(b.id);
  if (!Number.isNaN(idA) && !Number.isNaN(idB) && idA !== idB) {
    return idB - idA;
  }
  return String(b.id).localeCompare(String(a.id));
}

import { Ministry } from "@/src/types/ministry";

export const NCC_MINISTRY_CODE = "NCC";
export const BIBLE_SHARERS_MINISTRY_CODE = "BIBLE_SHARERS";

export const BIBLE_SHARERS_ROSTER_EMPTY_MESSAGE =
  "No Bible Sharers on the headquarters roster. Add them under Ministries.";

type MinistryLike = Pick<Ministry, "code" | "is_system"> | null | undefined;

export function ministryCode(
  ministry: { code?: string | null } | null | undefined,
): string {
  return (ministry?.code || "").toUpperCase();
}

export function isNccRoster(ministry: MinistryLike): boolean {
  return ministryCode(ministry) === NCC_MINISTRY_CODE;
}

export function isBibleSharersRoster(ministry: MinistryLike): boolean {
  return ministryCode(ministry) === BIBLE_SHARERS_MINISTRY_CODE;
}

export function isSystemMinistry(ministry: MinistryLike): boolean {
  return (
    Boolean(ministry?.is_system) ||
    isNccRoster(ministry) ||
    isBibleSharersRoster(ministry)
  );
}

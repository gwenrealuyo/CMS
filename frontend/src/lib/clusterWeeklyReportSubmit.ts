import type {
  ClusterReportNewProspectInput,
  ClusterWeeklyReportFormValues,
  ClusterWeeklyReportInput,
  GatheringType,
} from "@/src/types/cluster";

const PROSPECT_PREFIX = "prospect:";
const NEW_PROSPECT_PREFIX = "new:";

export function isProspectAttendanceId(id: string): boolean {
  return id.startsWith(PROSPECT_PREFIX);
}

export function isPendingNewProspectId(id: string): boolean {
  return id.startsWith(NEW_PROSPECT_PREFIX);
}

export function prospectIdFromAttendanceId(id: string): string {
  return id.replace(PROSPECT_PREFIX, "");
}

export function toProspectAttendanceId(prospectId: string | number): string {
  return `${PROSPECT_PREFIX}${prospectId}`;
}

export function toPendingNewProspectId(tempId: string): string {
  return `${NEW_PROSPECT_PREFIX}${tempId}`;
}

function toNumberId(id: string | number): number | null {
  const n = typeof id === "number" ? id : Number(id);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

/**
 * Builds API payload for cluster weekly report create/update.
 * Promotes `prospect:{id}` visitor selections via `prospects_attended`
 * (server marks attended under report permissions). Pending `new:` ids
 * become `new_prospects`.
 */
export function buildClusterWeeklyReportPayloadFromFormValues(
  values: ClusterWeeklyReportFormValues
): ClusterWeeklyReportInput {
  const cluster = Number(values.cluster);
  if (!Number.isFinite(cluster) || cluster <= 0) {
    throw new Error("Cluster is required");
  }

  const members_attended = (values.members_attended || [])
    .map((id) => toNumberId(id))
    .filter((id): id is number => id !== null);

  const visitors_attended: number[] = [];
  const prospects_attended: number[] = [];
  for (const id of values.visitors_attended || []) {
    if (isProspectAttendanceId(id)) {
      const prospectId = toNumberId(prospectIdFromAttendanceId(id));
      if (prospectId !== null) prospects_attended.push(prospectId);
      continue;
    }
    const personId = toNumberId(id);
    if (personId !== null) visitors_attended.push(personId);
  }

  const prospects_invited: number[] = [];
  const new_prospects: ClusterReportNewProspectInput[] = [];
  const pending = values.pending_new_prospects || {};

  for (const id of values.prospects_invited || []) {
    if (isPendingNewProspectId(id)) {
      const tempKey = id.slice(NEW_PROSPECT_PREFIX.length);
      const payload = pending[tempKey] || pending[id];
      if (payload) new_prospects.push(payload);
      continue;
    }
    const prospectId = toNumberId(
      isProspectAttendanceId(id) ? prospectIdFromAttendanceId(id) : id
    );
    if (prospectId !== null) prospects_invited.push(prospectId);
  }

  const attendedSet = new Set(prospects_attended);
  const invitedOverlap = prospects_invited.filter((id) => attendedSet.has(id));
  if (invitedOverlap.length > 0) {
    throw new Error(
      "A prospect cannot be both invited and attended on the same report."
    );
  }

  return {
    cluster,
    year: Number(values.year),
    week_number: Number(values.week_number),
    meeting_date: values.meeting_date || "",
    gathering_type: (values.gathering_type || "PHYSICAL") as GatheringType,
    members_attended,
    visitors_attended,
    prospects_invited,
    new_prospects,
    prospects_attended,
    activities_held: values.activities_held || "",
    prayer_requests: values.prayer_requests || "",
    testimonies: values.testimonies || "",
    offerings: String(values.offerings ?? 0),
    highlights: values.highlights || "",
    lowlights: values.lowlights || "",
    submitted_by: values.submitted_by ?? undefined,
  };
}

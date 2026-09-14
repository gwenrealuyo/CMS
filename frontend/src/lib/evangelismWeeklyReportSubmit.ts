import type { EvangelismWeeklyReportFormValues } from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import { evangelismApi } from "@/src/lib/api";
import {
  isPendingNewProspectId,
  isProspectAttendanceId,
  prospectIdFromAttendanceId,
} from "@/src/lib/clusterWeeklyReportSubmit";
import type { EvangelismReportNewInvitedProspectInput } from "@/src/types/evangelism";

function toNumberId(id: string | number): number | null {
  const n = typeof id === "number" ? id : Number(id);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

/**
 * Resolves prospect visitors to person IDs (markAttended), then returns API payload
 * matching the Evangelism weekly report serializer (create/update).
 */
export async function buildEvangelismWeeklyReportPayloadFromFormValues(
  values: EvangelismWeeklyReportFormValues
): Promise<Record<string, unknown>> {
  const prospectIds = (values.visitors_attended || [])
    .filter((id) => isProspectAttendanceId(id))
    .map((id) => id.replace("prospect:", ""));
  const existingVisitorIds = (values.visitors_attended || []).filter(
    (id) => !isProspectAttendanceId(id) && !id.startsWith("newvisitor:")
  );
  const createdVisitorIds: string[] = [];

  for (const prospectId of prospectIds) {
    const response = await evangelismApi.markAttended(prospectId, {
      last_activity_date: values.meeting_date,
    });
    const personId = response.data?.person?.id;
    if (personId) {
      createdVisitorIds.push(String(personId));
    }
  }

  const prospects_invited: number[] = [];
  const new_invited_prospects: EvangelismReportNewInvitedProspectInput[] = [];
  const pending = values.pending_new_prospects || {};

  for (const id of values.prospects_invited || []) {
    if (isPendingNewProspectId(id)) {
      const tempKey = id.slice("new:".length);
      const payload = pending[tempKey] || pending[id];
      if (payload) new_invited_prospects.push(payload);
      continue;
    }
    const prospectId = toNumberId(
      isProspectAttendanceId(id) ? prospectIdFromAttendanceId(id) : id
    );
    if (prospectId !== null) prospects_invited.push(prospectId);
  }

  const attendedSet = new Set(
    prospectIds.map((id) => toNumberId(id)).filter((n): n is number => n !== null)
  );
  const invitedOverlap = prospects_invited.filter((id) => attendedSet.has(id));
  if (invitedOverlap.length > 0) {
    throw new Error(
      "A prospect cannot be both invited and attended on the same report."
    );
  }

  return {
    evangelism_group_id: values.evangelism_group_id,
    year: values.year,
    week_number: values.week_number,
    meeting_date: values.meeting_date,
    gathering_type: values.gathering_type,
    topic: values.topic,
    activities_held: values.activities_held,
    prayer_requests: values.prayer_requests,
    testimonies: values.testimonies,
    conversions_this_week: 0,
    notes: values.notes,
    members_attended: values.members_attended.map(String),
    visitors_attended: [...existingVisitorIds, ...createdVisitorIds].map(String),
    prospects_invited,
    new_invited_prospects,
  };
}

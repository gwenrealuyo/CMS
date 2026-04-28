import type { EvangelismWeeklyReportFormValues } from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import { evangelismApi } from "@/src/lib/api";

/**
 * Resolves prospect visitors to person IDs (markAttended), then returns API payload
 * matching the Evangelism weekly report serializer (create/update).
 */
export async function buildEvangelismWeeklyReportPayloadFromFormValues(
  values: EvangelismWeeklyReportFormValues
): Promise<Record<string, unknown>> {
  const prospectIds = values.visitors_attended
    .filter((id) => id.startsWith("prospect:"))
    .map((id) => id.replace("prospect:", ""));
  const existingVisitorIds = values.visitors_attended.filter(
    (id) => !id.startsWith("prospect:")
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
    new_prospects: values.new_prospects,
    conversions_this_week: 0,
    notes: values.notes,
    members_attended: values.members_attended.map(String),
    visitors_attended: [...existingVisitorIds, ...createdVisitorIds].map(String),
  };
}

/** Event types that must be recorded on a weekly report, not this attend modal. */
export const REPORT_BACKED_FIRST_ACTIVITIES = [
  "CLUSTERING",
  "BS/CLUSTER_EVANGELISM",
  "BIBLE_STUDY",
] as const;

export type ReportBackedFirstActivity =
  (typeof REPORT_BACKED_FIRST_ACTIVITIES)[number];

export function isClusterReportFirstActivity(code: string): boolean {
  return code === "CLUSTERING";
}

export function isEvangelismReportFirstActivity(code: string): boolean {
  return code === "BS/CLUSTER_EVANGELISM" || code === "BIBLE_STUDY";
}

export function isReportBackedFirstActivity(code: string): boolean {
  return isClusterReportFirstActivity(code) || isEvangelismReportFirstActivity(code);
}

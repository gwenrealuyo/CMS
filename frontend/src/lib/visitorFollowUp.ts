import type {
  TaskType,
  VisitorFollowUpCase,
  VisitorFollowUpCaseStatus,
} from "@/src/types/evangelism";

/** Preset task types for My visitors (common first; EMAIL omitted). */
export const VISITOR_FOLLOW_UP_TASK_TYPES: {
  value: TaskType;
  label: string;
}[] = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "TEXT_MESSAGE", label: "Text / message" },
  { value: "VISIT", label: "Visit" },
  { value: "INVITE_SUNDAY_SERVICE", label: "Invite to next Sunday service" },
  { value: "INVITE_BIBLE_STUDY", label: "Invite to Bible study" },
  { value: "INVITE_FELLOWSHIP", label: "Invite to fellowship activity" },
  { value: "INVITE_NCC", label: "Invite to take NCC" },
  { value: "INVITE_OTHER_CHURCH", label: "Invite to other church activities" },
  { value: "PRAYER", label: "Prayer" },
  { value: "OTHER", label: "Other" },
];

export const LOW_PRIORITY_REASON_PLACEHOLDER =
  "e.g. Expressed disinterest, Asked for space, Other…";

const CHIP_BASE =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset";

/** Pipeline stage chip (Invited / Attended). */
export function visitorPipelineStageClass(stage: string | undefined | null): string {
  switch ((stage || "").toUpperCase()) {
    case "INVITED":
      return `${CHIP_BASE} bg-violet-50 text-violet-900 ring-violet-200`;
    case "ATTENDED":
      return `${CHIP_BASE} bg-teal-50 text-teal-900 ring-teal-200`;
    default:
      return `${CHIP_BASE} bg-slate-50 text-slate-700 ring-slate-200`;
  }
}

export function visitorPipelineStageLabel(
  stage: string | undefined | null,
  display?: string | null
): string {
  if (display) return display;
  switch ((stage || "").toUpperCase()) {
    case "INVITED":
      return "Invited";
    case "ATTENDED":
      return "Attended";
    default:
      return stage || "—";
  }
}

/** Case follow-up status chip (Open / Ongoing / Low priority / Closed / Deceased). */
export function visitorFollowUpStatusClass(
  status: VisitorFollowUpCaseStatus | string,
  closedReason?: string | null
): string {
  if (status === "CLOSED" && (closedReason || "").toUpperCase() === "DECEASED") {
    return `${CHIP_BASE} bg-stone-100 text-stone-800 ring-stone-300`;
  }
  switch (status) {
    case "OPEN":
      return `${CHIP_BASE} bg-amber-50 text-amber-900 ring-amber-200`;
    case "IN_PROGRESS":
      return `${CHIP_BASE} bg-sky-50 text-sky-900 ring-sky-200`;
    case "NO_ACTION":
      return `${CHIP_BASE} bg-slate-100 text-slate-700 ring-slate-300`;
    case "CLOSED":
      return `${CHIP_BASE} bg-emerald-50 text-emerald-900 ring-emerald-200`;
    default:
      return `${CHIP_BASE} bg-slate-50 text-slate-700 ring-slate-200`;
  }
}

export function visitorFollowUpStatusLabel(
  status: VisitorFollowUpCaseStatus | string,
  display?: string | null,
  closedReason?: string | null
): string {
  if (status === "CLOSED" && (closedReason || "").toUpperCase() === "DECEASED") {
    return "Deceased";
  }
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PROGRESS":
      return "Ongoing";
    case "NO_ACTION":
      return "Low priority";
    case "CLOSED":
      return display || "Closed";
    default:
      return display || status || "—";
  }
}

export function visitorNeedsAttentionClass(): string {
  return `${CHIP_BASE} bg-orange-50 text-orange-900 ring-orange-200`;
}

export function visitorAffiliationClass(): string {
  return `${CHIP_BASE} bg-indigo-50 text-indigo-900 ring-indigo-200`;
}

/** Cluster codes + evangelism group names (API affiliations + prospect FKs). */
export function visitorAffiliationLabels(row: VisitorFollowUpCase): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  const push = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    labels.push(trimmed);
  };

  const pushCluster = (cluster: {
    code?: string | null;
    name?: string | null;
  } | null | undefined) => {
    if (!cluster) return;
    const code = (cluster.code || "").trim();
    const name = (cluster.name || "").trim();
    if (code) push(`Cluster ${code}`);
    else if (name) push(name);
  };

  const affiliations = row.affiliations;
  if (affiliations) {
    for (const cluster of affiliations.clusters || []) {
      pushCluster(cluster);
    }
    for (const group of affiliations.evangelism_groups || []) {
      const name = (group.name || "").trim();
      if (name) push(name);
    }
  }

  // Fallback if older payloads omit affiliations.
  const prospect = row.prospect;
  if (prospect) {
    pushCluster(
      prospect.inviter_cluster as
        | { code?: string | null; name?: string | null }
        | undefined
    );
    pushCluster(
      prospect.endorsed_cluster as
        | { code?: string | null; name?: string | null }
        | undefined
    );
    const group = prospect.evangelism_group;
    if (group) {
      pushCluster(
        group.cluster as { code?: string | null; name?: string | null } | undefined
      );
      if (group.name) push(group.name);
    }
  }

  return labels;
}

import { Prospect } from "@/src/types/evangelism";
import { prospectDisplayName } from "@/src/lib/globalSearchUtils";

export { prospectDisplayName };

export type ProspectSource = "cluster" | "evangelism";

export function prospectSources(prospect: Prospect): ProspectSource[] {
  const sources: ProspectSource[] = [];
  if (prospect.inviter_cluster || prospect.endorsed_cluster) {
    sources.push("cluster");
  }
  if (prospect.evangelism_group) {
    sources.push("evangelism");
  }
  return sources;
}

export function formatPipelineStageLabel(stage: string | undefined): string {
  if (!stage) return "N/A";
  if (stage === "TAKEN_NCC") return "NCC";
  if (stage === "RECEIVED_HG") return "Received HG";
  if (stage === "REACHED") return "Reached";
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function prospectClusterLabel(prospect: Prospect): string {
  return (
    prospect.inviter_cluster?.code ||
    prospect.endorsed_cluster?.code ||
    prospect.inviter_cluster?.name ||
    prospect.endorsed_cluster?.name ||
    "—"
  );
}

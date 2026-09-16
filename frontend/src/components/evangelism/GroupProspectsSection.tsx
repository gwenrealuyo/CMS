"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import ProspectDeleteButton from "@/src/components/evangelism/ProspectDeleteButton";
import { Prospect } from "@/src/types/evangelism";
import { formatLocaleDate } from "@/src/lib/date";

function prospectDisplayName(p: Prospect): string {
  if (p.display_name?.trim()) return p.display_name;
  const parts = [p.first_name, p.middle_name, p.last_name].filter(
    Boolean,
  ) as string[];
  let base = parts.join(" ");
  if (p.suffix?.trim()) base = base ? `${base}, ${p.suffix}` : p.suffix!;
  return base || "Unknown";
}

interface GroupProspectsSectionProps {
  prospects: Prospect[];
  onAddProspect: () => void;
  onUpdateProgress: (prospect: Prospect) => void;
  onDelete?: (prospect: Prospect) => Promise<void> | void;
  loading?: boolean;
}

export default function GroupProspectsSection({
  prospects,
  onAddProspect,
  onUpdateProgress,
  onDelete,
  loading = false,
}: GroupProspectsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const formatPipelineStage = (stage: string | undefined): string => {
    if (!stage) return "N/A";
    if (stage === "TAKEN_NCC") return "NCC";
    if (stage === "REACHED") return "Reached";
    if (stage === "RECEIVED_HG") return "Received HG";
    return stage.replace("Received Holy Ghost", "Received HG");
  };

  const displayedProspects = showAll
    ? prospects
    : prospects.slice(0, DEFAULT_LIMIT);
  const hasMoreProspects = prospects.length > DEFAULT_LIMIT;

  const clusterLabel = (prospect: Prospect) =>
    prospect.inviter_cluster?.code ||
    prospect.endorsed_cluster?.code ||
    prospect.inviter_cluster?.name ||
    prospect.endorsed_cluster?.name ||
    "N/A";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-base font-semibold text-gray-900 md:text-lg">
          Visitors
        </h3>
        <Button
          onClick={onAddProspect}
          className="!text-white !bg-orange-600 hover:!text-white hover:!bg-orange-700 w-full sm:w-auto min-h-[44px]"
        >
          + Add New Visitor
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No visitors</div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Name",
                accessor: "id" as keyof Prospect,
                render: (_value, row) => (
                  <span className="text-sm font-medium text-gray-900">
                    {prospectDisplayName(row)}
                  </span>
                ),
              },
              {
                header: "Stage",
                accessor: "pipeline_stage" as keyof Prospect,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {formatPipelineStage(
                      row.pipeline_stage_display || row.pipeline_stage,
                    )}
                  </span>
                ),
              },
              {
                header: "Last Activity",
                accessor: "last_activity_date" as keyof Prospect,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? formatLocaleDate(value as string) : "N/A"}
                  </span>
                ),
              },
              {
                header: "Cluster",
                accessor: "inviter_cluster" as keyof Prospect,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {clusterLabel(row)}
                  </span>
                ),
              },
              {
                header: "Actions",
                accessor: "id" as keyof Prospect,
                render: (_value, row) => {
                  const showUpdate =
                    row.pipeline_stage === "INVITED" && !row.is_dropped_off;
                  if (!showUpdate && !onDelete) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      {showUpdate ? (
                        <Button
                          variant="secondary"
                          onClick={() => onUpdateProgress(row)}
                          className="min-h-[44px] border border-amber-200 bg-white px-2 py-1 text-xs !text-amber-600 hover:border-amber-300 hover:bg-amber-50 md:min-h-0"
                        >
                          Update
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <ProspectDeleteButton
                          prospect={row}
                          onDelete={onDelete}
                          compact
                        />
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
            data={displayedProspects}
            mobileCardView={false}
          />
          {hasMoreProspects && (
            <div className="flex justify-center pt-2">
              <Button
                variant="tertiary"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                {showAll
                  ? "Show Less"
                  : `Show More (${prospects.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

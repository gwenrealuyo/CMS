"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { Prospect } from "@/src/types/evangelism";

function prospectDisplayName(p: Prospect): string {
  if (p.display_name?.trim()) return p.display_name;
  const parts = [p.first_name, p.middle_name, p.last_name].filter(
    Boolean
  ) as string[];
  let base = parts.join(" ");
  if (p.suffix?.trim()) base = base ? `${base}, ${p.suffix}` : p.suffix!;
  return base || "Unknown";
}

interface GroupProspectsSectionProps {
  prospects: Prospect[];
  onAddProspect: () => void;
  onUpdateProgress: (prospect: Prospect) => void;
  loading?: boolean;
}

export default function GroupProspectsSection({
  prospects,
  onAddProspect,
  onUpdateProgress,
  loading = false,
}: GroupProspectsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const formatPipelineStage = (stage: string | undefined): string => {
    if (!stage) return "N/A";
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
        <h3 className="text-lg font-semibold text-gray-900">Visitors</h3>
        <Button
          onClick={onAddProspect}
          className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto min-h-[44px]"
        >
          Add Invited Visitor
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
                      row.pipeline_stage_display || row.pipeline_stage
                    )}
                  </span>
                ),
              },
              {
                header: "Last Activity",
                accessor: "last_activity_date" as keyof Prospect,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value
                      ? new Date(value as string).toLocaleDateString()
                      : "N/A"}
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
                render: (_value, row) => (
                  <Button
                    variant="secondary"
                    onClick={() => onUpdateProgress(row)}
                    className="!text-amber-600 bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-xs py-1 px-2 min-h-[44px] md:min-h-0 w-full md:w-auto"
                  >
                    Update
                  </Button>
                ),
              },
            ]}
            data={displayedProspects}
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

"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { Prospect } from "@/src/types/evangelism";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-lg font-semibold text-gray-900">Visitors</h3>
        <Button
          onClick={onAddProspect}
          className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto min-h-[44px]"
        >
          Add Visitor
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No visitors</div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {displayedProspects.map((prospect) => (
              <div
                key={prospect.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500">Name</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {prospect.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Stage</span>
                    <p className="text-sm text-gray-700 mt-1">
                      {formatPipelineStage(
                        prospect.pipeline_stage_display ||
                          prospect.pipeline_stage
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Last Activity</span>
                    <p className="text-sm text-gray-700 mt-1">
                      {prospect.last_activity_date
                        ? new Date(
                            prospect.last_activity_date
                          ).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Cluster</span>
                    <p className="text-sm text-gray-700 mt-1">
                      {prospect.inviter_cluster?.code ||
                        prospect.endorsed_cluster?.code ||
                        prospect.inviter_cluster?.name ||
                        prospect.endorsed_cluster?.name ||
                        "N/A"}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    <Button
                      variant="secondary"
                      onClick={() => onUpdateProgress(prospect)}
                      className="!text-amber-600 bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300 flex-1 min-h-[44px]"
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto -mx-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cluster
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedProspects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {prospect.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {formatPipelineStage(
                          prospect.pipeline_stage_display ||
                            prospect.pipeline_stage
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {prospect.last_activity_date
                          ? new Date(
                              prospect.last_activity_date
                            ).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {prospect.inviter_cluster?.code ||
                          prospect.endorsed_cluster?.code ||
                          prospect.inviter_cluster?.name ||
                          prospect.endorsed_cluster?.name ||
                          "N/A"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => onUpdateProgress(prospect)}
                          className="!text-amber-600 bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-xs py-1 px-2"
                        >
                          Update
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

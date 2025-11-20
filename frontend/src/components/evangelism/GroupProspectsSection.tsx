"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { Prospect } from "@/src/types/evangelism";

interface GroupProspectsSectionProps {
  prospects: Prospect[];
  onAddProspect: () => void;
  onUpdateProgress: (prospect: Prospect) => void;
  onEndorseToCluster: (prospect: Prospect) => void;
  loading?: boolean;
}

export default function GroupProspectsSection({
  prospects,
  onAddProspect,
  onUpdateProgress,
  onEndorseToCluster,
  loading = false,
}: GroupProspectsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const formatPipelineStage = (stage: string | undefined): string => {
    if (!stage) return "N/A";
    return stage.replace("Received Holy Ghost", "Received HG");
  };

  const displayedProspects = showAll ? prospects : prospects.slice(0, DEFAULT_LIMIT);
  const hasMoreProspects = prospects.length > DEFAULT_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Prospects</h3>
        <Button 
          onClick={onAddProspect}
          className="bg-orange-600 hover:bg-orange-700"
        >
          Add Prospect
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No prospects</div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-6">
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
                      <span className="text-sm font-medium text-gray-900">{prospect.name}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {formatPipelineStage(prospect.pipeline_stage_display || prospect.pipeline_stage)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {prospect.last_activity_date
                          ? new Date(prospect.last_activity_date).toLocaleDateString()
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
                        <Button
                          variant="secondary"
                          onClick={() => onEndorseToCluster(prospect)}
                          className="!text-teal-600 bg-white border border-teal-200 hover:bg-teal-50 hover:border-teal-300 text-xs py-1 px-2"
                        >
                          Endorse
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
                {showAll ? "Show Less" : `Show More (${prospects.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


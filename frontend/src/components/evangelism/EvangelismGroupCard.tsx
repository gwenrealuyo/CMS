import { memo, useMemo } from "react";
import { EvangelismGroup } from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import {
  BRANCH_CHIP_CLASSNAME,
  getBranchChipStyle,
} from "@/src/lib/branchChipColor";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";

interface EvangelismGroupCardProps {
  group: EvangelismGroup;
  clusters: Cluster[];
  branches: Branch[];
  isSelected?: boolean;
  onClick: () => void;
}

const EvangelismGroupCard = memo(
  ({
    group,
    clusters,
    branches,
    isSelected = false,
    onClick,
  }: EvangelismGroupCardProps) => {
    const clusterBranch = useMemo(() => {
      if (!group.cluster?.id) return null;
      const fullCluster = clusters.find(
        (c) => String(c.id) === String(group.cluster!.id)
      );
      if (fullCluster?.branch == null) return null;
      const branchId = Number(fullCluster.branch);
      return branches.find((b) => b.id === branchId) || null;
    }, [group.cluster, clusters, branches]);

    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left card-list-row px-4 py-3 ${
          isSelected ? "card-list-row--selected" : ""
        }`}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-semibold text-foreground">
                {group.name}
              </h4>
              {group.is_bible_sharers_group && (
                <span
                  className={STATUS_CHIP_CLASSNAME}
                  style={getStatusChipStyle("primary")}
                >
                  Bible Sharers
                </span>
              )}
              {!group.is_active && (
                <span
                  className={STATUS_CHIP_CLASSNAME}
                  style={getStatusChipStyle("inactive")}
                >
                  Inactive
                </span>
              )}
              {group.is_active && (
                <span
                  className={STATUS_CHIP_CLASSNAME}
                  style={getStatusChipStyle("active")}
                >
                  Active
                </span>
              )}
            </div>
            {group.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {group.description}
              </p>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
              {group.coordinator && (
                <span>
                  Coordinator:{" "}
                  <span className="font-medium">
                    {group.coordinator.full_name}
                  </span>
                </span>
              )}
              {group.cluster && (
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <span>Cluster:</span>
                  {clusterBranch && !clusterBranch.is_headquarters ? (
                    <span
                      className={BRANCH_CHIP_CLASSNAME}
                      style={getBranchChipStyle(
                        clusterBranch.id,
                        clusterBranch.is_headquarters
                      )}
                    >
                      {group.cluster.name}
                    </span>
                  ) : (
                    <span className="font-medium">
                      {group.cluster.name}
                      {clusterBranch?.is_headquarters && " (HQ)"}
                    </span>
                  )}
                </span>
              )}
              <span>
                Members:{" "}
                <span className="font-medium">{group.members_count || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }
);

EvangelismGroupCard.displayName = "EvangelismGroupCard";

export default EvangelismGroupCard;

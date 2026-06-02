import { memo, useMemo } from "react";
import { EvangelismGroup } from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import {
  CLUSTER_CODE_BADGE_CLASSNAME,
  getClusterCodeBadgeStyle,
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
    const { clusterBranch, clusterDisplayCode } = useMemo(() => {
      if (!group.cluster?.id) {
        return { clusterBranch: null, clusterDisplayCode: null };
      }
      const fullCluster = clusters.find(
        (c) => String(c.id) === String(group.cluster!.id)
      );
      const clusterDisplayCode =
        fullCluster?.code?.trim() ||
        group.cluster.code?.trim() ||
        group.cluster.name ||
        "—";

      if (fullCluster?.branch == null) {
        return { clusterBranch: null, clusterDisplayCode };
      }
      const branchId = Number(fullCluster.branch);
      const clusterBranch = branches.find((b) => b.id === branchId) || null;
      return { clusterBranch, clusterDisplayCode };
    }, [group.cluster, clusters, branches]);

    const memberCount = useMemo(() => {
      const base = group.members_count ?? 0;
      const coordinator = group.coordinator;
      if (!coordinator) return base;
      const coordinatorInMembers = group.members?.some(
        (member) => String(member.id) === String(coordinator.id)
      );
      if (coordinatorInMembers) return base;
      if (coordinator.role === "ADMIN" || coordinator.role === "VISITOR") {
        return base;
      }
      return base + 1;
    }, [group]);

    const visitorCount = group.visitors_count ?? 0;

    const coordinatorName =
      group.coordinator?.full_name?.trim() || "Unknown Coordinator";

    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left p-4 md:p-5 rounded-lg card-list relative ${
          isSelected ? "card-list--selected" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-base md:text-lg text-primary truncate">
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
              {group.is_active && clusterDisplayCode && (
                <span
                  className={CLUSTER_CODE_BADGE_CLASSNAME}
                  style={getClusterCodeBadgeStyle(
                    clusterBranch?.id,
                    clusterBranch?.is_headquarters
                  )}
                >
                  {clusterDisplayCode}
                </span>
              )}
            </div>
            {group.coordinator && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                <svg
                  className="w-3.5 h-3.5 text-gray-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="truncate max-w-[10rem] md:max-w-[12rem]">
                  {coordinatorName}
                </span>
              </div>
            )}
            {group.description && (
              <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                {group.description}
              </p>
            )}
          </div>
          <div className="ml-2 md:ml-3 flex items-center gap-1 md:gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-gray-600">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="text-xs font-medium">{memberCount}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span className="text-xs font-medium">{visitorCount}</span>
            </div>
          </div>
        </div>
      </button>
    );
  }
);

EvangelismGroupCard.displayName = "EvangelismGroupCard";

export default EvangelismGroupCard;

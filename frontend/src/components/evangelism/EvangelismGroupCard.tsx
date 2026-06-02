import { memo, useMemo } from "react";
import { EvangelismGroup } from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import {
  CLUSTER_CODE_BADGE_CLASSNAME,
  getClusterCodeBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  getEvangelismGroupCoordinatorName,
  getEvangelismGroupMemberCount,
  resolveEvangelismGroupClusterMeta,
} from "@/src/lib/evangelismGroupDisplay";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";

interface EvangelismGroupCardProps {
  group: EvangelismGroup;
  clusters: Cluster[];
  branches: Branch[];
  isViewHighlighted?: boolean;
  isSelectionMode?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: () => void;
  onClick: () => void;
}

const EvangelismGroupCard = memo(
  ({
    group,
    clusters,
    branches,
    isViewHighlighted = false,
    isSelectionMode = false,
    isBulkSelected = false,
    onBulkSelect,
    onClick,
  }: EvangelismGroupCardProps) => {
    const { clusterBranch, clusterDisplayCode } = useMemo(
      () => resolveEvangelismGroupClusterMeta(group, clusters, branches),
      [group, clusters, branches]
    );

    const memberCount = useMemo(
      () => getEvangelismGroupMemberCount(group),
      [group]
    );

    const visitorCount = group.visitors_count ?? 0;

    const coordinatorName = getEvangelismGroupCoordinatorName(group);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={`relative w-full cursor-pointer rounded-lg p-4 text-left card-list md:p-5 ${
          isViewHighlighted || (isSelectionMode && isBulkSelected)
            ? "card-list--selected"
            : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {isSelectionMode && onBulkSelect && (
            <div
              className="mr-2 mt-1 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onBulkSelect();
              }}
            >
              <input
                type="checkbox"
                checked={isBulkSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onBulkSelect();
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-ring"
                aria-label={`Select ${group.name}`}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-semibold text-primary md:text-lg">
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
                  className="h-3.5 w-3.5 flex-shrink-0 text-gray-500"
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
                <span className="max-w-[10rem] truncate md:max-w-[12rem]">
                  {coordinatorName}
                </span>
              </div>
            )}
            {group.description && (
              <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                {group.description}
              </p>
            )}
          </div>
          <div className="ml-2 flex flex-shrink-0 items-center gap-1 md:ml-3 md:gap-2">
            <div className="flex items-center gap-1 text-gray-600">
              <svg
                className="h-4 w-4 text-gray-500"
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
                className="h-4 w-4 text-gray-500"
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
      </div>
    );
  }
);

EvangelismGroupCard.displayName = "EvangelismGroupCard";

export default EvangelismGroupCard;

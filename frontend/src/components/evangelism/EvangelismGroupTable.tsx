import { memo } from "react";
import ActionMenu from "@/src/components/families/ActionMenu";
import {
  CLUSTER_CODE_BADGE_CLASSNAME,
  getBranchChipStyle,
  getBranchDisplayCode,
  getClusterCodeBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  formatEvangelismGroupSchedule,
  getEvangelismGroupCoordinatorName,
  getEvangelismGroupMemberCount,
  resolveEvangelismGroupClusterMeta,
} from "@/src/lib/evangelismGroupDisplay";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { EvangelismGroup } from "@/src/types/evangelism";

interface EvangelismGroupTableProps {
  groups: EvangelismGroup[];
  clusters: Cluster[];
  branches: Branch[];
  viewHighlightedGroupId?: string;
  isSelectionMode?: boolean;
  selectedGroupIds?: Set<string>;
  onSelectGroup?: (groupId: string) => void;
  onSelectAll?: () => void;
  onView: (group: EvangelismGroup) => void;
  onEdit: (group: EvangelismGroup) => void;
  onDelete: (group: EvangelismGroup) => void;
}

const EvangelismGroupTable = memo(
  ({
    groups,
    clusters,
    branches,
    viewHighlightedGroupId,
    isSelectionMode = false,
    selectedGroupIds,
    onSelectGroup,
    onSelectAll,
    onView,
    onEdit,
    onDelete,
  }: EvangelismGroupTableProps) => {
    const allSelected =
      groups.length > 0 &&
      groups.every((group) => selectedGroupIds?.has(group.id));

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {isSelectionMode && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    aria-label="Select all groups"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Group
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Cluster
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Branch
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Coordinator
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Members
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Visitors
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Location / Schedule
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((group) => {
              const { clusterBranch, clusterDisplayCode } =
                resolveEvangelismGroupClusterMeta(group, clusters, branches);
              const memberCount = getEvangelismGroupMemberCount(group);
              const visitorCount = group.visitors_count ?? 0;
              const coordinatorName = getEvangelismGroupCoordinatorName(group);
              const isViewHighlighted = viewHighlightedGroupId === group.id;
              const isBulkSelected = selectedGroupIds?.has(group.id) ?? false;

              return (
                <tr
                  key={group.id}
                  className={`hover:bg-gray-50 ${
                    isViewHighlighted || (isSelectionMode && isBulkSelected)
                      ? "bg-primary/5"
                      : ""
                  }`}
                >
                  {isSelectionMode && onSelectGroup && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isBulkSelected}
                        onChange={() => onSelectGroup(group.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                        aria-label={`Select ${group.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onView(group)}
                        className={TABLE_ENTITY_LINK_CLASS}
                      >
                        {group.name}
                      </button>
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
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {group.is_active && clusterDisplayCode ? (
                      <span
                        className={CLUSTER_CODE_BADGE_CLASSNAME}
                        style={getClusterCodeBadgeStyle(
                          clusterBranch?.id,
                          clusterBranch?.is_headquarters
                        )}
                      >
                        {clusterDisplayCode}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {clusterBranch ? (
                      <span
                        className="font-medium"
                        style={{
                          color: getBranchChipStyle(
                            clusterBranch.id,
                            clusterBranch.is_headquarters
                          ).color,
                        }}
                      >
                        {getBranchDisplayCode(clusterBranch)}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{coordinatorName}</td>
                  <td className="px-4 py-3 text-gray-700">{memberCount}</td>
                  <td className="px-4 py-3 text-gray-700">{visitorCount}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="space-y-1">
                      <div>{group.location || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {formatEvangelismGroupSchedule(group)}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <ActionMenu
                        onView={() => onView(group)}
                        onEdit={() => onEdit(group)}
                        onDelete={() => onDelete(group)}
                        labels={{
                          view: "View Group",
                          edit: "Edit Group",
                          delete: "Delete Group",
                          title: "Group Actions",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

EvangelismGroupTable.displayName = "EvangelismGroupTable";

export default EvangelismGroupTable;

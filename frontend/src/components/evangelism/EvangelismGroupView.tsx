"use client";

import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import GroupMembersSection from "@/src/components/evangelism/GroupMembersSection";
import GroupPeopleProgressSection from "@/src/components/evangelism/GroupPeopleProgressSection";
import GroupProspectsSection from "@/src/components/evangelism/GroupProspectsSection";
import GroupReportsSection from "@/src/components/evangelism/GroupReportsSection";
import {
  CLUSTER_BRANCH_CHIP_CLASSNAME,
  CLUSTER_CODE_BADGE_CLASSNAME,
  getBranchDisplayCode,
  getBranchOutlineBadgeStyle,
  getClusterCodeBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  formatEvangelismGroupSchedule,
  getEvangelismGroupCoordinatorName,
  getEvangelismGroupMemberCount,
  isClusterBibleStudy,
  resolveEvangelismGroupClusterMeta,
  evangelismGroupApprovalChip,
} from "@/src/lib/evangelismGroupDisplay";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import {
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";

const MEETING_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  IRREGULAR: "Irregular",
};

function formatGroupScheduleLine(group: EvangelismGroup): string {
  const raw = formatEvangelismGroupSchedule(group);
  const when =
    raw === "No schedule"
      ? ""
      : raw
          .replace(
            /^([A-Z]+)/,
            (day) => day.charAt(0) + day.slice(1).toLowerCase(),
          )
          .replace(/(\d{2}:\d{2}):\d{2}/, "$1");
  const freq =
    MEETING_FREQUENCY_LABELS[group.meeting_frequency || "WEEKLY"] || "Weekly";
  return when ? `${when} · ${freq}` : freq;
}

interface EvangelismGroupViewProps {
  group: EvangelismGroup;
  groupData?: EvangelismGroup | null;
  clusters: Cluster[];
  branches: Branch[];
  groupLoading?: boolean;
  reports: EvangelismWeeklyReport[];
  reportsLoading?: boolean;
  prospects: Prospect[];
  prospectsLoading?: boolean;
  progressPeople: Person[];
  progressPeopleLoading?: boolean;
  onAddMember: () => void;
  onBulkEnroll: () => void;
  onRemoveMember: (person: Person) => void;
  onAddReport: () => void;
  onViewReport: (report: EvangelismWeeklyReport) => void;
  onEditReport: (report: EvangelismWeeklyReport) => void;
  onAddProspect: () => void;
  onAddEncodedVisitor: () => void;
  onUpdateProgress: (prospect: Prospect) => void;
  onDeleteProspect?: (prospect: Prospect) => Promise<void> | void;
  onAddPersonProgress: () => void;
  onEditPersonProgress: (person: Person) => void;
  onEdit: () => void;
  onDelete: () => void;
  onHardDelete?: () => void;
  onClose: () => void;
  canManageGroup?: boolean;
  canSubmitReport?: boolean;
  canOperateGroup?: boolean;
  canApproveGroup?: boolean;
  reviewLoading?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  showTopHeader?: boolean;
}

export default function EvangelismGroupView({
  group,
  groupData,
  clusters,
  branches,
  groupLoading = false,
  reports,
  reportsLoading = false,
  prospects,
  prospectsLoading = false,
  progressPeople,
  progressPeopleLoading = false,
  onAddMember,
  onBulkEnroll,
  onRemoveMember,
  onAddReport,
  onViewReport,
  onEditReport,
  onAddProspect,
  onAddEncodedVisitor,
  onUpdateProgress,
  onDeleteProspect,
  onAddPersonProgress,
  onEditPersonProgress,
  onDelete,
  onHardDelete,
  onClose,
  onEdit,
  canManageGroup = true,
  canSubmitReport = true,
  canOperateGroup = true,
  canApproveGroup = false,
  reviewLoading = false,
  onApprove,
  onReject,
  showTopHeader = true,
}: EvangelismGroupViewProps) {
  const isPanelMode = !showTopHeader;
  const displayGroup = groupData ?? group;
  const { clusterBranch, clusterDisplayCode } =
    resolveEvangelismGroupClusterMeta(displayGroup, clusters, branches);
  const memberCount = getEvangelismGroupMemberCount(displayGroup);
  const visitorCount = displayGroup.visitors_count ?? 0;
  const coordinatorName = displayGroup.coordinator
    ? getEvangelismGroupCoordinatorName(displayGroup)
    : null;
  const scheduleLine = formatGroupScheduleLine(displayGroup);
  const approvalChip = evangelismGroupApprovalChip(displayGroup);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      {showTopHeader && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-3 md:p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-gray-900">Group Details</h2>
            <p className="mt-0.5 truncate text-xs text-gray-600 md:text-[11px]">
              {group.name || "Untitled Group"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md p-2 text-xl font-bold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${
          isPanelMode ? "p-3 sm:p-4" : "p-3 sm:p-4 md:p-5"
        }`}
      >
        {groupLoading ? (
          <LoadingSpinner />
        ) : (
          <div
            className={
              isPanelMode ? "space-y-3 sm:space-y-4" : "space-y-4 md:space-y-5"
            }
          >
            <div
              className={`rounded-lg border p-3 sm:p-4 ${
                isPanelMode
                  ? "border-gray-200 bg-white shadow-sm"
                  : "border-primary/20 bg-gradient-to-r from-lighthouse-ivory to-muted"
              }`}
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2 sm:gap-3">
                  <h2
                    className={`${
                      isPanelMode ? "text-xl" : "text-lg md:text-xl"
                    } min-w-0 break-words font-bold text-gray-900`}
                  >
                    {displayGroup.name || "Untitled Group"}
                  </h2>
                  {clusterDisplayCode && (
                    <span
                      className={`${CLUSTER_CODE_BADGE_CLASSNAME} flex-shrink-0`}
                      style={getClusterCodeBadgeStyle(
                        clusterBranch?.id,
                        clusterBranch?.is_headquarters,
                      )}
                    >
                      {clusterDisplayCode}
                    </span>
                  )}
                  {isClusterBibleStudy(displayGroup) && (
                    <span
                      className={`${STATUS_CHIP_CLASSNAME} flex-shrink-0`}
                      style={getStatusChipStyle("clusterBs")}
                    >
                      Cluster BS
                    </span>
                  )}
                  {(displayGroup.bible_sharer_ids?.length ?? 0) > 0 && (
                    <span
                      className={`${STATUS_CHIP_CLASSNAME} flex-shrink-0`}
                      style={getStatusChipStyle("primary")}
                    >
                      Bible Sharers
                    </span>
                  )}
                  {approvalChip && (
                    <span
                      className={`${STATUS_CHIP_CLASSNAME} flex-shrink-0`}
                      style={getStatusChipStyle(approvalChip.variant)}
                    >
                      {approvalChip.label}
                    </span>
                  )}
                  {!displayGroup.is_active && (
                    <span
                      className={`${STATUS_CHIP_CLASSNAME} flex-shrink-0`}
                      style={getStatusChipStyle("inactive")}
                    >
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-row flex-wrap items-center gap-x-3 gap-y-1 text-gray-700 sm:flex-col sm:items-start sm:gap-1">
                  <div className="flex items-center gap-1">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span className="text-sm font-normal">
                      {memberCount} members
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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
                    <span className="text-sm font-normal">
                      {visitorCount} visitors
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm text-gray-700 sm:grid-cols-2">
                {displayGroup.location && (
                  <div className="flex min-w-0 items-center gap-1">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 11a3 3 0 100-6 3 3 0 000 6z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                    <span className="min-w-0 break-words">
                      {displayGroup.location}
                    </span>
                  </div>
                )}
                {scheduleLine && (
                  <div className="flex min-w-0 items-center gap-1">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="min-w-0 break-words">{scheduleLine}</span>
                  </div>
                )}

                {coordinatorName && (
                  <div className="flex min-w-0 items-center gap-1">
                    <svg
                      className="h-4 w-4 shrink-0"
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
                    <span className="min-w-0 break-words font-normal">
                      {coordinatorName}
                    </span>
                  </div>
                )}
                {clusterBranch && (
                  <div className="flex min-w-0 items-center">
                    <span
                      className={CLUSTER_BRANCH_CHIP_CLASSNAME}
                      style={getBranchOutlineBadgeStyle(
                        clusterBranch.id,
                        clusterBranch.is_headquarters,
                      )}
                    >
                      <svg
                        className="h-3 w-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      {getBranchDisplayCode(clusterBranch)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {displayGroup.description && (
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <h3 className="mb-0.5 text-xs font-medium text-gray-500">
                  Description
                </h3>
                <p className="break-words whitespace-pre-wrap text-sm text-gray-600">
                  {displayGroup.description}
                </p>
              </div>
            )}

            <GroupMembersSection
              members={groupData?.members || []}
              coordinatorId={displayGroup.coordinator?.id}
              reporterIds={displayGroup.reporter_ids}
              bibleSharerIds={displayGroup.bible_sharer_ids}
              onAddMember={onAddMember}
              onBulkEnroll={onBulkEnroll}
              onRemoveMember={onRemoveMember}
              loading={groupLoading}
              canManage={canManageGroup}
            />

            <GroupReportsSection
              reports={reports}
              onAddReport={onAddReport}
              onViewReport={onViewReport}
              onEditReport={onEditReport}
              loading={reportsLoading}
              canSubmit={canSubmitReport}
            />

            <GroupProspectsSection
              prospects={prospects}
              onAddEncodedVisitor={onAddEncodedVisitor}
              onAddProspect={onAddProspect}
              onUpdateProgress={onUpdateProgress}
              onDelete={onDeleteProspect}
              loading={prospectsLoading}
              canAdd={Boolean(canManageGroup && canOperateGroup)}
            />

            <GroupPeopleProgressSection
              people={progressPeople}
              onAddProgress={
                canManageGroup && canOperateGroup
                  ? onAddPersonProgress
                  : undefined
              }
              onEditProgress={
                canManageGroup && canOperateGroup
                  ? onEditPersonProgress
                  : undefined
              }
              loading={progressPeopleLoading}
            />
          </div>
        )}
      </div>

      {(canManageGroup || canApproveGroup) && (
        <div
          className={`flex-shrink-0 border-t border-gray-200 ${
            isPanelMode ? "bg-white p-3" : "bg-gray-50 p-3 md:p-4"
          }`}
        >
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                onClick={onDelete}
                variant="secondary"
                className="flex h-10 min-h-[44px] flex-1 items-center justify-center space-x-2 border border-gray-200 bg-white px-4 text-sm font-medium !text-gray-700 hover:border-gray-300 hover:bg-gray-50 sm:flex-none"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Mark Inactive</span>
              </Button>
              {onHardDelete && (
                <Button
                  onClick={onHardDelete}
                  variant="secondary"
                  aria-label="Delete group permanently"
                  title="Delete group permanently"
                  className="flex h-10 min-h-[44px] shrink-0 items-center justify-center border border-red-200 bg-white px-4 text-sm font-medium !text-red-600 hover:border-red-300 hover:bg-red-50"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
              )}
            </div>
            <div className="flex min-w-0 sm:ml-auto sm:shrink-0 gap-2">
              {canApproveGroup && onReject && (
                <Button
                  onClick={onReject}
                  variant="secondary"
                  disabled={reviewLoading}
                  className="flex h-10 min-h-[44px] flex-1 items-center justify-center border border-red-200 bg-white px-4 text-sm font-medium !text-red-600 hover:border-red-300 hover:bg-red-50 sm:flex-none"
                >
                  Reject
                </Button>
              )}
              {canApproveGroup && onApprove && (
                <Button
                  onClick={onApprove}
                  disabled={reviewLoading}
                  className="flex h-10 min-h-[44px] flex-1 items-center justify-center px-4 text-sm font-medium sm:flex-none"
                >
                  {reviewLoading ? "Saving..." : "Approve"}
                </Button>
              )}
              {canManageGroup && (
              <Button
                onClick={onEdit}
                variant="secondary"
                className="flex h-10 min-h-[44px] w-full items-center justify-center space-x-2 border border-primary/20 bg-white px-4 text-sm font-medium !text-primary hover:border-primary/30 hover:bg-primary/10 sm:w-auto"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span>Edit</span>
              </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

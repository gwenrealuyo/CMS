"use client";

import { ReactNode } from "react";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import GroupConversionsSection from "@/src/components/evangelism/GroupConversionsSection";
import GroupMembersSection from "@/src/components/evangelism/GroupMembersSection";
import GroupProspectsSection from "@/src/components/evangelism/GroupProspectsSection";
import GroupReportsSection from "@/src/components/evangelism/GroupReportsSection";
import { resolveEvangelismGroupClusterMeta } from "@/src/lib/evangelismGroupDisplay";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";
import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import {
  Conversion,
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
} from "@/src/types/evangelism";
import { Person } from "@/src/types/person";

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
  conversions: Conversion[];
  conversionsLoading?: boolean;
  onAddMember: () => void;
  onBulkEnroll: () => void;
  onRemoveMember: (person: Person) => void;
  onAddReport: () => void;
  onViewReport: (report: EvangelismWeeklyReport) => void;
  onEditReport: (report: EvangelismWeeklyReport) => void;
  onAddProspect: () => void;
  onUpdateProgress: (prospect: Prospect) => void;
  onAddConversion: () => void;
  onEditConversion: (conversion: Conversion) => void;
  onEdit: () => void;
  onDelete: () => void;
  onHardDelete?: () => void;
  onClose: () => void;
}

function InfoField({
  icon,
  label,
  value,
  iconClassName = "text-primary",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className={`mt-0.5 flex-shrink-0 ${iconClassName}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="break-words font-medium">{value}</p>
      </div>
    </div>
  );
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
  conversions,
  conversionsLoading = false,
  onAddMember,
  onBulkEnroll,
  onRemoveMember,
  onAddReport,
  onViewReport,
  onEditReport,
  onAddProspect,
  onUpdateProgress,
  onAddConversion,
  onEditConversion,
  onDelete,
  onHardDelete,
  onClose,
  onEdit,
}: EvangelismGroupViewProps) {
  const displayGroup = groupData ?? group;
  const { clusterBranch } = resolveEvangelismGroupClusterMeta(
    displayGroup,
    clusters,
    branches
  );
  const branchCode = clusterBranch?.code || "N/A";

  return (
    <div className="flex h-full min-h-0 flex-col -m-4 md:-m-0">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-3 md:p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-gray-900">Group Details</h2>
          <p className="mt-0.5 truncate text-xs text-gray-600 md:text-[11px]">
            {group.name || "Untitled Group"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {displayGroup.is_bible_sharers_group && (
              <span
                className={STATUS_CHIP_CLASSNAME}
                style={getStatusChipStyle("primary")}
              >
                Bible Sharers
              </span>
            )}
            {!displayGroup.is_active && (
              <span
                className={STATUS_CHIP_CLASSNAME}
                style={getStatusChipStyle("inactive")}
              >
                Inactive
              </span>
            )}
          </div>
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

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
        {groupLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4 md:space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                }
                label="Coordinator"
                value={groupData?.coordinator?.full_name || "N/A"}
              />
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                }
                label="Cluster"
                value={groupData?.cluster?.name || "N/A"}
              />
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h10M7 11h10M7 15h10M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
                    />
                  </svg>
                }
                label="Branch Code"
                value={branchCode}
              />
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                }
                label="Location"
                value={groupData?.location || "N/A"}
              />
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
                label="Meeting Time"
                value={
                  <>
                    {groupData?.meeting_day}{" "}
                    {groupData?.meeting_time || ""}
                  </>
                }
              />
            </div>

            {groupData?.description && (
              <InfoField
                icon={
                  <svg
                    className="h-5 w-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                label="Description"
                value={groupData.description}
              />
            )}

            <GroupMembersSection
              members={groupData?.members || []}
              onAddMember={onAddMember}
              onBulkEnroll={onBulkEnroll}
              onRemoveMember={onRemoveMember}
              loading={groupLoading}
            />

            <GroupReportsSection
              reports={reports}
              onAddReport={onAddReport}
              onViewReport={onViewReport}
              onEditReport={onEditReport}
              loading={reportsLoading}
            />

            <GroupProspectsSection
              prospects={prospects}
              onAddProspect={onAddProspect}
              onUpdateProgress={onUpdateProgress}
              loading={prospectsLoading}
            />

            <GroupConversionsSection
              conversions={conversions}
              onAddConversion={onAddConversion}
              onEditConversion={onEditConversion}
              loading={conversionsLoading}
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-4 md:px-6">
        <div className="flex w-full flex-col gap-3 md:hidden">
          <Button
            onClick={onEdit}
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center space-x-2 border border-primary/30 bg-white px-4 py-3 text-sm font-medium !text-primary hover:border-lighthouse-gold hover:bg-primary/10"
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
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center space-x-2 border border-gray-300 bg-white px-4 py-3 text-sm font-medium !text-gray-700 hover:border-gray-400 hover:bg-gray-50"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Cancel</span>
          </Button>
          <div className="my-1 border-t border-gray-200" />
          <Button
            onClick={onDelete}
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center space-x-2 border border-gray-200 bg-white px-4 py-3 text-sm font-medium !text-gray-700 hover:border-gray-300 hover:bg-gray-50"
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
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Mark Inactive</span>
          </Button>
          {onHardDelete && (
          <Button
            onClick={onHardDelete}
            variant="secondary"
            className="flex min-h-[44px] w-full items-center justify-center space-x-2 border border-red-300 bg-white px-4 py-3 text-sm font-medium !text-red-600 hover:border-red-400 hover:bg-red-50"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete</span>
          </Button>
          )}
        </div>

        <div className="hidden w-full items-center justify-between md:flex">
          <div className="flex items-center gap-2">
            <Button
              onClick={onDelete}
              variant="secondary"
              className="flex min-h-[44px] items-center justify-center border border-gray-200 bg-white px-4 text-sm font-normal !text-gray-700 hover:border-gray-300 hover:bg-gray-50 md:py-4"
              aria-label="Mark group inactive"
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
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Button>
            {onHardDelete && (
            <Button
              onClick={onHardDelete}
              variant="secondary"
              className="flex min-h-[44px] items-center justify-center border border-red-200 bg-white px-4 text-sm font-normal !text-red-600 hover:border-red-300 hover:bg-red-50 md:py-4"
              aria-label="Delete group permanently"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              variant="secondary"
              className="flex min-h-[44px] items-center justify-center space-x-2 border border-gray-200 bg-white px-6 text-sm font-normal !text-black hover:border-gray-300 hover:bg-gray-50 md:py-4"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Cancel</span>
            </Button>
            <Button
              onClick={onEdit}
              variant="secondary"
              className="flex min-h-[44px] items-center justify-center space-x-2 border border-primary/20 bg-white px-6 text-sm font-normal !text-primary hover:border-primary/30 hover:bg-primary/10 md:py-4"
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
          </div>
        </div>
      </div>
    </div>
  );
}

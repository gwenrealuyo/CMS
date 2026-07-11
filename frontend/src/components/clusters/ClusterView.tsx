import { useEffect, useMemo, useRef, useState } from "react";
import { Cluster } from "@/src/types/cluster";
import { Person, Family } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";
import { useBranches } from "@/src/hooks/useBranches";
import {
  CLUSTER_BRANCH_CHIP_CLASSNAME,
  CLUSTER_CODE_BADGE_CLASSNAME,
  getBranchOutlineBadgeStyle,
  getClusterCodeBadgeStyle,
  getBranchDisplayCode,
} from "@/src/lib/branchChipColor";
import { getPersonRoleColor } from "@/src/lib/personRole";
import PersonAvatar from "@/src/components/people/PersonAvatar";

type SortField =
  | "first_name"
  | "last_name"
  | "date_first_attended"
  | "water_baptism_date";

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function DeleteClusterButton({
  onClick,
  buttonClassName = "h-10 px-4 text-sm font-medium",
  fullWidth = false,
}: {
  onClick: () => void;
  buttonClassName?: string;
  fullWidth?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      variant="secondary"
      aria-label="Delete cluster permanently"
      title="Delete cluster permanently"
      className={`!text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center !min-h-0 ${
        fullWidth ? "w-full" : "shrink-0"
      } ${buttonClassName}`}
    >
      <TrashIcon />
    </Button>
  );
}

interface ClusterViewProps {
  cluster: Cluster;
  clusterMembers: Person[];
  clusterFamilies: Family[];
  coordinator?: Person;
  onEdit: () => void;
  onDelete: () => void;
  onHardDelete?: () => void;
  onCancel: () => void;
  onClose: () => void;
  onAssignMembers: () => void;
  onSubmitReport: () => void;
  onViewPerson?: (person: Person) => void;
  onViewFamily?: (family: Family) => void;
  showTopHeader?: boolean;
  /** When false, hides the Members-section Submit Report action (e.g. module-wide users use Reports tab). Default true. */
  showSubmitReportButton?: boolean;
  /** When false, hides Edit, Delete, and Assign Members actions. */
  canManageCluster?: boolean;
}

export default function ClusterView({
  cluster,
  clusterMembers,
  clusterFamilies,
  coordinator,
  onEdit,
  onDelete,
  onHardDelete,
  onCancel,
  onClose,
  onAssignMembers,
  onSubmitReport,
  onViewPerson,
  onViewFamily,
  showTopHeader = true,
  showSubmitReportButton = true,
  canManageCluster = true,
}: ClusterViewProps) {
  const { branches } = useBranches();
  const [sortBy, setSortBy] = useState<SortField>("last_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortButtonRef.current &&
        sortDropdownRef.current &&
        !sortButtonRef.current.contains(event.target as Node) &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSortDropdown]);

  // Find the branch for this cluster
  const clusterBranch = cluster.branch
    ? branches.find((b) => b.id === cluster.branch)
    : null;

  // Calculate member and visitor counts
  // Members: role is NOT "ADMIN" and NOT "VISITOR" (includes MEMBER, PASTOR, etc.)
  // Visitors: role is "VISITOR"
  // ADMIN is excluded from both counts

  // Check if coordinator is already in clusterMembers to avoid double counting
  const coordinatorInMembers = coordinator
    ? clusterMembers.some((m) => m.id === coordinator.id)
    : false;

  // Calculate members: all people who are not ADMIN or VISITOR
  const memberCountFromCluster = clusterMembers.filter(
    (member) => member.role !== "ADMIN" && member.role !== "VISITOR",
  ).length;

  // Add coordinator to member count only if not already in clusterMembers and is not ADMIN/VISITOR
  const memberCount =
    memberCountFromCluster +
    (coordinator &&
    !coordinatorInMembers &&
    coordinator.role !== "ADMIN" &&
    coordinator.role !== "VISITOR"
      ? 1
      : 0);

  // Calculate visitors: all people with VISITOR role
  const visitorCountFromCluster = clusterMembers.filter(
    (member) => member.role === "VISITOR",
  ).length;

  // Add coordinator to visitor count only if not already in clusterMembers and is VISITOR
  const visitorCount =
    visitorCountFromCluster +
    (coordinator && !coordinatorInMembers && coordinator.role === "VISITOR"
      ? 1
      : 0);

  const formatFullName = (person: Person) => formatPersonName(person);
  const isPanelMode = !showTopHeader;

  const sortedDisplayMembers = useMemo(() => {
    const getAttendanceDate = (person: Person) => {
      const uiDate = (person as Person & { dateFirstAttended?: string })
        .dateFirstAttended;
      return uiDate || person.date_first_attended || "";
    };

    const combined = [...clusterMembers];
    if (
      coordinator &&
      !combined.some((member) => member.id === coordinator.id)
    ) {
      combined.push(coordinator);
    }

    return combined.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case "first_name":
          aValue = (a.first_name || "").toLowerCase();
          bValue = (b.first_name || "").toLowerCase();
          break;
        case "last_name":
          aValue = (a.last_name || "").toLowerCase();
          bValue = (b.last_name || "").toLowerCase();
          break;
        case "date_first_attended": {
          const aDate = getAttendanceDate(a);
          const bDate = getAttendanceDate(b);
          aValue = aDate ? new Date(aDate).getTime() : 0;
          bValue = bDate ? new Date(bDate).getTime() : 0;
          break;
        }
        case "water_baptism_date":
          aValue = a.water_baptism_date
            ? new Date(a.water_baptism_date).getTime()
            : 0;
          bValue = b.water_baptism_date
            ? new Date(b.water_baptism_date).getTime()
            : 0;
          break;
        default:
          aValue = (a.last_name || "").toLowerCase();
          bValue = (b.last_name || "").toLowerCase();
      }

      if (sortBy === "last_name" && aValue === bValue) {
        aValue = (a.first_name || "").toLowerCase();
        bValue = (b.first_name || "").toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [clusterMembers, coordinator, sortBy, sortOrder]);

  const handleSortSelect = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setShowSortDropdown(false);
  };

  const sortedCoreMembers = useMemo(
    () =>
      sortedDisplayMembers.filter(
        (p) => p.role !== "ADMIN" && p.role !== "VISITOR",
      ),
    [sortedDisplayMembers],
  );

  const sortedVisitors = useMemo(
    () => sortedDisplayMembers.filter((p) => p.role === "VISITOR"),
    [sortedDisplayMembers],
  );

  const roleBadgeClass = (role: string) => getPersonRoleColor(role);

  const peopleGridClass =
    isPanelMode
      ? "grid gap-2 grid-cols-1 sm:grid-cols-2"
      : "grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  const renderPersonCard = (member: Person) => {
    if (isPanelMode) {
      const memberName = formatFullName(member);
      const isLongWrappedName = memberName.length > 20;
      return (
        <div
          key={member.id}
          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
          onClick={() => onViewPerson && onViewPerson(member)}
        >
          <PersonAvatar person={member} size="sm" />
          <div className="flex-1 min-w-0">
            <p
              className={`font-medium text-gray-900 break-words ${
                isLongWrappedName ? "text-xs leading-5" : "text-sm leading-5"
              }`}
            >
              {memberName}
            </p>
            <div className="">
              <span
                className={`inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium ${roleBadgeClass(member.role)}`}
              >
                {member.role}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div
        key={member.id}
        className="p-2.5 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 flex items-center space-x-2"
        onClick={() => onViewPerson && onViewPerson(member)}
      >
        <PersonAvatar person={member} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate text-sm">
            {formatFullName(member)}
          </p>
          <p className="text-xs text-gray-600 truncate">{member.email}</p>
        </div>
        <span
          className={`inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium ${roleBadgeClass(member.role)}`}
        >
          {member.role}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      {showTopHeader && (
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-900">
              Cluster Details
            </h2>
            <p className="text-xs md:text-[11px] text-gray-600 mt-0.5 truncate">
              {cluster.name || "Untitled Cluster"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-red-600 hover:text-red-700 text-xl font-bold p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
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

      {/* Content */}
      <div
        className={`${
          isPanelMode ? "p-3 sm:p-4" : "p-4 md:p-5"
        } overflow-y-auto flex-1`}
      >
        <div
          className={`${isPanelMode ? "space-y-3 sm:space-y-4" : "space-y-4 md:space-y-5"}`}
        >
          {/* Cluster Info Card */}
          <div
            className={`rounded-lg p-4 border ${
              isPanelMode
                ? "bg-white border-gray-200 shadow-sm"
                : "bg-gradient-to-r from-lighthouse-ivory to-muted border-primary/20"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                <h2
                  className={`${
                    isPanelMode
                      ? "text-xl break-words"
                      : "text-lg md:text-xl truncate"
                  } font-bold text-gray-900`}
                >
                  {cluster.name || "Untitled Cluster"}
                </h2>
                {cluster.code && (
                  <span
                    className={`${CLUSTER_CODE_BADGE_CLASSNAME} flex-shrink-0`}
                    style={getClusterCodeBadgeStyle(
                      clusterBranch?.id,
                      clusterBranch?.is_headquarters
                    )}
                  >
                    {cluster.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-gray-700 flex-wrap">
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
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
                    className="w-4 h-4"
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
            <div
              className={`${isPanelMode ? "space-y-2" : "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"} text-sm text-gray-700`}
            >
              <div className="flex items-center gap-4 flex-wrap">
                {(cluster as any).location && (
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
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
                    <span>{(cluster as any).location}</span>
                  </div>
                )}
                {(cluster as any).meeting_schedule && (
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
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
                    <span>{(cluster as any).meeting_schedule}</span>
                  </div>
                )}
                {clusterBranch && (
                  <span
                    className={CLUSTER_BRANCH_CHIP_CLASSNAME}
                    style={getBranchOutlineBadgeStyle(
                      clusterBranch.id,
                      clusterBranch.is_headquarters
                    )}
                  >
                    <svg
                      className="w-3 h-3 shrink-0"
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
                )}
              </div>
              {coordinator && (
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
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
                  <span className="font-normal break-words">
                    {formatFullName(coordinator)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {cluster.description && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Description
              </h3>
              <p className="text-gray-600">{cluster.description}</p>
            </div>
          )}

          {/* Members & visitors */}
          {(sortedCoreMembers.length > 0 || sortedVisitors.length > 0) && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">
                  {sortedCoreMembers.length > 0
                    ? `Members (${memberCount})`
                    : `Visitors (${visitorCount})`}
                </h3>
                <div
                  className={`flex ${
                    isPanelMode ? "flex-row" : "flex-col sm:flex-row"
                  } gap-2 w-full sm:w-auto`}
                >
                  <div className="relative">
                    <button
                      ref={sortButtonRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSortDropdown(!showSortDropdown);
                      }}
                      className="inline-flex items-center justify-center px-3 py-2.5 md:py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors min-h-[44px] md:min-h-0 w-full sm:w-auto"
                    >
                      <svg
                        className="w-4 h-4 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        />
                      </svg>
                      Sort
                    </button>

                    {showSortDropdown && (
                      <div
                        ref={sortDropdownRef}
                        className="fixed w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-w-[calc(100vw-2rem)]"
                        style={{
                          top: sortButtonRef.current
                            ? `${
                                sortButtonRef.current.getBoundingClientRect()
                                  .bottom + 4
                              }px`
                            : "0",
                          right: sortButtonRef.current
                            ? Math.max(
                                16,
                                window.innerWidth -
                                  sortButtonRef.current.getBoundingClientRect()
                                    .right,
                              )
                            : "16",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => handleSortSelect("last_name")}
                            className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                              sortBy === "last_name"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Last Name
                            {sortBy === "last_name" && (
                              <span className="ml-2">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSortSelect("first_name")}
                            className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                              sortBy === "first_name"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            First Name
                            {sortBy === "first_name" && (
                              <span className="ml-2">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSortSelect("date_first_attended")
                            }
                            className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                              sortBy === "date_first_attended"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Date First Attended
                            {sortBy === "date_first_attended" && (
                              <span className="ml-2">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSortSelect("water_baptism_date")
                            }
                            className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                              sortBy === "water_baptism_date"
                                ? "bg-primary/10 text-primary"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            Water Baptism Date
                            {sortBy === "water_baptism_date" && (
                              <span className="ml-2">
                                {sortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {canManageCluster && (
                    <Button
                      onClick={onAssignMembers}
                      variant="secondary"
                      className="!text-white !py-2.5 md:!py-2 !px-3 text-sm leading-4 !font-medium bg-green-600 border border-green-600 hover:bg-green-700 hover:border-green-700 flex items-center justify-center space-x-2 !min-h-[44px] md:!min-h-0 !rounded-lg w-full sm:w-auto"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span>Assign Members</span>
                    </Button>
                  )}
                  {showSubmitReportButton && (
                    <Button
                      onClick={onSubmitReport}
                      variant="secondary"
                      className="!text-primary !py-2.5 md:!py-2 !px-3 text-sm leading-4 !font-medium bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 flex items-center justify-center space-x-2 !min-h-[44px] md:!min-h-0 !rounded-lg w-full sm:w-auto"
                    >
                      <svg
                        className="w-4 h-4"
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
                      <span>Submit Report</span>
                    </Button>
                  )}
                </div>
              </div>
              {sortedCoreMembers.length > 0 && (
                <div
                  className={`${peopleGridClass}${
                    sortedVisitors.length > 0 ? " mb-6" : ""
                  }`}
                >
                  {sortedCoreMembers.map((member) => renderPersonCard(member))}
                </div>
              )}
              {sortedVisitors.length > 0 && sortedCoreMembers.length > 0 && (
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
                  Visitors ({visitorCount})
                </h3>
              )}
              {sortedVisitors.length > 0 && (
                <div className={peopleGridClass}>
                  {sortedVisitors.map((member) => renderPersonCard(member))}
                </div>
              )}
            </div>
          )}

          {/* Families */}
          {clusterFamilies.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Families ({clusterFamilies.length})
              </h3>
              <div
                className={`grid gap-2 ${
                  isPanelMode
                    ? "grid-cols-1"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {clusterFamilies.map((family) => (
                  <div
                    key={family.id}
                    className="p-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                    onClick={() => onViewFamily && onViewFamily(family)}
                  >
                    <h4 className="font-medium text-gray-900 text-sm">
                      {family.name}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {family.members.length} members
                    </p>
                    {family.address && (
                      <p className="text-xs text-gray-500 mt-1">
                        {family.address}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty States */}
          {clusterMembers.length === 0 &&
            clusterFamilies.length === 0 &&
            !coordinator && (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No members or families
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  This cluster doesn&rsquo;t have any members or families
                  assigned yet.
                </p>
                {canManageCluster && (
                  <div className="mt-4">
                    <Button
                      onClick={onAssignMembers}
                      variant="secondary"
                      className="!text-white py-2 px-4 text-sm font-normal bg-green-600 border border-green-600 hover:bg-green-700 hover:border-green-700 flex items-center justify-center space-x-2 mx-auto"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span>Assign Members</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Footer */}
      {isPanelMode ? (
        <div className="flex flex-nowrap items-center gap-2 p-3 border-t border-gray-200 bg-white w-full overflow-x-auto">
          {canManageCluster ? (
            <>
              <div className="flex flex-nowrap items-center gap-2 shrink-0">
                <Button
                  onClick={onDelete}
                  variant="secondary"
                  className="!text-gray-700 h-10 px-4 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 shrink-0"
                  aria-label="Mark cluster inactive"
                >
                  <svg
                    className="w-4 h-4"
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
                  <DeleteClusterButton onClick={onHardDelete} />
                )}
              </div>
              <div className="flex flex-nowrap items-center gap-2 shrink-0 ml-auto">
                <Button
                  onClick={onEdit}
                  variant="secondary"
                  className="!text-primary h-10 px-4 text-sm font-medium bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 flex items-center justify-center space-x-2 shrink-0"
                >
                  <svg
                    className="w-4 h-4"
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
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 p-4 md:p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 w-full md:w-auto md:order-2">
            <Button
              onClick={onCancel}
              variant="secondary"
              className="!text-black md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full md:w-auto md:hidden"
            >
              <svg
                className="w-4 h-4"
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
            {canManageCluster && (
              <Button
                onClick={onEdit}
                variant="secondary"
                className="!text-primary md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-primary/20 hover:bg-primary/10 hover:border-primary/30 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full md:w-auto"
              >
                <svg
                  className="w-4 h-4"
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
          {canManageCluster && (
            <div className="md:order-1">
              <div className="border-t border-gray-200 my-2 md:hidden"></div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                  onClick={onDelete}
                  variant="secondary"
                  className="!text-gray-700 py-3 px-4 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px] flex-1 md:flex-none md:py-4 md:px-4 md:text-sm md:font-normal"
                  aria-label="Mark cluster inactive"
                >
                  <svg
                    className="w-4 h-4"
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
                  <DeleteClusterButton
                    onClick={onHardDelete}
                    buttonClassName="min-h-[44px] px-4 text-sm font-medium md:py-4 md:text-sm md:font-normal"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

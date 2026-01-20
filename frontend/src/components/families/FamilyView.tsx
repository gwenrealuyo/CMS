import React, { useState, useMemo, useEffect, useRef } from "react";
import { Family, PersonUI } from "@/src/types/person";
import { Cluster } from "@/src/types/cluster";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";

interface FamilyViewProps {
  family: Family;
  familyMembers: PersonUI[];
  clusters?: Cluster[];
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onAddMember?: () => void;
  onViewPerson?: (person: PersonUI) => void;
  hideEditButton?: boolean;
  hideDeleteButton?: boolean;
}

type SortField =
  | "first_name"
  | "last_name"
  | "date_first_attended"
  | "water_baptism_date";

export default function FamilyView({
  family,
  familyMembers,
  clusters,
  onEdit,
  onDelete,
  onCancel,
  onClose,
  onAddMember,
  onViewPerson,
  hideEditButton = false,
  hideDeleteButton = false,
}: FamilyViewProps) {
  const [sortBy, setSortBy] = useState<SortField>("last_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortButtonRef.current &&
        dropdownRef.current &&
        !sortButtonRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
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

  // Sort members
  const sortedMembers = useMemo(() => {
    const sorted = [...familyMembers];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "first_name":
          aValue = (a.first_name || "").toLowerCase();
          bValue = (b.first_name || "").toLowerCase();
          break;
        case "last_name":
          aValue = (a.last_name || "").toLowerCase();
          bValue = (b.last_name || "").toLowerCase();
          break;
        case "date_first_attended":
          aValue = a.dateFirstAttended
            ? new Date(a.dateFirstAttended).getTime()
            : 0;
          bValue = b.dateFirstAttended
            ? new Date(b.dateFirstAttended).getTime()
            : 0;
          break;
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

      // If last_name is selected and values are equal, sort by first_name as secondary
      if (sortBy === "last_name" && aValue === bValue) {
        aValue = (a.first_name || "").toLowerCase();
        bValue = (b.first_name || "").toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [familyMembers, sortBy, sortOrder]);

  const handleSortSelect = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setShowSortDropdown(false);
  };

  const getInitials = (person: PersonUI) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

  const formatFullName = (person: PersonUI) => formatPersonName(person);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // All family members are displayed together - no separation in the model

  const getLeader = () => {
    if (!family.leader) return null;
    return familyMembers.find((member) => member.id === family.leader);
  };

  const leader = getLeader();

  // Get unique branch names from family members
  const getFamilyBranches = () => {
    const branches = familyMembers
      .map((member) => member.branch_name)
      .filter((branch): branch is string => Boolean(branch));
    const uniqueBranches = Array.from(new Set(branches));
    return uniqueBranches;
  };

  const familyBranches = getFamilyBranches();

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm sm:text-base font-medium text-gray-900">Family Details</h2>
          <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5 truncate">
            The {family.name} Family
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

      {/* Content */}
      <div className="p-4 sm:p-5 overflow-y-auto flex-1">
        <div className="space-y-4">
          {/* Family Header Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 sm:p-4 border border-blue-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                The {family.name} Family
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                {familyMembers.length} members • Since{" "}
                {familyMembers[0]?.dateFirstAttended
                  ? new Date(
                      familyMembers[0].dateFirstAttended
                    ).toLocaleDateString()
                  : "Unknown"}
                {family.address && (
                  <>
                    {" • "}
                    <span className="text-gray-700">{family.address}</span>
                  </>
                )}
                {familyBranches.length > 0 && (
                  <>
                    {" • "}
                    <span className="text-gray-700">
                      Branch: {familyBranches.join(", ")}
                    </span>
                  </>
                )}
              </p>
              {leader && (
                <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1">
                  Family Leader: {formatFullName(leader)}
                </p>
              )}
            </div>
          </div>

          {/* Family Members */}
          {(familyMembers.length > 0 || onAddMember) && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Members ({familyMembers.length})
                </h3>
                <div className="relative">
                  <button
                    ref={sortButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSortDropdown(!showSortDropdown);
                    }}
                    className="inline-flex items-center px-3 py-2 sm:py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-h-[44px] sm:min-h-0 w-full sm:w-auto"
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

                  {/* Sort Dropdown */}
                  {showSortDropdown && (
                    <div
                      ref={dropdownRef}
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
                                  .right
                            )
                          : "16",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        <button
                          onClick={() => handleSortSelect("last_name")}
                          className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                            sortBy === "last_name"
                              ? "bg-blue-50 text-blue-600"
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
                          onClick={() => handleSortSelect("first_name")}
                          className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                            sortBy === "first_name"
                              ? "bg-blue-50 text-blue-600"
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
                          onClick={() =>
                            handleSortSelect("date_first_attended")
                          }
                          className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                            sortBy === "date_first_attended"
                              ? "bg-blue-50 text-blue-600"
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
                          onClick={() => handleSortSelect("water_baptism_date")}
                          className={`block w-full text-left px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0 ${
                            sortBy === "water_baptism_date"
                              ? "bg-blue-50 text-blue-600"
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
              </div>
              {familyMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3">
                  {sortedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-2.5 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 min-h-[60px] sm:min-h-0"
                      onClick={() => onViewPerson && onViewPerson(member)}
                    >
                      <div className="w-10 h-10 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {getInitials(member)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-sm font-medium text-gray-900 truncate">
                          {formatFullName(member)}
                        </h4>
                        <div className="flex items-center gap-1 sm:space-x-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                              member.status
                            )}`}
                          >
                            {member.status.toLowerCase()}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(
                              member.role
                            )}`}
                          >
                            {member.role.toLowerCase()}
                          </span>
                          {/* Cluster badge */}
                          {(() => {
                            if (!clusters || clusters.length === 0) {
                              return (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                                  No cluster
                                </span>
                              );
                            }
                            const c = clusters.find((c) =>
                              (c as any).members?.includes(member.id)
                            );
                            return (
                              <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  c
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {c
                                  ? c.code
                                    ? c.code
                                    : c.name ?? "Cluster"
                                  : "No cluster"}
                              </span>
                            );
                          })()}
                          {member.id === family.leader && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                              Leader
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No family members yet
                </div>
              )}
            </div>
          )}

          {/* Family Notes */}
          {family.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Notes
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 break-words">{family.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
        {/* Mobile: Primary actions on top */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto sm:order-2">
          <Button
            onClick={onCancel}
            variant="secondary"
            className="!text-black md:py-4 px-4 sm:px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
          {onAddMember && (
            <Button
              onClick={onAddMember}
              variant="secondary"
              className="!text-green-600 md:py-4 px-4 sm:px-6 text-sm font-normal bg-white border border-green-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
              <span>Add Member</span>
            </Button>
          )}
          {!hideEditButton && (
            <Button
              onClick={onEdit}
              variant="secondary"
              className="!text-blue-600 md:py-4 px-4 sm:px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
        {/* Mobile: Delete at bottom with divider */}
        {!hideDeleteButton && (
          <div className="sm:order-1">
            <div className="border-t border-gray-200 my-2 sm:hidden"></div>
            <Button
              onClick={onDelete}
              variant="secondary"
              className="!text-red-600 md:py-4 px-4 sm:px-4 md:px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span className="md:hidden">Delete</span>
            </Button>
          </div>
        )}
        {hideDeleteButton && <div className="sm:order-1" />}
      </div>
    </div>
  );
}

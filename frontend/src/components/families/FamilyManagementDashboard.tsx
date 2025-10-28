import React, { useState, useMemo, useEffect } from "react";
import { Family, Person, PersonUI } from "@/src/types/person";
import Button from "@/src/components/ui/Button";
import ActionMenu from "./ActionMenu";
import FamilyFilterDropdown from "./FamilyFilterDropdown";
import ClusterFilterCard from "../clusters/ClusterFilterCard";
import { FilterCondition } from "../people/FilterBar";

interface SortOption {
  key: string;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: "name", label: "Family Name" },
  { key: "member_count", label: "Member Count" },
  { key: "visitor_count", label: "Visitor Count" },
];

interface FamilyManagementDashboardProps {
  families: Family[];
  people: PersonUI[];
  onCreateFamily: () => void;
  onViewFamily: (family: Family) => void;
  onEditFamily: (family: Family) => void;
  onDeleteFamily: (family: Family) => void;
  onViewPerson: (person: PersonUI) => void;
  onAssignMember: (personId: string, familyId: string) => void;
  onRemoveMember: (personId: string, familyId: string) => void;
}

export default function FamilyManagementDashboard({
  families,
  people,
  onCreateFamily,
  onViewFamily,
  onEditFamily,
  onDeleteFamily,
  onViewPerson,
  onAssignMember,
  onRemoveMember,
}: FamilyManagementDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [unassignedPage, setUnassignedPage] = useState(1);
  const UNASSIGNED_PAGE_SIZE = 24; // 3 cols * 8 rows fits most screens
  const [familyPage, setFamilyPage] = useState(1);
  const FAMILY_PAGE_SIZE = 10; // Show 10 families per page
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortButtonRef = React.useRef<HTMLButtonElement>(null);
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);
  const [showUnassignedMembers, setShowUnassignedMembers] = useState(false);
  const [familyFilters, setFamilyFilters] = useState<FilterCondition[]>([]);
  const [showFamilyFilterDropdown, setShowFamilyFilterDropdown] =
    useState(false);
  const [familyFilterDropdownPosition, setFamilyFilterDropdownPosition] =
    useState({
      top: 0,
      left: 0,
    });
  const familyFilterButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showFamilyFilterCard, setShowFamilyFilterCard] = useState(false);
  const [familyFilterCardPosition, setFamilyFilterCardPosition] = useState({
    top: 0,
    left: 0,
  });
  const [selectedFamilyField, setSelectedFamilyField] = useState<any>(null);

  // Family filter dropdown handles its own click-outside; no parent listener needed

  const handleFamilyFilterClick = () => {
    if (!familyFilterButtonRef.current) return;
    const rect = familyFilterButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 256;
    const viewportWidth = window.innerWidth;
    const rightEdge = rect.left + dropdownWidth;

    let left = rect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }

    setFamilyFilterDropdownPosition({
      top: rect.bottom + 8,
      left: left,
    });
    setShowFamilyFilterDropdown(true);
  };

  // Get unassigned members (people not in any family)
  const unassignedMembers = useMemo(() => {
    const assignedMemberIds = new Set(
      families.flatMap((family) => family.members)
    );
    return people.filter(
      (person) =>
        !assignedMemberIds.has(person.id) &&
        person.role !== "ADMIN" &&
        person.username !== "admin"
    );
  }, [families, people]);

  // Scalable: filter + paginate unassigned members
  const filteredUnassignedMembers = useMemo(() => {
    if (!unassignedSearch.trim()) return unassignedMembers;
    const q = unassignedSearch.toLowerCase();
    return unassignedMembers.filter((p) =>
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(q)
    );
  }, [unassignedMembers, unassignedSearch]);

  const totalUnassignedPages = Math.max(
    1,
    Math.ceil(filteredUnassignedMembers.length / UNASSIGNED_PAGE_SIZE)
  );

  const visibleUnassignedMembers = useMemo(() => {
    const start = (unassignedPage - 1) * UNASSIGNED_PAGE_SIZE;
    return filteredUnassignedMembers.slice(start, start + UNASSIGNED_PAGE_SIZE);
  }, [filteredUnassignedMembers, unassignedPage]);

  // Filter families based on search query and active filters
  const filteredFamilies = useMemo(() => {
    let result = families;

    // Text search on name
    if (searchQuery) {
      result = result.filter((family) =>
        family.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply structured filters
    for (const filter of familyFilters) {
      switch (filter.field) {
        case "name": {
          const val = String(filter.value).toLowerCase();
          result = result.filter((family) => {
            const name = family.name.toLowerCase();
            switch (filter.operator) {
              case "contains":
                return name.includes(val);
              case "is":
                return name === val;
              case "is_not":
                return name !== val;
              case "starts_with":
                return name.startsWith(val);
              case "ends_with":
                return name.endsWith(val);
              default:
                return true;
            }
          });
          break;
        }
        case "member_count": {
          const count = (family: Family) => family.members.length;
          if (Array.isArray(filter.value)) {
            const [min, max] = filter.value as [string, string];
            const minNum = parseInt(min);
            const maxNum = parseInt(max);
            result = result.filter(
              (f) => count(f) >= minNum && count(f) <= maxNum
            );
          } else {
            const num = parseInt(String(filter.value));
            switch (filter.operator) {
              case "greater_than":
                result = result.filter((f) => count(f) > num);
                break;
              case "less_than":
                result = result.filter((f) => count(f) < num);
                break;
              case "is":
                result = result.filter((f) => count(f) === num);
                break;
              case "is_not":
                result = result.filter((f) => count(f) !== num);
                break;
              default:
                break;
            }
          }
          break;
        }
        case "visitor_count": {
          const countVisitors = (family: Family) =>
            family.members.filter((id) => {
              const p = people.find((pp) => pp.id === id);
              return p?.role === "VISITOR";
            }).length;
          if (Array.isArray(filter.value)) {
            const [min, max] = filter.value as [string, string];
            const minNum = parseInt(min);
            const maxNum = parseInt(max);
            result = result.filter(
              (f) => countVisitors(f) >= minNum && countVisitors(f) <= maxNum
            );
          } else {
            const num = parseInt(String(filter.value));
            switch (filter.operator) {
              case "greater_than":
                result = result.filter((f) => countVisitors(f) > num);
                break;
              case "less_than":
                result = result.filter((f) => countVisitors(f) < num);
                break;
              case "is":
                result = result.filter((f) => countVisitors(f) === num);
                break;
              case "is_not":
                result = result.filter((f) => countVisitors(f) !== num);
                break;
              default:
                break;
            }
          }
          break;
        }
        default:
          break;
      }
    }

    return result;
  }, [families, searchQuery, familyFilters, people]);

  // Sort families
  const sortedFamilies = useMemo(() => {
    const sorted = [...filteredFamilies];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "member_count":
          aValue = a.members.length;
          bValue = b.members.length;
          break;
        case "visitor_count":
          // Count visitors by checking member roles
          const aVisitors = a.members.filter((memberId) => {
            const person = people.find((p) => p.id === memberId);
            return person?.role === "VISITOR";
          }).length;
          const bVisitors = b.members.filter((memberId) => {
            const person = people.find((p) => p.id === memberId);
            return person?.role === "VISITOR";
          }).length;
          aValue = aVisitors;
          bValue = bVisitors;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredFamilies, sortBy, sortOrder, people]);

  // Paginate families
  const totalFamilyPages = Math.max(
    1,
    Math.ceil(sortedFamilies.length / FAMILY_PAGE_SIZE)
  );

  const visibleFamilies = useMemo(() => {
    const start = (familyPage - 1) * FAMILY_PAGE_SIZE;
    return sortedFamilies.slice(start, start + FAMILY_PAGE_SIZE);
  }, [sortedFamilies, familyPage]);

  // Handle click outside sort dropdown (consider button and dropdown refs)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSortDropdown &&
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

  const handleSortSelect = (
    newSortBy: string,
    newSortOrder: "asc" | "desc"
  ) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setShowSortDropdown(false);
    setFamilyPage(1);
  };

  const getSortButtonPosition = () => {
    if (!sortButtonRef.current) return { top: 0, left: 0 };
    const rect = sortButtonRef.current.getBoundingClientRect();
    const dropdownWidth = 256; // w-64
    const viewportWidth = window.innerWidth;
    const rightEdge = rect.left + dropdownWidth;

    let left = rect.left;
    if (rightEdge > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }

    return {
      top: rect.bottom + 8,
      left: left,
    };
  };

  // Get person details for a given ID
  const getPersonById = (id: string) => {
    return people.find((person) => person.id === id);
  };

  // Get initials for avatar
  const getInitials = (person: PersonUI) => {
    return `${person.first_name?.[0] || ""}${
      person.last_name?.[0] || ""
    }`.toUpperCase();
  };

  // Get status color
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

  // Get role color
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

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">
                Total Families
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {families.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 14a4 4 0 10-8 0m8 0v1a2 2 0 002 2h1m-11-3v1a2 2 0 01-2 2H5m11-10a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Members</p>
              <p className="text-2xl font-semibold text-gray-900">
                {families.reduce(
                  (acc, family) => acc + family.members.length,
                  0
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">
                Unassigned Members
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {unassignedMembers.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search families…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFamilyPage(1);
                }}
                className={`w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                  searchQuery ? "pr-10" : "pr-4"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFamilyPage(1);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                </button>
              )}
            </div>
          </div>

          {/* Sort and Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              ref={sortButtonRef}
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1"
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
              Sort {sortOrder === "asc" ? "↑" : "↓"}
            </button>

            <button
              ref={familyFilterButtonRef}
              onClick={handleFamilyFilterClick}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1"
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
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Sort Dropdown */}
      {showSortDropdown && (
        <div
          ref={sortDropdownRef}
          className="fixed z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
          style={{
            top: getSortButtonPosition().top,
            left: getSortButtonPosition().left,
          }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {SORT_OPTIONS.map((option) => (
              <div key={option.key} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{option.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSortSelect(option.key, "asc")}
                      className={`px-2 py-1 text-xs rounded ${
                        sortBy === option.key && sortOrder === "asc"
                          ? "bg-blue-100 text-blue-800"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleSortSelect(option.key, "desc")}
                      className={`px-2 py-1 text-xs rounded ${
                        sortBy === option.key && sortOrder === "desc"
                          ? "bg-blue-100 text-blue-800"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned Members Section */}
      {unassignedMembers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Unassigned Members ({filteredUnassignedMembers.length})
            </h2>
            <button
              onClick={() => setShowUnassignedMembers(!showUnassignedMembers)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg
                className={`w-4 h-4 mr-1 transition-transform ${
                  !showUnassignedMembers ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showUnassignedMembers ? "Hide" : "Show"}
            </button>
          </div>

          {showUnassignedMembers && (
            <>
              {/* Unassigned Controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-xs">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search unassigned…"
                    value={unassignedSearch}
                    onChange={(e) => {
                      setUnassignedSearch(e.target.value);
                      setUnassignedPage(1);
                    }}
                    className={`w-full pl-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                      unassignedSearch ? "pr-10" : "pr-3"
                    }`}
                  />
                  {unassignedSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnassignedSearch("");
                        setUnassignedPage(1);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    Page {unassignedPage} of {totalUnassignedPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setUnassignedPage((p) => Math.max(1, p - 1))
                      }
                      disabled={unassignedPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                      title="Previous"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() =>
                        setUnassignedPage((p) =>
                          Math.min(totalUnassignedPages, p + 1)
                        )
                      }
                      disabled={unassignedPage === totalUnassignedPages}
                      className="px-2 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                      title="Next"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {visibleUnassignedMembers.slice(0, 16).map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-lg shadow-sm p-2 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onViewPerson(member)}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(member)}
                      </div>
                      <div className="text-center w-full">
                        <p className="font-medium text-gray-900 text-xs truncate px-1">
                          {member.first_name}
                        </p>
                        <p className="font-medium text-gray-700 text-xs truncate px-1">
                          {member.last_name}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <span
                            className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${getStatusColor(
                              member.status
                            )}`}
                          >
                            {member.status.toLowerCase()}
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${getRoleColor(
                              member.role
                            )}`}
                          >
                            {member.role.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Active Family Filters Display */}
      {familyFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {familyFilters.map((filter, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
            >
              {filter.label}
              <button
                onClick={() => {
                  const newFilters = familyFilters.filter(
                    (_, i) => i !== index
                  );
                  setFamilyFilters(newFilters);
                  setFamilyPage(1);
                }}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <svg
                  className="w-3 h-3"
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
            </span>
          ))}
          <button
            onClick={() => {
              setFamilyFilters([]);
              setFamilyPage(1);
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Family Cards Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Families ({sortedFamilies.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFamilies.map((family) => {
            const familyMembers = family.members
              .map((id) => getPersonById(id))
              .filter(Boolean) as PersonUI[];

            // Separate core family (parents/adults) and connected family (children)
            const coreFamily = familyMembers.filter(
              (member) =>
                member.role === "PASTOR" ||
                member.role === "COORDINATOR" ||
                member.role === "MEMBER"
            );
            const connectedFamily = familyMembers.filter(
              (member) => member.role === "VISITOR"
            );

            return (
              <div
                key={family.id}
                className="bg-white rounded-lg shadow-md p-4 transition-all hover:shadow-lg hover:border-blue-200 hover:bg-blue-50/30 border-2 border-transparent cursor-pointer"
                onClick={() => onViewFamily(family)}
              >
                <div className="space-y-3">
                  {/* Family Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all">
                        The {family.name} Family
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {familyMembers.length} members • Since{" "}
                        {familyMembers[0]?.dateFirstAttended
                          ? new Date(
                              familyMembers[0].dateFirstAttended
                            ).toLocaleDateString()
                          : "Unknown"}
                      </p>
                    </div>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="relative z-10"
                    >
                      <ActionMenu
                        onView={() => onViewFamily(family)}
                        onEdit={() => onEditFamily(family)}
                        onDelete={() => onDeleteFamily(family)}
                      />
                    </div>
                  </div>

                  {/* Core Family */}
                  {coreFamily.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">
                        Core Family ({coreFamily.length})
                      </h4>
                      <div className="space-y-1.5">
                        {coreFamily.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {getInitials(member)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connected Family */}
                  {connectedFamily.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">
                        Connected Family ({connectedFamily.length})
                      </h4>
                      <div className="space-y-1.5">
                        {connectedFamily.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center space-x-3"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {getInitials(member)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="pt-1.5 border-t border-gray-100">
                    <p className="text-xs text-gray-500 italic line-clamp-2">
                      {family.notes || "No notes available for this family."}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Family Pagination Controls */}
        {sortedFamilies.length > FAMILY_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6">
            <span className="text-sm text-gray-600">
              Page {familyPage} of {totalFamilyPages} • Showing{" "}
              {visibleFamilies.length} of {sortedFamilies.length} families
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFamilyPage((p) => Math.max(1, p - 1))}
                disabled={familyPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                title="Previous"
              >
                ‹ Previous
              </button>
              <button
                onClick={() =>
                  setFamilyPage((p) => Math.min(totalFamilyPages, p + 1))
                }
                disabled={familyPage === totalFamilyPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                title="Next"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Family Filter Dropdown */}
      {showFamilyFilterDropdown && (
        <FamilyFilterDropdown
          isOpen={showFamilyFilterDropdown}
          onClose={() => setShowFamilyFilterDropdown(false)}
          onSelectField={(field) => {
            setSelectedFamilyField(field);
            setShowFamilyFilterDropdown(false);

            // Position the filter card similar to clusters
            const cardWidth = 320; // w-80
            const viewportWidth = window.innerWidth;
            const rightEdge = familyFilterDropdownPosition.left + cardWidth;
            let left = familyFilterDropdownPosition.left;
            if (rightEdge > viewportWidth) {
              left = viewportWidth - cardWidth - 16;
            }
            setFamilyFilterCardPosition({
              top: familyFilterDropdownPosition.top,
              left,
            });
            setShowFamilyFilterCard(true);
          }}
          position={familyFilterDropdownPosition}
        />
      )}

      {/* Family Filter Card */}
      {showFamilyFilterCard && selectedFamilyField && (
        <ClusterFilterCard
          field={selectedFamilyField}
          isOpen={showFamilyFilterCard}
          onClose={() => setShowFamilyFilterCard(false)}
          onApplyFilter={(filter: FilterCondition) => {
            setFamilyFilters([...familyFilters, filter]);
            setShowFamilyFilterCard(false);
            setFamilyPage(1);
          }}
          position={familyFilterCardPosition}
        />
      )}
    </div>
  );
}

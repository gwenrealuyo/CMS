import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Family, Person, PersonUI } from "@/src/types/person";
import Button from "@/src/components/ui/Button";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { useFamiliesDirectory } from "@/src/hooks/useFamiliesDirectory";
import { useUnassignedPeople } from "@/src/hooks/useUnassignedPeople";
import type { FamiliesListParams } from "@/src/lib/api";
import {
  TOOLBAR_ACTION_BUTTON_CLASS,
  TOOLBAR_BRANCH_SELECT_CLASS,
  TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS,
  TOOLBAR_BRANCH_SELECT_LOCKED_CLASS,
  TOOLBAR_CARD_CLASS,
  TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS,
  TOOLBAR_STACKED_ACTION_BUTTON_CLASS,
  TOOLBAR_STACKED_CONTROLS_CLASS,
} from "@/src/lib/toolbarStyles";
import ActionMenu from "./ActionMenu";
import FamilyFilterDropdown from "./FamilyFilterDropdown";
import ClusterFilterCard from "../clusters/ClusterFilterCard";
import { FilterCondition } from "../people/FilterBar";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import { getPersonRoleColor } from "@/src/lib/personRole";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import { useAuth } from "@/src/contexts/AuthContext";
import { branchesApi } from "@/src/lib/api";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";

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
  /** Legacy optional catalog; directory uses server pagination when omitted. */
  families?: Family[];
  people?: PersonUI[];
  isDesktop?: boolean;
  panelOpen?: boolean;
  /** Bump to force directory refetch after parent mutations. */
  refetchKey?: number;
  onRefetchReady?: (refetch: () => Promise<void> | void) => void;
  onCreateFamily: () => void;
  onViewFamily: (family: Family) => void;
  onEditFamily: (family: Family) => void;
  onDeleteFamily: (family: Family) => void;
  onHardDeleteFamily?: (family: Family) => void;
  onViewPerson?: (person: PersonUI) => void;
  onAssignMember?: (personId: string, familyId: string) => void;
  onRemoveMember?: (personId: string, familyId: string) => void;
}

function filtersToFamilyParams(filters: FilterCondition[]): FamiliesListParams {
  const params: FamiliesListParams = {};
  for (const filter of filters) {
    const field = filter.field;
    const value = filter.value;
    const scalar = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
    if (field === "name") {
      switch (filter.operator) {
        case "contains":
          params.name__icontains = scalar;
          break;
        case "is":
          params.name = scalar;
          break;
        case "is_not":
          params.name_ne = scalar;
          break;
        case "starts_with":
          params.name__istartswith = scalar;
          break;
        case "ends_with":
          params.name__iendswith = scalar;
          break;
        default:
          break;
      }
    } else if (field === "member_count") {
      if (Array.isArray(value) && value.length >= 2) {
        params.member_count_min = value[0];
        params.member_count_max = value[1];
      } else if (filter.operator === "greater_than") {
        params.member_count_min = Number(scalar) + 1;
      } else if (filter.operator === "less_than") {
        params.member_count_max = Number(scalar) - 1;
      } else if (filter.operator === "is") {
        params.member_count = scalar;
      }
    } else if (field === "visitor_count") {
      if (Array.isArray(value) && value.length >= 2) {
        params.visitor_count_min = value[0];
        params.visitor_count_max = value[1];
      } else if (filter.operator === "greater_than") {
        params.visitor_count_min = Number(scalar) + 1;
      } else if (filter.operator === "less_than") {
        params.visitor_count_max = Number(scalar) - 1;
      } else if (filter.operator === "is") {
        params.visitor_count = scalar;
      }
    }
  }
  return params;
}

export default function FamilyManagementDashboard({
  families: _legacyFamilies,
  people: _legacyPeople = [],
  isDesktop = false,
  panelOpen = false,
  refetchKey = 0,
  onRefetchReady,
  onCreateFamily,
  onViewFamily,
  onEditFamily,
  onDeleteFamily,
  onHardDeleteFamily,
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
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<"mobile" | "desktop">(
    "mobile",
  );
  const mobileSortButtonRef = React.useRef<HTMLButtonElement>(null);
  const desktopSortButtonRef = React.useRef<HTMLButtonElement>(null);
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);
  const [showUnassignedMembers, setShowUnassignedMembers] = useState(false);
  const [familyFilters, setFamilyFilters] = useState<FilterCondition[]>([]);
  const [showFamilyFilterDropdown, setShowFamilyFilterDropdown] =
    useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<"mobile" | "desktop">(
    "mobile",
  );
  const mobileFilterButtonRef = React.useRef<HTMLButtonElement>(null);
  const desktopFilterButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showFamilyFilterCard, setShowFamilyFilterCard] = useState(false);
  const [selectedFamilyField, setSelectedFamilyField] = useState<any>(null);
  const { user, isSeniorCoordinator } = useAuth();

  const canChangeFamilyBranchFilter = useMemo(() => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "PASTOR") return true;
    return isSeniorCoordinator("CLUSTER");
  }, [user, isSeniorCoordinator]);

  const [branchFilterId, setBranchFilterId] = useState("");
  const [branchPickerOptions, setBranchPickerOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const familyBranchUserIdRef = React.useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setBranchFilterId("");
      familyBranchUserIdRef.current = undefined;
      return;
    }
    if (familyBranchUserIdRef.current !== user.id) {
      familyBranchUserIdRef.current = user.id;
      setBranchFilterId(
        user.branch != null && user.branch !== undefined
          ? String(user.branch)
          : "",
      );
      return;
    }
    if (user.branch != null && user.branch !== undefined) {
      setBranchFilterId((prev) => (prev === "" ? String(user.branch) : prev));
    }
  }, [user]);

  useEffect(() => {
    if (!canChangeFamilyBranchFilter) {
      setBranchPickerOptions([]);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .getAll({ is_active: true })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setBranchPickerOptions(
          rows.map((b) => ({ value: String(b.id), label: b.name })),
        );
      })
      .catch((err) => {
        console.error("Failed to load branches", err);
        if (!cancelled) setBranchPickerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canChangeFamilyBranchFilter]);

  const familyEditableBranchSelectOptions = useMemo(
    () => [{ value: "", label: "All branches" }, ...branchPickerOptions],
    [branchPickerOptions],
  );

  const familyBranchFilterLabel = useMemo(() => {
    if (!branchFilterId) return "No branch";
    if (
      user?.branch_name &&
      user.branch != null &&
      String(user.branch) === branchFilterId
    ) {
      return user.branch_name;
    }
    const opt = branchPickerOptions.find((o) => o.value === branchFilterId);
    return opt?.label ?? `Branch #${branchFilterId}`;
  }, [branchFilterId, user?.branch, user?.branch_name, branchPickerOptions]);

  const familyReadonlyBranchSelectOptions = useMemo(() => {
    if (branchFilterId) {
      return [{ value: branchFilterId, label: familyBranchFilterLabel }];
    }
    return [{ value: "", label: "No branch assigned" }];
  }, [branchFilterId, familyBranchFilterLabel]);

  const familyBranchSelectInteractive =
    canChangeFamilyBranchFilter && !branchesLoading;

  const familyBranchHoverHint = useMemo(() => {
    if (familyBranchSelectInteractive) return "";
    if (branchesLoading && canChangeFamilyBranchFilter) {
      return "Loading branches…";
    }
    return "Branch is limited to your assignment. Pastors, admins, and senior cluster coordinators can switch branches.";
  }, [
    familyBranchSelectInteractive,
    branchesLoading,
    canChangeFamilyBranchFilter,
  ]);

  const renderFamilyBranchSelect = (fullWidth = false) => {
    const options =
      branchesLoading && canChangeFamilyBranchFilter ? (
        <option value="">Loading…</option>
      ) : (
        (canChangeFamilyBranchFilter
          ? familyEditableBranchSelectOptions
          : familyReadonlyBranchSelectOptions
        ).map((opt) => (
          <option
            key={opt.value === "" ? "__family_branch__" : opt.value}
            value={opt.value}
          >
            {opt.label}
          </option>
        ))
      );

    const selectEl = (
      <select
        aria-label="Branch"
        aria-disabled={!familyBranchSelectInteractive}
        tabIndex={familyBranchSelectInteractive ? 0 : -1}
        value={branchFilterId}
        onChange={(e) => {
          if (!familyBranchSelectInteractive) return;
          setBranchFilterId(e.target.value);
          setFamilyPage(1);
        }}
        className={
          familyBranchSelectInteractive
            ? fullWidth
              ? TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS
              : TOOLBAR_BRANCH_SELECT_CLASS
            : TOOLBAR_BRANCH_SELECT_LOCKED_CLASS
        }
      >
        {options}
      </select>
    );

    return familyBranchSelectInteractive ? (
      selectEl
    ) : (
      <LockedControlTooltip label={familyBranchHoverHint}>
        {selectEl}
      </LockedControlTooltip>
    );
  };

  // Family filter dropdown handles its own click-outside; no parent listener needed

  const handleSortButtonClick = (anchor: "mobile" | "desktop") => {
    setShowFamilyFilterDropdown(false);
    setShowFamilyFilterCard(false);
    setSelectedFamilyField(null);
    if (showSortDropdown && sortMenuAnchor === anchor) {
      setShowSortDropdown(false);
    } else {
      setSortMenuAnchor(anchor);
      setShowSortDropdown(true);
    }
  };

  const handleFamilyFilterClick = (anchor: "mobile" | "desktop") => {
    setShowSortDropdown(false);
    if (
      (showFamilyFilterDropdown || showFamilyFilterCard) &&
      filterMenuAnchor === anchor
    ) {
      setShowFamilyFilterDropdown(false);
      setShowFamilyFilterCard(false);
      setSelectedFamilyField(null);
      return;
    }
    setShowFamilyFilterCard(false);
    setSelectedFamilyField(null);
    setFilterMenuAnchor(anchor);
    setShowFamilyFilterDropdown(true);
  };

  const handleFamilyFilterFieldSelect = (field: any) => {
    setSelectedFamilyField(field);
    setShowFamilyFilterDropdown(false);
    setShowFamilyFilterCard(true);
  };

  const directoryFilters = useMemo(() => {
    const params = filtersToFamilyParams(familyFilters);
    if (branchFilterId) {
      params.branch = branchFilterId;
    }
    return params;
  }, [familyFilters, branchFilterId]);

  const directoryOrdering = useMemo(() => {
    const field =
      sortBy === "member_count"
        ? "member_count"
        : sortBy === "visitor_count"
          ? "visitor_count"
          : "name";
    return sortOrder === "desc" ? `-${field}` : field;
  }, [sortBy, sortOrder]);

  const {
    families,
    totalCount: familiesTotalCount,
    loading: familiesLoading,
    refetch: refetchFamilies,
  } = useFamiliesDirectory({
    search: searchQuery,
    filters: directoryFilters,
    page: familyPage,
    pageSize: FAMILY_PAGE_SIZE,
    ordering: directoryOrdering,
  });

  const {
    peopleUI: unassignedPeopleUI,
    totalCount: unassignedTotalCount,
    loading: unassignedLoading,
    refetch: refetchUnassigned,
  } = useUnassignedPeople({
    search: unassignedSearch,
    page: unassignedPage,
    pageSize: UNASSIGNED_PAGE_SIZE,
  });

  const unassignedMembers = unassignedPeopleUI;
  const filteredUnassignedMembers = unassignedPeopleUI;
  const totalUnassignedPages = Math.max(
    1,
    Math.ceil(unassignedTotalCount / UNASSIGNED_PAGE_SIZE),
  );
  const visibleUnassignedMembers = unassignedPeopleUI;
  const visibleFamilies = families;
  const sortedFamilies = families;
  const totalFamilyPages = Math.max(
    1,
    Math.ceil(familiesTotalCount / FAMILY_PAGE_SIZE),
  );

  const refetchDirectory = useCallback(async () => {
    await Promise.all([refetchFamilies(), refetchUnassigned()]);
  }, [refetchFamilies, refetchUnassigned]);

  useEffect(() => {
    onRefetchReady?.(refetchDirectory);
  }, [onRefetchReady, refetchDirectory]);

  useEffect(() => {
    if (refetchKey > 0) {
      void refetchDirectory();
    }
  }, [refetchKey, refetchDirectory]);

  useEffect(() => {
    setFamilyPage(1);
  }, [searchQuery, directoryFilters, directoryOrdering]);

  useEffect(() => {
    setUnassignedPage(1);
  }, [unassignedSearch]);

  // Handle click outside sort dropdown (consider button and dropdown refs)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const onSortButton =
        mobileSortButtonRef.current?.contains(target) ||
        desktopSortButtonRef.current?.contains(target);
      if (
        showSortDropdown &&
        sortDropdownRef.current &&
        !onSortButton &&
        !sortDropdownRef.current.contains(target)
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
    newSortOrder: "asc" | "desc",
  ) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setShowSortDropdown(false);
    setFamilyPage(1);
  };

  const getPersonById = (id: string) => {
    return _legacyPeople.find((person) => String(person.id) === String(id));
  };

  const getFamilyVisitorCount = (family: Family) => {
    if (typeof family.visitor_count === "number") return family.visitor_count;
    const members = family.members ?? [];
    return members.filter((memberId) => {
      const person = getPersonById(String(memberId));
      return person?.role === "VISITOR";
    }).length;
  };

  const getFamilyMemberCount = (family: Family) => {
    if (typeof family.member_count === "number") return family.member_count;
    return family.members?.length ?? family.member_preview?.length ?? 0;
  };

  const getFamilyPreviewMembers = (family: Family): PersonUI[] => {
    if (family.member_preview?.length) {
      return family.member_preview.map((m) => ({
        id: String(m.id),
        first_name: m.first_name ?? "",
        last_name: m.last_name ?? "",
        role: (m.role as PersonUI["role"]) ?? "MEMBER",
        photo: m.photo ?? undefined,
        name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
      })) as PersonUI[];
    }
    return (family.members ?? [])
      .map((id) => getPersonById(String(id)))
      .filter(Boolean) as PersonUI[];
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
      case "DORMANT":
        return "bg-orange-100 text-orange-800";
      case "FALLAWAY":
        return "bg-violet-100 text-violet-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get role color

  const useStackedToolbar = isDesktop && panelOpen;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div
        className={
          panelOpen
            ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
            : "grid grid-cols-1 md:grid-cols-3 gap-4"
        }
      >
        <div className="bg-white rounded-lg border border-gray-200 p-4 card-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 chip-primary-surface rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-primary"
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
                {familiesTotalCount}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 card-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 chip-green-surface rounded-lg flex items-center justify-center">
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
                {families.reduce((acc, family) => acc + getFamilyMemberCount(family), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 card-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 chip-orange-surface rounded-lg flex items-center justify-center">
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
                {unassignedTotalCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className={TOOLBAR_CARD_CLASS}>
        {/* Stacked 3-row toolbar (mobile, or desktop with detail panel open) */}
        <div
          className={
            useStackedToolbar
              ? "flex flex-col gap-3"
              : "flex flex-col gap-3 tablet:hidden"
          }
        >
          <ToolbarSearch
            fullWidth
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setFamilyPage(1);
            }}
            placeholder="Search families…"
            ariaLabel="Search families"
          />

          <div className={TOOLBAR_STACKED_CONTROLS_CLASS}>
            {renderFamilyBranchSelect(true)}
            <ViewModeToggle
              fullWidth
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-2">
              <button
                ref={mobileSortButtonRef}
                type="button"
                onClick={() => handleSortButtonClick("mobile")}
                className={`${TOOLBAR_STACKED_ACTION_BUTTON_CLASS} w-full`}
              >
                <svg
                  className="w-4 h-4 mr-1 shrink-0"
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
                <span className="truncate">
                  Sort {sortOrder === "asc" ? "↑" : "↓"}
                </span>
              </button>

              <button
                ref={mobileFilterButtonRef}
                type="button"
                onClick={() => handleFamilyFilterClick("mobile")}
                className={`${TOOLBAR_STACKED_ACTION_BUTTON_CLASS} w-full`}
              >
                <svg
                  className="w-4 h-4 mr-1 shrink-0"
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

            {showSortDropdown && sortMenuAnchor === "mobile" && (
              <div
                ref={sortDropdownRef}
                className="absolute inset-x-0 top-full z-50 mt-1.5 w-full rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
              >
                <div className="border-b border-gray-100 px-3 py-2">
                  <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
                </div>
                <div className="tablet:max-h-64 tablet:overflow-y-auto">
                  {SORT_OPTIONS.map((option) => (
                    <div key={option.key} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {option.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSortSelect(option.key, "asc")}
                            className={`rounded px-2 py-1 text-xs ${
                              sortBy === option.key && sortOrder === "asc"
                                ? "chip-primary"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSortSelect(option.key, "desc")}
                            className={`rounded px-2 py-1 text-xs ${
                              sortBy === option.key && sortOrder === "desc"
                                ? "chip-primary"
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

            {filterMenuAnchor === "mobile" && (
              <>
                <FamilyFilterDropdown
                  isOpen={showFamilyFilterDropdown}
                  onClose={() => setShowFamilyFilterDropdown(false)}
                  onSelectField={handleFamilyFilterFieldSelect}
                />
                {showFamilyFilterCard && selectedFamilyField && (
                  <ClusterFilterCard
                    field={selectedFamilyField}
                    isOpen={showFamilyFilterCard}
                    onClose={() => {
                      setShowFamilyFilterCard(false);
                      setSelectedFamilyField(null);
                    }}
                    onApplyFilter={(filter: FilterCondition) => {
                      setFamilyFilters([...familyFilters, filter]);
                      setShowFamilyFilterCard(false);
                      setSelectedFamilyField(null);
                      setFamilyPage(1);
                    }}
                    anchored
                  />
                )}
              </>
            )}
          </div>

          {familyFilters.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2">
              {familyFilters.map((filter, index) => (
                <span
                  key={index}
                  className="inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium chip-primary"
                >
                  <span className="max-w-[150px] truncate">{filter.label}</span>
                  <button
                    onClick={() => {
                      const newFilters = familyFilters.filter(
                        (_, i) => i !== index,
                      );
                      setFamilyFilters(newFilters);
                      setFamilyPage(1);
                    }}
                    className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                    aria-label="Remove filter"
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
                className="min-h-[32px] px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Desktop — single-row toolbar */}
        <div
          className={
            useStackedToolbar
              ? "hidden"
              : "hidden tablet:flex tablet:flex-wrap tablet:items-center tablet:justify-between tablet:gap-2"
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ToolbarSearch
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setFamilyPage(1);
              }}
              placeholder="Search families…"
              ariaLabel="Search families"
            />
            <div className="min-w-0 flex-1 max-w-xs">
              {renderFamilyBranchSelect()}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ViewModeToggle
              compact
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {familyFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {familyFilters.map((filter, index) => (
                  <span
                    key={index}
                    className="inline-flex min-h-[32px] items-center rounded-full px-2 py-1.5 text-xs font-medium chip-primary"
                  >
                    <span className="max-w-none truncate">{filter.label}</span>
                    <button
                      onClick={() => {
                        const newFilters = familyFilters.filter(
                          (_, i) => i !== index,
                        );
                        setFamilyFilters(newFilters);
                        setFamilyPage(1);
                      }}
                      className="ml-1 flex min-h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center text-primary hover:text-primary"
                      aria-label="Remove filter"
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
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear All
                </button>
              </div>
            )}
            <div className="relative">
              <button
                ref={desktopSortButtonRef}
                type="button"
                onClick={() => handleSortButtonClick("desktop")}
                className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
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
              {showSortDropdown && sortMenuAnchor === "desktop" && (
                <div
                  ref={sortDropdownRef}
                  className="absolute right-0 top-full mt-1.5 z-50 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-2"
                >
                  <div className="px-3 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">
                      Sort by
                    </h3>
                  </div>
                  <div className="tablet:max-h-64 tablet:overflow-y-auto">
                    {SORT_OPTIONS.map((option) => (
                      <div key={option.key} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">
                            {option.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleSortSelect(option.key, "asc")
                              }
                              className={`px-2 py-1 text-xs rounded ${
                                sortBy === option.key && sortOrder === "asc"
                                  ? "chip-primary"
                                  : "text-gray-500 hover:text-gray-700"
                              }`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSortSelect(option.key, "desc")
                              }
                              className={`px-2 py-1 text-xs rounded ${
                                sortBy === option.key && sortOrder === "desc"
                                  ? "chip-primary"
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
            </div>
            <div className="relative">
              <button
                ref={desktopFilterButtonRef}
                type="button"
                onClick={() => handleFamilyFilterClick("desktop")}
                className={TOOLBAR_DESKTOP_ACTION_BUTTON_CLASS}
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
              {filterMenuAnchor === "desktop" && (
                <>
                  <FamilyFilterDropdown
                    isOpen={showFamilyFilterDropdown}
                    onClose={() => setShowFamilyFilterDropdown(false)}
                    onSelectField={handleFamilyFilterFieldSelect}
                  />
                  {showFamilyFilterCard && selectedFamilyField && (
                    <ClusterFilterCard
                      field={selectedFamilyField}
                      isOpen={showFamilyFilterCard}
                      onClose={() => {
                        setShowFamilyFilterCard(false);
                        setSelectedFamilyField(null);
                      }}
                      onApplyFilter={(filter: FilterCondition) => {
                        setFamilyFilters([...familyFilters, filter]);
                        setShowFamilyFilterCard(false);
                        setSelectedFamilyField(null);
                        setFamilyPage(1);
                      }}
                      anchored
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Members Section */}
      {unassignedTotalCount > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Unassigned Members ({unassignedTotalCount})
            </h2>
            <button
              onClick={() => setShowUnassignedMembers(!showUnassignedMembers)}
              className={`${TOOLBAR_ACTION_BUTTON_CLASS} w-full sm:w-auto`}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
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
                    className={`w-full pl-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm ${
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
                <div className="flex items-center justify-between gap-2 text-sm text-gray-600 sm:justify-end">
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
                          Math.min(totalUnassignedPages, p + 1),
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 tablet:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {visibleUnassignedMembers.slice(0, 16).map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-lg shadow-sm p-2 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onViewPerson?.(member)}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <PersonAvatar person={member} size="md" />
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
                              member.status,
                            )}`}
                          >
                            {member.status.toLowerCase()}
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded-full text-[9px] font-medium ${getPersonRoleColor(
                              member.role,
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

      {/* Family Cards Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Families ({familiesTotalCount})
        </h2>
        {viewMode === "table" ? (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Family
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Visitors
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Since
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleFamilies.map((family) => {
                  const familyMembers = getFamilyPreviewMembers(family);
                  const sinceText = "—";

                  return (
                    <tr key={family.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onViewFamily(family)}
                          className={TABLE_ENTITY_LINK_CLASS}
                        >
                          The {family.name} Family
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {getFamilyMemberCount(family)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {getFamilyVisitorCount(family)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{sinceText}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <p className="max-w-xs truncate">
                          {family.notes ||
                            "No notes available for this family."}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <ActionMenu
                            onView={() => onViewFamily(family)}
                            onEdit={() => onEditFamily(family)}
                            onDelete={() => onDeleteFamily(family)}
                            onHardDelete={
                              onHardDeleteFamily
                                ? () => onHardDeleteFamily(family)
                                : undefined
                            }
                            labels={{
                              view: "View Family",
                              edit: "Edit Family",
                              delete: "Mark Inactive",
                              hardDelete: "Delete Family",
                              title: "Family Actions",
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
        ) : (
          <div
            className={
              panelOpen
                ? "grid grid-cols-1 gap-4"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            }
          >
            {visibleFamilies.map((family) => {
              const familyMembers = getFamilyPreviewMembers(family);

              return (
                <div
                  key={family.id}
                  className="p-4 rounded-lg card-list"
                  onClick={() => onViewFamily(family)}
                >
                  <div className="space-y-3">
                    {/* Family Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-primary hover:underline transition-all">
                          The {family.name} Family
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {getFamilyMemberCount(family)} members •{" "}
                          {getFamilyVisitorCount(family)} visitors
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
                          onHardDelete={
                            onHardDeleteFamily
                              ? () => onHardDeleteFamily(family)
                              : undefined
                          }
                          labels={{
                            view: "View Family",
                            edit: "Edit Family",
                            delete: "Mark Inactive",
                            hardDelete: "Delete Family",
                            title: "Family Actions",
                          }}
                        />
                      </div>
                    </div>

                    {/* Family Members */}
                    {familyMembers.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-2">
                          Members ({familyMembers.length})
                        </h4>
                        <div className="space-y-1.5">
                          {familyMembers.slice(0, 5).map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center space-x-3"
                            >
                              <PersonAvatar person={member} size="sm" />
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
                          {familyMembers.length > 5 && (
                            <p className="text-xs text-gray-400 text-center py-1">
                              +{familyMembers.length - 5} more
                            </p>
                          )}
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
        )}

        {/* Family Pagination Controls */}
        {sortedFamilies.length > FAMILY_PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
            <span className="text-sm text-gray-600">
              Page {familyPage} of {totalFamilyPages} • Showing{" "}
              {visibleFamilies.length} of {sortedFamilies.length} families
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFamilyPage((p) => Math.max(1, p - 1))}
                disabled={familyPage === 1}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
                aria-label="Previous page"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="px-3 py-2 text-sm text-gray-700 min-h-[44px] md:min-h-0 flex items-center">
                Page {familyPage} of {totalFamilyPages}
              </span>
              <button
                onClick={() =>
                  setFamilyPage((p) => Math.min(totalFamilyPages, p + 1))
                }
                disabled={familyPage === totalFamilyPages}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center"
                aria-label="Next page"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

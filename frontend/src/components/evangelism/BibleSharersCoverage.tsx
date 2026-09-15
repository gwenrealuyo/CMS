"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { evangelismApi, branchesApi } from "@/src/lib/api";
import {
  BibleSharerDirectoryPerson,
  BibleSharersCoverage,
} from "@/src/types/evangelism";
import { Branch } from "@/src/types/branch";
import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Table from "@/src/components/ui/Table";
import Pagination from "@/src/components/ui/Pagination";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import EvangelismToolbarSearch, {
  EVANGELISM_BRANCH_SELECT_LOCKED_CLASS,
} from "@/src/components/evangelism/EvangelismToolbarSearch";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  canChangeEvangelismBranchFilter,
  EVANGELISM_BRANCH_LOCKED_HINT,
} from "@/src/lib/evangelismBranchFilter";
import {
  CLUSTER_CODE_BADGE_CLASSNAME,
  getClusterCodeBadgeStyle,
} from "@/src/lib/branchChipColor";
import {
  STATUS_CHIP_CLASSNAME,
  getStatusChipStyle,
} from "@/src/lib/statusChipStyle";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import {
  effectiveListViewMode,
  getInitialListViewMode,
  useIsMdUp,
  useIsTabletUp,
} from "@/src/lib/listViewMode";
import {
  TOOLBAR_ACTIONS_ROW_CLASS,
  TOOLBAR_BRANCH_SELECT_CLASS,
  TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS,
  TOOLBAR_CARD_CLASS,
} from "@/src/lib/toolbarStyles";

type StatusFilter =
  | "all"
  | "assigned"
  | "unassigned"
  | "roster_only"
  | "grant_only";

type PeopleSortField = "name" | "group_count" | "assigned";

const DEFAULT_ITEMS_PER_PAGE = 25;

function matchesStatus(
  person: BibleSharerDirectoryPerson,
  filter: StatusFilter,
): boolean {
  switch (filter) {
    case "assigned":
      return person.assigned;
    case "unassigned":
      return !person.assigned;
    case "roster_only":
      return person.on_hq_roster && !person.has_module_wide_grant;
    case "grant_only":
      return person.has_module_wide_grant && !person.assigned;
    default:
      return true;
  }
}

function PersonStatusChips({ person }: { person: BibleSharerDirectoryPerson }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span
        className={STATUS_CHIP_CLASSNAME}
        style={getStatusChipStyle(person.assigned ? "active" : "inactive")}
      >
        {person.assigned ? "Assigned" : "Unassigned"}
      </span>
      <span
        className={STATUS_CHIP_CLASSNAME}
        style={getStatusChipStyle(person.on_hq_roster ? "primary" : "inactive")}
      >
        {person.on_hq_roster ? "HQ roster" : "Not on roster"}
      </span>
      {person.on_hq_roster && person.roster_active === false ? (
        <span className="text-xs text-gray-500">Inactive on roster</span>
      ) : null}
      {person.on_hq_roster ? (
        <span
          className={STATUS_CHIP_CLASSNAME}
          style={getStatusChipStyle(
            person.has_module_wide_grant ? "primary" : "clusterBs",
          )}
        >
          {person.has_module_wide_grant ? "Evangelism access" : "Roster only"}
        </span>
      ) : person.has_module_wide_grant ? (
        <span
          className={STATUS_CHIP_CLASSNAME}
          style={getStatusChipStyle("primary")}
        >
          Evangelism access
        </span>
      ) : null}
    </div>
  );
}

export default function BibleSharersCoverageComponent() {
  const { user, isSeniorCoordinator } = useAuth();
  const canChangeBranchFilter = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const branchUserIdRef = useRef<number | undefined>(undefined);

  const [coverage, setCoverage] = useState<BibleSharersCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [filterBranch, setFilterBranch] = useState<number | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<PeopleSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("table"),
  );
  const isTabletUp = useIsTabletUp();
  const isMdUp = useIsMdUp();
  const effectiveViewMode = effectiveListViewMode(viewMode, isTabletUp);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setBranchesLoading(true);
        const response = await branchesApi.getAll();
        setBranches(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setBranchesLoading(false);
      }
    };
    void loadBranches();
  }, []);

  useEffect(() => {
    if (!user) {
      branchUserIdRef.current = undefined;
      return;
    }
    if (branchUserIdRef.current !== user.id) {
      branchUserIdRef.current = user.id;
      setFilterBranch(
        user.branch != null && user.branch !== undefined ? user.branch : "",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user || canChangeBranchFilter) return;
    if (user.branch != null && filterBranch !== user.branch) {
      setFilterBranch(user.branch);
    }
  }, [user, canChangeBranchFilter, filterBranch]);

  useEffect(() => {
    const fetchCoverage = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await evangelismApi.getBibleSharersCoverage(
          filterBranch ? { branch: filterBranch } : undefined,
        );
        setCoverage(response.data);
      } catch (err: any) {
        setError(
          err.response?.data?.detail ||
            err.response?.data?.branch?.[0] ||
            (() => {
              const errorData = err.response?.data || {};
              const errorValues = Object.values(errorData);
              return errorValues.length > 0 && Array.isArray(errorValues[0])
                ? errorValues[0][0]
                : undefined;
            })() ||
            "Failed to load Bible Sharers",
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchCoverage();
  }, [filterBranch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, filterBranch, itemsPerPage]);

  const branchById = useMemo(() => {
    const map = new Map<number, Branch>();
    branches.forEach((branch) => map.set(Number(branch.id), branch));
    return map;
  }, [branches]);

  const people = coverage?.people || [];
  const summary = coverage?.summary;
  const coverageItems = coverage?.coverage || [];

  const filteredPeople = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    const filtered = people.filter((person) => {
      if (!matchesStatus(person, statusFilter)) return false;
      if (!query) return true;
      const groupMatch = person.groups.some((group) =>
        group.name.toLowerCase().includes(query),
      );
      return person.name.toLowerCase().includes(query) || groupMatch;
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((first, second) => {
      switch (sortField) {
        case "group_count":
          return (first.group_count - second.group_count) * direction;
        case "assigned":
          return (Number(first.assigned) - Number(second.assigned)) * direction;
        case "name":
        default:
          return first.name.localeCompare(second.name) * direction;
      }
    });
  }, [people, debouncedSearch, statusFilter, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredPeople.length / itemsPerPage) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedPeople = filteredPeople.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const handleSort = (field: PeopleSortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "name" ? "asc" : "desc");
  };

  const renderSortIcon = (field: PeopleSortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const renderBranchSelect = (fullWidth = false) => {
    const interactive = canChangeBranchFilter && !branchesLoading;
    const branchSelectEl = (
      <select
        aria-label="Branch"
        aria-disabled={!interactive}
        tabIndex={interactive ? 0 : -1}
        value={filterBranch}
        onChange={(event) => {
          if (!interactive) return;
          setFilterBranch(Number(event.target.value) || "");
        }}
        disabled={canChangeBranchFilter && branchesLoading}
        className={`${
          interactive
            ? fullWidth
              ? TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS
              : TOOLBAR_BRANCH_SELECT_CLASS
            : EVANGELISM_BRANCH_SELECT_LOCKED_CLASS
        }${fullWidth ? " h-full min-h-[44px]" : ""}`}
      >
        {canChangeBranchFilter ? (
          <>
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </>
        ) : user?.branch != null ? (
          <>
            {branches
              .filter((branch) => Number(branch.id) === Number(user.branch))
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            {!branches.some(
              (branch) => Number(branch.id) === Number(user.branch),
            ) && (
              <option value={String(user.branch)}>
                {user.branch_name?.trim() || `Branch #${user.branch}`}
              </option>
            )}
          </>
        ) : (
          <option value="">No branch assigned</option>
        )}
      </select>
    );

    return interactive ? (
      branchSelectEl
    ) : (
      <LockedControlTooltip
        label={EVANGELISM_BRANCH_LOCKED_HINT}
        wrapperClassName={
          fullWidth ? "block h-full w-full min-w-0 cursor-default" : undefined
        }
      >
        {branchSelectEl}
      </LockedControlTooltip>
    );
  };

  const statusSelect = (className: string) => (
    <select
      value={statusFilter}
      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
      className={className}
      aria-label="Filter by status"
    >
      <option value="all">All statuses</option>
      <option value="assigned">Assigned</option>
      <option value="unassigned">Unassigned</option>
      <option value="roster_only">Roster only</option>
      <option value="grant_only">Grant only</option>
    </select>
  );

  const renderClusterBadge = (
    cluster: {
      id: number | null;
      name: string | null;
      code: string | null;
      branch: number | null;
    } | null,
  ) => {
    if (!cluster || cluster.id == null) {
      return <span className="text-xs text-gray-500">No cluster</span>;
    }
    const branch =
      cluster.branch != null ? branchById.get(cluster.branch) : undefined;
    const label = cluster.code || cluster.name || "Cluster";
    return (
      <Link
        href={`/clusters?open=${cluster.id}`}
        className={`${CLUSTER_CODE_BADGE_CLASSNAME} hover:opacity-90`}
        style={getClusterCodeBadgeStyle(
          cluster.branch,
          branch?.is_headquarters,
        )}
      >
        {label}
      </Link>
    );
  };

  const uniqueClusters = (person: BibleSharerDirectoryPerson) => {
    const seen = new Set<string>();
    return person.groups.filter((group) => {
      const key =
        group.cluster?.id != null ? `c-${group.cluster.id}` : `g-${group.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const renderGroups = (person: BibleSharerDirectoryPerson) => {
    if (person.groups.length === 0) {
      return <span className="text-sm text-gray-400">None</span>;
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {person.groups.map((group) => (
          <Link
            key={group.id}
            href={`/evangelism?tab=groups&openGroup=${group.id}`}
            className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-primary hover:underline"
          >
            {group.name}
          </Link>
        ))}
      </div>
    );
  };

  const coveragePercentage = summary?.total_clusters
    ? Math.round(
        ((summary.clusters_with_bible_sharers || 0) / summary.total_clusters) *
          100,
      )
    : 0;

  if (loading && !coverage) {
    return (
      <Card>
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error && !coverage) {
    return <ErrorMessage message={error} />;
  }

  if (!coverage) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className={TOOLBAR_CARD_CLASS}>
        <div className="flex flex-col gap-3 xl:hidden">
          <EvangelismToolbarSearch
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search Bible Sharers…"
            ariaLabel="Search Bible Sharers"
            fullWidth
          />
          <div className="grid grid-cols-2 items-stretch gap-3">
            <div className="min-w-0">{renderBranchSelect(true)}</div>
            <div className="min-w-0">
              <ViewModeToggle
                fullWidth
                className="h-full items-stretch"
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            </div>
          </div>
          <div className={TOOLBAR_ACTIONS_ROW_CLASS}>
            {statusSelect(
              "min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
            )}
          </div>
        </div>

        <div className="hidden xl:flex xl:flex-wrap xl:items-center xl:gap-2">
          <EvangelismToolbarSearch
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search Bible Sharers…"
            ariaLabel="Search Bible Sharers"
          />
          {renderBranchSelect()}
          <ViewModeToggle
            compact={isMdUp}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          {statusSelect(
            "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
          )}
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <h3 className="text-xs font-medium text-gray-500">Bible Sharers</h3>
          <p className="text-lg font-bold text-gray-900 mt-0.5">
            {summary?.total_bible_sharers ?? people.length}
          </p>
        </Card>
        <Card className="!p-4">
          <h3 className="text-xs font-medium text-gray-500">Assigned</h3>
          <p className="text-lg font-bold text-green-600 mt-0.5">
            {summary?.assigned_count ?? 0}
          </p>
        </Card>
        <Card className="!p-4">
          <h3 className="text-xs font-medium text-gray-500">Unassigned</h3>
          <p className="text-lg font-bold text-amber-600 mt-0.5">
            {summary?.unassigned_count ?? 0}
          </p>
        </Card>
        <Card className="!p-4">
          <h3 className="text-xs font-medium text-gray-500">
            Clusters uncovered
          </h3>
          <div className="flex flex-row gap-1 items-end">
            <p className="text-lg font-bold text-red-600 mt-0.5">
              {summary?.clusters_without_bible_sharers || 0}
            </p>
            <p className="text-[11px] text-gray-500 ml-2 mb-1">
              ({coveragePercentage}% coverage)
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">People</h2>
            <p className="mt-1 text-sm text-gray-500">
              Facilitators on the HQ roster and people assigned as Bible Sharers
              on evangelism groups. Unassigned people cannot file weekly reports
              until they are assigned to a group.
            </p>
          </div>

          {filteredPeople.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No Bible Sharers found
            </p>
          ) : effectiveViewMode === "cards" ? (
            <div className="space-y-3">
              {paginatedPeople.map((person) => (
                <article
                  key={person.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <Link
                    href={`/people?open=${person.id}`}
                    className={`${TABLE_ENTITY_LINK_CLASS} text-base`}
                  >
                    {person.name}
                  </Link>
                  <div className="mt-2">
                    <PersonStatusChips person={person} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {renderGroups(person)}
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueClusters(person).map((group) => (
                        <span key={`${person.id}-${group.id}-cluster`}>
                          {renderClusterBadge(group.cluster)}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {(
                      [
                        ["name", "Name"],
                        ["assigned", "Status"],
                        ["group_count", "Groups"],
                      ] as Array<[PeopleSortField, string]>
                    ).map(([field, label]) => (
                      <th
                        key={field}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                        onClick={() => handleSort(field)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{label}</span>
                          {renderSortIcon(field)}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Clusters
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedPeople.map((person) => (
                    <tr key={person.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <Link
                          href={`/people?open=${person.id}`}
                          className={`${TABLE_ENTITY_LINK_CLASS} break-words`}
                        >
                          {person.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <PersonStatusChips person={person} />
                      </td>
                      <td className="px-4 py-4">{renderGroups(person)}</td>
                      <td className="px-4 py-4">
                        {person.groups.length === 0 ? (
                          <span className="text-sm text-gray-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {uniqueClusters(person).map((group) => (
                              <span key={`${person.id}-${group.id}-cluster`}>
                                {renderClusterBadge(group.cluster)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredPeople.length > itemsPerPage ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredPeople.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
              showItemsPerPage
            />
          ) : null}

          {summary?.can_manage_roster && summary.bible_sharers_ministry_id ? (
            <p className="text-sm text-gray-500">
              <Link
                href={`/ministries?open=${summary.bible_sharers_ministry_id}`}
                className={TABLE_ENTITY_LINK_CLASS}
              >
                Manage HQ roster in Ministries
              </Link>
            </p>
          ) : null}
        </div>
      </Card>

      {(summary?.clusters_without_bible_sharers || 0) > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <div className="">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              Clusters Without Bible Sharers
            </h3>
            <p className="text-sm text-yellow-700">
              {(summary?.clusters_without_names ?? []).join(", ") ||
                "No cluster names available"}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Ideally, each cluster should have at least one assigned Bible
              Sharer who can facilitate bible studies when needed.
            </p>
          </div>
        </Card>
      )}

      <Card>
        <div className="">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Cluster Coverage Details
          </h2>
          {coverageItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No clusters found</p>
          ) : (
            <Table
              columns={[
                {
                  header: "Cluster",
                  accessor: "cluster" as any,
                  render: (_value, item) => {
                    if (item.cluster.id == null) {
                      return item.cluster.name || "No cluster";
                    }
                    const branch =
                      item.cluster.branch != null
                        ? branchById.get(item.cluster.branch)
                        : undefined;
                    const label =
                      item.cluster.code || item.cluster.name || "Cluster";
                    return (
                      <Link
                        href={`/clusters?open=${item.cluster.id}`}
                        className={`${CLUSTER_CODE_BADGE_CLASSNAME} hover:opacity-90`}
                        style={getClusterCodeBadgeStyle(
                          item.cluster.branch,
                          branch?.is_headquarters,
                        )}
                      >
                        {label}
                      </Link>
                    );
                  },
                },
                {
                  header: "Status",
                  accessor: "has_bible_sharers" as any,
                  render: (_value, item) => (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        item.has_bible_sharers
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.has_bible_sharers ? "Covered" : "Not Covered"}
                    </span>
                  ),
                },
                {
                  header: "Groups with Sharers",
                  accessor: "bible_sharers_groups" as any,
                  render: (_value, item) => item.bible_sharers_groups.length,
                },
                {
                  header: "Bible Sharers",
                  accessor: "bible_sharers_count" as any,
                  render: (value) => value,
                },
                {
                  header: "People",
                  accessor: "bible_sharers" as any,
                  render: (_value, item) => {
                    const listed = item.bible_sharers || [];
                    if (listed.length === 0) {
                      return <span className="text-gray-400">None</span>;
                    }
                    return (
                      <div className="space-y-1">
                        {listed.map((person) => (
                          <div
                            key={person.id}
                            className="text-sm text-gray-700"
                          >
                            <Link
                              href={`/people?open=${person.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {person.name}
                            </Link>
                            {person.groups?.length > 0 && (
                              <span className="text-gray-400 ml-2">
                                ({person.groups.join(", ")})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  },
                },
              ]}
              data={coverageItems}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

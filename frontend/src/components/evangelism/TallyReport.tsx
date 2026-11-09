"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import Table from "@/src/components/ui/Table";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import Pagination from "@/src/components/ui/Pagination";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import ClusterView from "@/src/components/clusters/ClusterView";
import {
  EvangelismTallyDrilldownMetric,
  EvangelismTallyRow,
} from "@/src/types/evangelism";
import type { Cluster } from "@/src/types/cluster";
import { useEvangelismTally } from "@/src/hooks/useEvangelism";
import { clustersApi, evangelismApi } from "@/src/lib/api";
import { getEvangelismGatheringTypeChipClass } from "@/src/lib/evangelismGatheringTypeStyles";
import { formatLocaleDate } from "@/src/lib/date";
import {
  resolveClusterRosterFamilies,
  resolveClusterRosterPeople,
} from "@/src/lib/clusterRoster";
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";
import TallyMonthFilter from "@/src/components/evangelism/TallyMonthFilter";
import TallyWeekFilter, {
  TALLY_ALL_WEEKS,
  pruneSelectedWeeks,
  weeksOverlappingMonths,
  weeksQueryParam,
} from "@/src/components/evangelism/TallyWeekFilter";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import {
  DEFAULT_TALLY_CLUSTER_SORT_DIR,
  DEFAULT_TALLY_CLUSTER_SORT_KEY,
  TallyClusterSortDir,
  TallyClusterSortKey,
  clusterCellLabels,
  clusterSortHeaderLabel,
  compareClusterRows,
  nextClusterSort,
} from "@/src/lib/tallyClusterSort";
import { currentMonthMonths } from "@/src/lib/tallyMonthWindow";

const DEFAULT_ITEMS_PER_PAGE = 25;

interface TallyReportProps {
  year?: number;
  onYearChange?: (year: number) => void;
  clusterId?: number | string;
  allowedClusterIds?: number[];
}

export default function TallyReport({
  year,
  onYearChange,
  clusterId,
  allowedClusterIds,
}: TallyReportProps) {
  const selectedYear = year || new Date().getFullYear();
  const [months, setMonths] = useState<number[]>(() =>
    currentMonthMonths(selectedYear),
  );
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([
    TALLY_ALL_WEEKS,
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [yearOptions, setYearOptions] = useState<number[]>([selectedYear]);
  const [yearsLoading, setYearsLoading] = useState(false);

  const weekParam = useMemo(
    () => weeksQueryParam(selectedWeeks),
    [selectedWeeks],
  );

  const { rows, loading, error } = useEvangelismTally({
    year: selectedYear,
    cluster: clusterId,
    week_number: weekParam,
  });
  const [clusterSortKey, setClusterSortKey] = useState<TallyClusterSortKey>(
    DEFAULT_TALLY_CLUSTER_SORT_KEY,
  );
  const [clusterSortDir, setClusterSortDir] = useState<TallyClusterSortDir>(
    DEFAULT_TALLY_CLUSTER_SORT_DIR,
  );
  const [drilldown, setDrilldown] = useState<{
    year: number;
    weekNumber: number;
    clusterId: number | string | null;
    clusterCode: string;
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">;
    label: string;
  } | null>(null);
  const [viewCluster, setViewCluster] = useState<Cluster | null>(null);
  const [loadingClusterId, setLoadingClusterId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  useEffect(() => {
    setMonths(currentMonthMonths(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    setSelectedWeeks((current) =>
      pruneSelectedWeeks(current, selectedYear, months),
    );
  }, [months, selectedYear]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const fetchYears = async () => {
      try {
        setYearsLoading(true);
        const response = await evangelismApi.getPeopleTallyYears();
        if (cancelled) return;
        const years = response.data.years || [];
        const fallbackYear =
          response.data.default_year || new Date().getFullYear();
        const nextYears = years.length > 0 ? years : [fallbackYear];
        setYearOptions(nextYears);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setYearOptions([new Date().getFullYear()]);
        }
      } finally {
        if (!cancelled) {
          setYearsLoading(false);
        }
      }
    };
    void fetchYears();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setYearOptions((current) => {
      if (current.includes(selectedYear)) {
        return current;
      }
      return [...current, selectedYear].sort((a, b) => b - a);
    });
  }, [selectedYear]);

  useEffect(() => {
    if (!onYearChange || yearOptions.length === 0) {
      return;
    }
    if (!yearOptions.includes(selectedYear)) {
      onYearChange(yearOptions[0]);
    }
  }, [onYearChange, selectedYear, yearOptions]);

  const monthWeekSet = useMemo(
    () => new Set(weeksOverlappingMonths(selectedYear, months)),
    [months, selectedYear],
  );

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    const filtered = rows.filter((row) => {
      if (allowedClusterIds != null) {
        const allowed = new Set(allowedClusterIds.map(Number));
        if (row.cluster_id == null || !allowed.has(Number(row.cluster_id))) {
          return false;
        }
      }
      if (!weekParam && !monthWeekSet.has(row.week_number)) {
        return false;
      }
      if (query) {
        const code = (row.cluster_code || "").toLowerCase();
        const name = (row.cluster_name || "").toLowerCase();
        if (!code.includes(query) && !name.includes(query)) {
          return false;
        }
      }
      return true;
    });
    return [...filtered].sort((left, right) => {
      const clusterCmp = compareClusterRows(
        left,
        right,
        clusterSortKey,
        clusterSortDir,
      );
      if (clusterCmp !== 0) return clusterCmp;
      if (left.year !== right.year) return right.year - left.year;
      return right.week_number - left.week_number;
    });
  }, [
    allowedClusterIds,
    clusterSortDir,
    clusterSortKey,
    debouncedSearch,
    monthWeekSet,
    rows,
    weekParam,
  ]);

  const totalPages = Math.ceil(visibleRows.length / itemsPerPage) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = visibleRows.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    itemsPerPage,
    months,
    selectedWeeks,
    selectedYear,
    clusterSortKey,
    clusterSortDir,
  ]);

  const handleClusterHeaderClick = () => {
    const next = nextClusterSort(clusterSortKey, clusterSortDir);
    setClusterSortKey(next.key);
    setClusterSortDir(next.dir);
  };

  const handleResetFilters = () => {
    const nextYear = yearOptions.includes(new Date().getFullYear())
      ? new Date().getFullYear()
      : yearOptions[0] || selectedYear;
    if (onYearChange) {
      onYearChange(nextYear);
    }
    setMonths(currentMonthMonths(nextYear));
    setSelectedWeeks([TALLY_ALL_WEEKS]);
    setSearchInput("");
    setDebouncedSearch("");
    setClusterSortKey(DEFAULT_TALLY_CLUSTER_SORT_KEY);
    setClusterSortDir(DEFAULT_TALLY_CLUSTER_SORT_DIR);
    setCurrentPage(1);
    setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
  };

  const openWeeklyDrilldown = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string,
    value: number,
  ) => {
    if (!value) {
      return;
    }
    setDrilldown({
      year: row.year,
      weekNumber: row.week_number,
      clusterId: row.cluster_id ?? null,
      clusterCode: row.cluster_code || "Unassigned",
      metric,
      label,
    });
  };

  const openClusterView = useCallback(async (row: EvangelismTallyRow) => {
    if (row.cluster_id == null) {
      return;
    }
    if (loadingClusterId != null) {
      return;
    }
    setLoadingClusterId(row.cluster_id);
    try {
      const { data } = await clustersApi.getById(row.cluster_id);
      setViewCluster(data);
    } catch (e) {
      console.error("Failed to load cluster detail", e);
    } finally {
      setLoadingClusterId(null);
    }
  }, [loadingClusterId]);

  const closeClusterView = useCallback(() => {
    setViewCluster(null);
  }, []);

  const renderWeeklyClickableCell = (
    row: EvangelismTallyRow,
    metric: Extract<EvangelismTallyDrilldownMetric, "members" | "visitors">,
    label: string,
  ) => {
    const count = Number(
      metric === "members" ? row.members_count || 0 : row.visitors_count || 0,
    );
    if (count <= 0) {
      return <span className="text-sm text-gray-400">{count}</span>;
    }
    return (
      <button
        type="button"
        className="text-sm font-medium text-primary hover:text-primary hover:underline"
        onClick={() => openWeeklyDrilldown(row, metric, label, count)}
      >
        {count}
      </button>
    );
  };

  const renderClusterCell = (row: EvangelismTallyRow) => {
    const labels = clusterCellLabels({
      cluster_id: row.cluster_id,
      cluster_code: row.cluster_code || (row.cluster_id == null ? "N/A" : null),
      cluster_name: row.cluster_name,
    });
    const content = (
      <>
        <span className="block">{labels.primary}</span>
        {labels.secondary ? (
          <span className="mt-0.5 block text-xs font-normal text-gray-500">
            {labels.secondary}
          </span>
        ) : null}
      </>
    );
    if (row.cluster_id == null) {
      return (
        <span className="text-sm text-gray-700" title={labels.title}>
          {content}
        </span>
      );
    }
    const isLoading = loadingClusterId === row.cluster_id;
    return (
      <button
        type="button"
        className="text-left text-sm font-medium text-primary hover:text-primary hover:underline disabled:opacity-60"
        disabled={isLoading}
        title={labels.title}
        onClick={() => void openClusterView(row)}
      >
        {content}
      </button>
    );
  };

  const clusterHeaderLabel = clusterSortHeaderLabel(clusterSortKey);
  const clusterSortIcon =
    clusterSortDir === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Weekly Tally Records";
    }
    return `${drilldown.label} - ${drilldown.clusterCode} (${drilldown.year} W${drilldown.weekNumber})`;
  }, [drilldown]);

  const fetchDrilldownPage = useCallback(
    async (pageNumber: number) => {
      if (!drilldown) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      const response = await evangelismApi.getWeeklyTallyPeopleDetail({
        year: drilldown.year,
        week_number: drilldown.weekNumber,
        cluster_id: drilldown.clusterId ?? "unassigned",
        metric: drilldown.metric,
        page: pageNumber,
        page_size: 20,
      });
      return response.data;
    },
    [drilldown],
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,6.75rem)_minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center">
        {onYearChange ? (
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="h-11 min-h-[44px] w-full rounded-md border border-gray-200 bg-white px-3 py-0 text-sm"
            aria-label="Filter by year"
            disabled={yearsLoading}
          >
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        ) : (
          <div
            className="flex h-11 min-h-[44px] items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700"
            aria-label="Year"
          >
            {selectedYear}
          </div>
        )}
        <TallyMonthFilter
          year={selectedYear}
          months={months}
          onChange={setMonths}
        />
        <TallyWeekFilter
          year={selectedYear}
          months={months}
          weeks={selectedWeeks}
          onChange={setSelectedWeeks}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search cluster..."
          aria-label="Search cluster"
          className="h-11 min-h-[44px] w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
        />
        <Button
          variant="tertiary"
          type="button"
          onClick={handleResetFilters}
          className="h-11 min-h-[44px] w-full md:w-auto"
        >
          Reset
        </Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading tally...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">Error: {error}</div>
      ) : visibleRows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tally data available
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            <ViewModeToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {viewMode === "table" && (
              <span className="text-xs text-gray-500">
                Table scrolls horizontally.
              </span>
            )}
          </div>
          <Table
            mobileCardView={effectiveViewMode === "cards"}
            columns={[
              {
                header: clusterHeaderLabel,
                accessor: "cluster_code" as keyof EvangelismTallyRow,
                desktopHeader: (
                  <div className="flex items-center gap-1">
                    <span>{clusterHeaderLabel}</span>
                    {clusterSortIcon}
                  </div>
                ),
                onHeaderClick: handleClusterHeaderClick,
                render: (_value, row) => renderClusterCell(row),
              },
              {
                header: "Week",
                accessor: "week_number" as keyof EvangelismTallyRow,
                render: (value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.year} W{value}
                  </span>
                ),
              },
              {
                header: "Meeting Date",
                accessor: "meeting_date" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {formatLocaleDate(value as string) || "N/A"}
                  </span>
                ),
              },
              {
                header: "Gathering",
                accessor: "gathering_type" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEvangelismGatheringTypeChipClass(
                      value as string,
                    )}`}
                  >
                    {(value as string) || "N/A"}
                  </span>
                ),
              },
              {
                header: "Members",
                accessor: "members_count" as keyof EvangelismTallyRow,
                render: (_value, row) =>
                  renderWeeklyClickableCell(row, "members", "Members"),
              },
              {
                header: "Visitors",
                accessor: "visitors_count" as keyof EvangelismTallyRow,
                render: (_value, row) =>
                  renderWeeklyClickableCell(row, "visitors", "Visitors"),
              },
              {
                header: "New Visitors",
                accessor: "new_prospects" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Conversions",
                accessor: "conversions_this_week" as keyof EvangelismTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Reports",
                accessor:
                  "evangelism_reports_count" as keyof EvangelismTallyRow,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.evangelism_reports_count + row.cluster_reports_count}
                  </span>
                ),
              },
            ]}
            data={paginatedRows}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={visibleRows.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            showItemsPerPage
            className="mt-4"
          />
        </>
      )}
      <TallyDrilldownModal
        isOpen={Boolean(drilldown)}
        title={drilldownTitle}
        requestKey={
          drilldown
            ? `${drilldown.year}-${drilldown.weekNumber}-${drilldown.clusterId}-${drilldown.metric}`
            : null
        }
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
      {viewCluster && (
        <Modal
          isOpen={Boolean(viewCluster)}
          onClose={closeClusterView}
          title=""
          hideHeader
          closeOnOutsideClick
        >
          <ClusterView
            cluster={viewCluster}
            clusterMembers={resolveClusterRosterPeople(viewCluster, [])}
            clusterFamilies={resolveClusterRosterFamilies(viewCluster, [])}
            onEdit={() => {}}
            onDelete={() => {}}
            onClose={closeClusterView}
            onAssignMembers={() => {}}
            onSubmitReport={() => {}}
            showSubmitReportButton={false}
            canManageCluster={false}
          />
        </Modal>
      )}
    </>
  );
}

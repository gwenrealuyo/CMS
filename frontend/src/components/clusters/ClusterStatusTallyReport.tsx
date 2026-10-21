"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import TallyMonthFilter from "@/src/components/evangelism/TallyMonthFilter";
import TallyWeekFilter, {
  TALLY_ALL_WEEKS,
  pruneSelectedWeeks,
  weeksQueryParam,
} from "@/src/components/evangelism/TallyWeekFilter";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import ClusterStatusTallyDrilldownModal from "@/src/components/clusters/ClusterStatusTallyDrilldownModal";
import { clustersApi } from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import {
  TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS,
  TOOLBAR_BRANCH_SELECT_LOCKED_CLASS,
} from "@/src/lib/toolbarStyles";
import {
  currentMonthMonths,
  formatMonthsLabel,
  monthsQueryParam,
} from "@/src/lib/tallyMonthWindow";
import {
  DEFAULT_TALLY_CLUSTER_SORT_DIR,
  DEFAULT_TALLY_CLUSTER_SORT_KEY,
  DEFAULT_TALLY_CORD_SORT_DIR,
  DEFAULT_TALLY_CORD_SORT_KEY,
  TallyClusterSortDir,
  TallyClusterSortKey,
  TallyCordSortKey,
  clusterCellLabels,
  clusterSortHeaderLabel,
  compareClusterRows,
  compareCordRows,
  cordCellLabels,
  cordClusterCellLabels,
  isTallyWarningRow,
  nextClusterSort,
} from "@/src/lib/tallyClusterSort";
import {
  ClusterStatusTallyRow,
  ClusterStatusTallyStatus,
} from "@/src/types/cluster";

interface ClusterStatusTallyReportProps {
  canViewPeople: boolean;
  branch: number | "";
  onBranchChange: (branch: number | "") => void;
  branchOptions: { value: string; label: string }[];
  branchSelectionLocked?: boolean;
  branchLockedHint?: string;
  defaultLockedBranch?: number | "";
  /** When true, branch is controlled elsewhere (e.g. page tab row). */
  hideBranchFilter?: boolean;
}

type StatusMetric = ClusterStatusTallyStatus;
type StatusLayoutMode = "cluster" | "cord";
type SortField =
  | TallyClusterSortKey
  | TallyCordSortKey
  | keyof ClusterStatusTallyRow;
type SortDirection = TallyClusterSortDir;

function isClusterSortField(field: SortField): field is TallyClusterSortKey {
  return field === "cluster_code" || field === "cluster_name";
}

function isCordSortField(field: SortField): field is TallyCordSortKey {
  return field === "cord_name" || field === "cluster_code";
}

const STATUS_COLUMNS: Array<{
  status: StatusMetric;
  header: string;
  accessor: keyof ClusterStatusTallyRow;
}> = [
  { status: "ACTIVE", header: "Active", accessor: "active_count" },
  {
    status: "SEMIACTIVE",
    header: "Semi-active",
    accessor: "semiactive_count",
  },
  { status: "INACTIVE", header: "Inactive", accessor: "inactive_count" },
  { status: "DORMANT", header: "Dormant", accessor: "dormant_count" },
  { status: "FALLAWAY", header: "Fall Away", accessor: "fallaway_count" },
  { status: "DECEASED", header: "Deceased", accessor: "deceased_count" },
  { status: "members", header: "Members", accessor: "members_count" },
];

export default function ClusterStatusTallyReport({
  canViewPeople,
  branch,
  onBranchChange,
  branchOptions,
  branchSelectionLocked = false,
  branchLockedHint,
  defaultLockedBranch = "",
  hideBranchFilter = false,
}: ClusterStatusTallyReportProps) {
  const selectedBranch = branch === "" ? "" : Number(branch);
  const [layoutMode, setLayoutMode] = useState<StatusLayoutMode>("cluster");
  const isCordLayout = layoutMode === "cord";
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [months, setMonths] = useState<number[]>(() =>
    currentMonthMonths(new Date().getFullYear()),
  );
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([
    TALLY_ALL_WEEKS,
  ]);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [rows, setRows] = useState<ClusterStatusTallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(
    DEFAULT_TALLY_CLUSTER_SORT_KEY,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_TALLY_CLUSTER_SORT_DIR,
  );
  const [drilldown, setDrilldown] = useState<{
    months: number[];
    weeks: number[] | null;
    status: StatusMetric;
    label: string;
    clusterId?: number | "unassigned" | null;
    cordId?: number | "uncorded" | null;
    rowKind?: ClusterStatusTallyRow["row_kind"];
    clusterName?: string | null;
    cordName?: string | null;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;
  const needsBranch = selectedBranch === "";

  const weekParam = useMemo(
    () => weeksQueryParam(selectedWeeks),
    [selectedWeeks],
  );

  const selectedWeekNumbers = useMemo(() => {
    if (!weekParam) {
      return null;
    }
    return weekParam.split(",").map((value) => Number(value));
  }, [weekParam]);

  useEffect(() => {
    setMonths(currentMonthMonths(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    setSelectedWeeks((current) =>
      pruneSelectedWeeks(current, selectedYear, months),
    );
  }, [months, selectedYear]);

  useEffect(() => {
    if (isCordLayout) {
      setSortField(DEFAULT_TALLY_CORD_SORT_KEY);
      setSortDirection(DEFAULT_TALLY_CORD_SORT_DIR);
    } else {
      setSortField(DEFAULT_TALLY_CLUSTER_SORT_KEY);
      setSortDirection(DEFAULT_TALLY_CLUSTER_SORT_DIR);
    }
    setDrilldown(null);
  }, [isCordLayout]);

  useEffect(() => {
    if (needsBranch) {
      setYearOptions([new Date().getFullYear()]);
      return;
    }
    let cancelled = false;
    const fetchYears = async () => {
      try {
        setYearsLoading(true);
        const response = await clustersApi.getStatusTallyYears({
          branch_id: selectedBranch,
        });
        if (cancelled) return;
        const years = response.data.years || [];
        const fallbackYear =
          response.data.default_year || new Date().getFullYear();
        setYearOptions(years.length > 0 ? years : [fallbackYear]);
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
    fetchYears();
    return () => {
      cancelled = true;
    };
  }, [needsBranch, selectedBranch]);

  useEffect(() => {
    if (yearOptions.length === 0) {
      return;
    }
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [selectedYear, yearOptions]);

  useEffect(() => {
    if (needsBranch) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      try {
        setLoading(true);
        const response = await clustersApi.getStatusTally({
          year: selectedYear,
          branch_id: selectedBranch,
          months: monthsQueryParam(months),
          group_by: isCordLayout ? "cord" : "cluster",
          ...(weekParam ? { week_number: weekParam } : {}),
        });
        if (cancelled) return;
        setRows(response.data);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load status tally");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [
    needsBranch,
    selectedBranch,
    selectedYear,
    months,
    weekParam,
    isCordLayout,
  ]);

  const asOfLabel = rows[0]?.as_of ? formatLocaleDate(rows[0].as_of) : null;

  const sortedRows = useMemo(() => {
    const body = rows.filter((row) => row.row_kind !== "total");
    const total = rows.filter((row) => row.row_kind === "total");
    const direction = sortDirection === "asc" ? 1 : -1;
    body.sort((left, right) => {
      if (isCordLayout && isCordSortField(sortField)) {
        return compareCordRows(left, right, sortField, sortDirection);
      }
      if (!isCordLayout && isClusterSortField(sortField)) {
        return compareClusterRows(left, right, sortField, sortDirection);
      }
      const leftValue = Number(left[sortField] ?? 0);
      const rightValue = Number(right[sortField] ?? 0);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      if (isCordLayout) {
        return compareCordRows(
          left,
          right,
          DEFAULT_TALLY_CORD_SORT_KEY,
          DEFAULT_TALLY_CORD_SORT_DIR,
        );
      }
      return compareClusterRows(
        left,
        right,
        DEFAULT_TALLY_CLUSTER_SORT_KEY,
        DEFAULT_TALLY_CLUSTER_SORT_DIR,
      );
    });
    return [...body, ...total];
  }, [isCordLayout, rows, sortDirection, sortField]);

  const handleClusterHeaderClick = () => {
    if (isClusterSortField(sortField)) {
      const next = nextClusterSort(sortField, sortDirection);
      setSortField(next.key);
      setSortDirection(next.dir);
      return;
    }
    setSortField(DEFAULT_TALLY_CLUSTER_SORT_KEY);
    setSortDirection(DEFAULT_TALLY_CLUSTER_SORT_DIR);
  };

  const toggleCordSort = (key: TallyCordSortKey) => {
    if (sortField === key) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(key);
    setSortDirection("asc");
  };

  const handleMetricSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("desc");
  };

  const renderSortIcon = (active: boolean) => {
    if (!active) {
      return null;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const renderSortableHeader = (label: string, active: boolean) => (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      {renderSortIcon(active)}
    </div>
  );

  const openDrilldown = (
    row: ClusterStatusTallyRow,
    status: StatusMetric,
    label: string,
    value: number,
  ) => {
    if (!canViewPeople || !value) {
      return;
    }
    if (isCordLayout) {
      const cordId =
        row.row_kind === "uncorded"
          ? "uncorded"
          : row.row_kind === "cord"
            ? (row.cord_id ?? null)
            : null;
      setDrilldown({
        months,
        weeks: selectedWeekNumbers,
        status,
        label,
        cordId,
        rowKind: row.row_kind,
        cordName: row.cord_name,
        clusterName: row.cluster_name,
      });
      return;
    }
    const clusterId =
      row.row_kind === "unassigned"
        ? "unassigned"
        : row.row_kind === "cluster"
          ? (row.cluster_id ?? null)
          : null;
    setDrilldown({
      months,
      weeks: selectedWeekNumbers,
      status,
      label,
      clusterId,
      rowKind: row.row_kind,
      clusterName: row.cluster_name,
    });
  };

  const renderDrilldownCell = (
    row: ClusterStatusTallyRow,
    status: StatusMetric,
    label: string,
    accessor: keyof ClusterStatusTallyRow,
  ) => {
    const count = Number(row[accessor] ?? 0);
    const isTotal = row.row_kind === "total";
    if (count <= 0 || !canViewPeople) {
      return (
        <span
          className={`text-sm ${
            count <= 0 ? "text-gray-400" : "text-gray-700"
          } ${isTotal ? "font-semibold" : ""}`}
        >
          {count}
        </span>
      );
    }
    return (
      <button
        type="button"
        className={`text-sm font-medium text-primary hover:text-primary hover:underline ${
          isTotal ? "font-semibold" : ""
        }`}
        onClick={() => openDrilldown(row, status, label, count)}
      >
        {count}
      </button>
    );
  };

  const renderLabeledCell = (
    labels: ReturnType<typeof clusterCellLabels>,
    warning: boolean,
  ) => (
    <span
      className={`text-sm ${
        warning
          ? "font-medium text-red-600"
          : labels.isTotal
            ? "font-semibold text-gray-700"
            : "text-gray-700"
      }`}
      title={labels.title}
    >
      <span className="block">{labels.primary}</span>
      {labels.secondary ? (
        <span
          className={`mt-0.5 block text-xs font-normal ${
            warning ? "text-red-500" : "text-gray-500"
          }`}
        >
          {labels.secondary}
        </span>
      ) : null}
    </span>
  );

  const renderEntityCell = (row: ClusterStatusTallyRow) => {
    const labels = isCordLayout ? cordCellLabels(row) : clusterCellLabels(row);
    return renderLabeledCell(labels, isTallyWarningRow(row.row_kind));
  };

  const renderCordClusterCell = (row: ClusterStatusTallyRow) =>
    renderLabeledCell(cordClusterCellLabels(row), false);

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Status tally";
    }
    const windowLabel = formatMonthsLabel(drilldown.months, selectedYear);
    const weekLabel =
      drilldown.weeks && drilldown.weeks.length > 0
        ? ` · W${drilldown.weeks.join(", W")}`
        : "";
    const scopeLabel = isCordLayout
      ? drilldown.cordName || "All cords"
      : drilldown.clusterName || "All clusters";
    return `${drilldown.label} — ${windowLabel}${weekLabel} — ${scopeLabel}`;
  }, [drilldown, isCordLayout, selectedYear]);

  const fetchDrilldownPage = useCallback(
    async (page: number) => {
      if (!drilldown) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      const response = await clustersApi.getStatusTallyDetail({
        year: selectedYear,
        branch_id: selectedBranch === "" ? undefined : selectedBranch,
        months: monthsQueryParam(drilldown.months),
        ...(drilldown.weeks && drilldown.weeks.length > 0
          ? { week_number: drilldown.weeks.join(",") }
          : {}),
        status: drilldown.status,
        page,
        page_size: 20,
        ...(isCordLayout
          ? drilldown.rowKind === "uncorded"
            ? { cord: "uncorded" }
            : drilldown.rowKind === "cord" && drilldown.cordId != null
              ? { cord: drilldown.cordId }
              : {}
          : drilldown.rowKind === "unassigned"
            ? { cluster: "unassigned" }
            : drilldown.rowKind === "cluster" && drilldown.clusterId != null
              ? { cluster: drilldown.clusterId }
              : {}),
      });
      return response.data;
    },
    [drilldown, isCordLayout, selectedYear, selectedBranch],
  );

  const handleResetFilters = () => {
    const restoredBranch =
      defaultLockedBranch === "" ? "" : Number(defaultLockedBranch);
    onBranchChange(Number.isNaN(restoredBranch) ? "" : restoredBranch);
    const fallbackYear = yearOptions.includes(new Date().getFullYear())
      ? new Date().getFullYear()
      : yearOptions[0] || new Date().getFullYear();
    setSelectedYear(fallbackYear);
    setMonths(currentMonthMonths(fallbackYear));
    setSelectedWeeks([TALLY_ALL_WEEKS]);
    if (isCordLayout) {
      setSortField(DEFAULT_TALLY_CORD_SORT_KEY);
      setSortDirection(DEFAULT_TALLY_CORD_SORT_DIR);
    } else {
      setSortField(DEFAULT_TALLY_CLUSTER_SORT_KEY);
      setSortDirection(DEFAULT_TALLY_CLUSTER_SORT_DIR);
    }
  };

  const entityHeaderLabel = isCordLayout
    ? "Name"
    : clusterSortHeaderLabel(
        isClusterSortField(sortField)
          ? sortField
          : DEFAULT_TALLY_CLUSTER_SORT_KEY,
      );
  const entityHeaderActive = isCordLayout
    ? sortField === "cord_name"
    : isClusterSortField(sortField);

  const columns = [
    {
      header: entityHeaderLabel,
      accessor: (isCordLayout
        ? "cord_name"
        : "cluster_code") as keyof ClusterStatusTallyRow,
      desktopHeader: renderSortableHeader(entityHeaderLabel, entityHeaderActive),
      onHeaderClick: isCordLayout
        ? () => toggleCordSort("cord_name")
        : handleClusterHeaderClick,
      render: (_value: unknown, row: ClusterStatusTallyRow) =>
        renderEntityCell(row),
    },
    ...(isCordLayout
      ? [
          {
            header: "Code",
            accessor: "cluster_code" as keyof ClusterStatusTallyRow,
            desktopHeader: renderSortableHeader(
              "Code",
              sortField === "cluster_code",
            ),
            onHeaderClick: () => toggleCordSort("cluster_code"),
            render: (_value: unknown, row: ClusterStatusTallyRow) =>
              renderCordClusterCell(row),
          },
        ]
      : []),
    ...STATUS_COLUMNS.map((column) => ({
      header: column.header,
      accessor: column.accessor,
      desktopHeader: renderSortableHeader(
        column.header,
        sortField === column.accessor,
      ),
      onHeaderClick: () => handleMetricSort(column.accessor),
      render: (_value: unknown, row: ClusterStatusTallyRow) =>
        renderDrilldownCell(row, column.status, column.header, column.accessor),
    })),
  ];

  const tallyBranchInteractive = !branchSelectionLocked;
  const branchSelectEl = (
    <select
      aria-label="Filter by branch"
      aria-disabled={!tallyBranchInteractive}
      tabIndex={tallyBranchInteractive ? 0 : -1}
      value={selectedBranch === "" ? "" : selectedBranch}
      onChange={(event) => {
        if (!tallyBranchInteractive) return;
        onBranchChange(Number(event.target.value) || "");
      }}
      className={
        tallyBranchInteractive
          ? `${TOOLBAR_BRANCH_SELECT_FULL_WIDTH_CLASS} h-11 min-h-[44px] py-0`
          : `${TOOLBAR_BRANCH_SELECT_LOCKED_CLASS} h-11 min-h-[44px] py-0`
      }
    >
      {branchOptions.map((option) => (
        <option
          key={option.value === "" ? "__all_branches__" : option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <Card>
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Status Tally
            </h3>
            <p className="text-sm text-gray-500">
              Member statuses at the end of the selected{" "}
              {selectedWeekNumbers ? "weeks" : "months"}
              {asOfLabel ? ` (as of ${asOfLabel})` : ""}.
            </p>
          </div>
          <SegmentedControl
            value={layoutMode}
            onChange={setLayoutMode}
            fullWidthOnMobile
            options={[
              { id: "cluster", label: "By cluster" },
              { id: "cord", label: "By 5x5 cord" },
            ]}
          />
        </div>
        <div
          className={`mb-4 grid grid-cols-1 gap-2 md:items-center ${
            hideBranchFilter
              ? "md:grid-cols-[minmax(0,6.75rem)_minmax(0,1.25fr)_minmax(0,1.5fr)_auto]"
              : "md:grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.5fr)_auto]"
          }`}
        >
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
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
          {!hideBranchFilter &&
            (tallyBranchInteractive ? (
              branchSelectEl
            ) : (
              <LockedControlTooltip
                label={
                  branchLockedHint?.trim()
                    ? branchLockedHint
                    : "Branch is limited to your assignment."
                }
                wrapperClassName="block h-11 min-h-[44px] min-w-0 w-full cursor-default"
              >
                {branchSelectEl}
              </LockedControlTooltip>
            ))}
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
          <Button
            variant="tertiary"
            onClick={handleResetFilters}
            className="h-11 min-h-[44px] py-0 md:min-h-[44px] md:py-0 text-sm"
          >
            Reset
          </Button>
        </div>
        {needsBranch ? (
          <div className="text-center py-8 text-gray-500">
            Select a branch to compare {isCordLayout ? "5x5 cords" : "clusters"}
            .
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-gray-500">Loading tally...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error: {error}</div>
        ) : sortedRows.length === 0 ? (
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
                  Table scrolls horizontally. Tap a header to sort.
                </span>
              )}
            </div>
            <Table
              mobileCardView={effectiveViewMode === "cards"}
              columns={columns}
              data={sortedRows}
            />
          </>
        )}
      </div>
      {canViewPeople && (
        <ClusterStatusTallyDrilldownModal
          isOpen={Boolean(drilldown)}
          title={drilldownTitle}
          requestKey={
            drilldown
              ? `${layoutMode}-${selectedYear}-${monthsQueryParam(drilldown.months)}-${
                  drilldown.weeks?.join(",") || "all"
                }-${drilldown.status}-${drilldown.rowKind || "total"}-${
                  drilldown.clusterId ?? ""
                }-${drilldown.cordId ?? ""}`
              : null
          }
          onClose={() => setDrilldown(null)}
          fetchPage={fetchDrilldownPage}
        />
      )}
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import TallyMonthFilter from "@/src/components/evangelism/TallyMonthFilter";
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
  ClusterStatusTallyRow,
  ClusterStatusTallyStatus,
} from "@/src/types/cluster";

interface ClusterStatusTallyReportProps {
  branch: number | "";
  onBranchChange: (branch: number | "") => void;
  branchOptions: { value: string; label: string }[];
  branchSelectionLocked?: boolean;
  branchLockedHint?: string;
  defaultLockedBranch?: number | "";
}

type StatusMetric = ClusterStatusTallyStatus;

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
  branch,
  onBranchChange,
  branchOptions,
  branchSelectionLocked = false,
  branchLockedHint,
  defaultLockedBranch = "",
}: ClusterStatusTallyReportProps) {
  const selectedBranch = branch === "" ? "" : Number(branch);
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [months, setMonths] = useState<number[]>(() =>
    currentMonthMonths(new Date().getFullYear()),
  );
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [rows, setRows] = useState<ClusterStatusTallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{
    months: number[];
    status: StatusMetric;
    label: string;
    clusterId?: number | "unassigned" | null;
    rowKind?: ClusterStatusTallyRow["row_kind"];
    clusterName?: string | null;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;
  const needsBranch = selectedBranch === "";

  useEffect(() => {
    setMonths(currentMonthMonths(selectedYear));
  }, [selectedYear]);

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
  }, [needsBranch, selectedBranch, selectedYear, months]);

  const asOfLabel = rows[0]?.as_of
    ? formatLocaleDate(rows[0].as_of)
    : null;

  const openDrilldown = (
    row: ClusterStatusTallyRow,
    status: StatusMetric,
    label: string,
    value: number,
  ) => {
    if (!value) {
      return;
    }
    const clusterId =
      row.row_kind === "unassigned"
        ? "unassigned"
        : row.row_kind === "cluster"
          ? row.cluster_id ?? null
          : null;
    setDrilldown({
      months,
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
    if (count <= 0) {
      return (
        <span
          className={`text-sm text-gray-400 ${isTotal ? "font-semibold" : ""}`}
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

  const renderClusterName = (row: ClusterStatusTallyRow) => {
    const name = (row.cluster_name || row.cluster_code || "Cluster").trim();
    const isTotal = row.row_kind === "total";
    return (
      <span className={`text-sm text-gray-700 ${isTotal ? "font-semibold" : ""}`}>
        {name}
      </span>
    );
  };

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Status tally";
    }
    const windowLabel = formatMonthsLabel(drilldown.months, selectedYear);
    const scopeLabel = drilldown.clusterName || "All clusters";
    return `${drilldown.label} — ${windowLabel} — ${scopeLabel}`;
  }, [drilldown, selectedYear]);

  const fetchDrilldownPage = useCallback(
    async (page: number) => {
      if (!drilldown) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      const response = await clustersApi.getStatusTallyDetail({
        year: selectedYear,
        branch_id: selectedBranch === "" ? undefined : selectedBranch,
        months: monthsQueryParam(drilldown.months),
        status: drilldown.status,
        page,
        page_size: 20,
        ...(drilldown.rowKind === "unassigned"
          ? { cluster: "unassigned" }
          : drilldown.rowKind === "cluster" && drilldown.clusterId != null
            ? { cluster: drilldown.clusterId }
            : {}),
      });
      return response.data;
    },
    [drilldown, selectedYear, selectedBranch],
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
  };

  const columns = [
    {
      header: "Cluster",
      accessor: "cluster_name" as keyof ClusterStatusTallyRow,
      render: (_value: unknown, row: ClusterStatusTallyRow) =>
        renderClusterName(row),
    },
    ...STATUS_COLUMNS.map((column) => ({
      header: column.header,
      accessor: column.accessor,
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
        <option key={option.value === "" ? "__all_branches__" : option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <Card>
      <div>
        <div className="mb-4 flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-gray-900">Status Tally</h3>
          <p className="text-sm text-gray-500">
            Member statuses at the end of the selected months
            {asOfLabel ? ` (as of ${asOfLabel})` : ""}.
          </p>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
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
          {tallyBranchInteractive ? (
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
          )}
          <TallyMonthFilter
            year={selectedYear}
            months={months}
            onChange={setMonths}
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
            Select a branch to compare clusters.
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-gray-500">Loading tally...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error: {error}</div>
        ) : rows.length === 0 ? (
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
              columns={columns}
              data={rows}
            />
          </>
        )}
      </div>
      <ClusterStatusTallyDrilldownModal
        isOpen={Boolean(drilldown)}
        title={drilldownTitle}
        requestKey={
          drilldown
            ? `${selectedYear}-${monthsQueryParam(drilldown.months)}-${drilldown.status}-${
                drilldown.rowKind || "total"
              }-${drilldown.clusterId ?? ""}`
            : null
        }
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
    </Card>
  );
}

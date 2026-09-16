"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import {
  EvangelismPeopleTallyRow,
  EvangelismTallyDrilldownMetric,
  EvangelismGroup,
} from "@/src/types/evangelism";
import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { useEvangelismPeopleTally } from "@/src/hooks/useEvangelism";
import { evangelismApi, clustersApi } from "@/src/lib/api";
import { EVANGELISM_BRANCH_LOCKED_HINT } from "@/src/lib/evangelismBranchFilter";
import {
  EVANGELISM_BRANCH_SELECT_FULL_WIDTH_CLASS,
  EVANGELISM_BRANCH_SELECT_LOCKED_CLASS,
} from "@/src/components/evangelism/EvangelismToolbarSearch";
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";
import TallyMonthFilter from "@/src/components/evangelism/TallyMonthFilter";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import {
  MONTH_NAMES,
  defaultMonthsForYear,
  formatMonthsLabel,
  monthsQueryParam,
} from "@/src/lib/tallyMonthWindow";

export interface TallyScopeParams {
  cluster?: number;
  evangelism_group?: number;
}

export function parseTallyScope(encoded: string): TallyScopeParams {
  if (!encoded) return {};
  const idx = encoded.indexOf(":");
  if (idx <= 0) return {};
  const kind = encoded.slice(0, idx);
  const id = Number(encoded.slice(idx + 1));
  if (Number.isNaN(id)) return {};
  if (kind === "cluster") return { cluster: id };
  if (kind === "group") return { evangelism_group: id };
  return {};
}

interface PeopleTallyReportProps {
  year?: number;
  onYearChange?: (year: number) => void;
  branch?: number | "";
  onBranchChange?: (branch: number | "") => void;
  branches?: Branch[];
  tallyScope?: string;
  onTallyScopeChange?: (scope: string) => void;
  /** When true, branch filter cannot be changed (reset uses defaultLockedBranch). */
  branchSelectionLocked?: boolean;
  branchLockedHint?: string;
  defaultLockedBranch?: number | "";
  /** Hide branch select when branch is controlled externally (e.g. analytics hub). */
  hideBranchFilter?: boolean;
  /** Slightly bolder count cells (analytics E1R1 tab). */
  emphasizeCountCells?: boolean;
  /** When set, only these evangelism groups (and their clusters) appear in scope. */
  allowedGroupIds?: number[];
}

type PeopleTallyMetric = Extract<
  EvangelismTallyDrilldownMetric,
  | "invited"
  | "attended"
  | "students"
  | "baptized"
  | "received_hg"
  | "reached"
  | "unique_hc"
>;

type TallyLayoutMode = "cluster" | "month";

export default function PeopleTallyReport({
  year,
  onYearChange,
  branch = "",
  onBranchChange,
  branches = [],
  tallyScope = "",
  onTallyScopeChange,
  branchSelectionLocked = false,
  branchLockedHint,
  defaultLockedBranch = "",
  hideBranchFilter = false,
  emphasizeCountCells = false,
  allowedGroupIds,
}: PeopleTallyReportProps) {
  const selectedYear = year || new Date().getFullYear();
  const selectedBranch = branch === "" ? "" : Number(branch);
  const [layoutMode, setLayoutMode] = useState<TallyLayoutMode>("cluster");
  const [months, setMonths] = useState<number[]>(() =>
    defaultMonthsForYear(selectedYear),
  );

  const scopeParams = useMemo(() => parseTallyScope(tallyScope), [tallyScope]);
  const isClusterLayout = layoutMode === "cluster";
  const needsBranchForClusters = isClusterLayout && selectedBranch === "";

  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [evangelismGroups, setEvangelismGroups] = useState<EvangelismGroup[]>(
    [],
  );

  useEffect(() => {
    setMonths(defaultMonthsForYear(selectedYear));
  }, [selectedYear]);

  useEffect(() => {
    let cancelled = false;
    const loadClusters = async () => {
      try {
        const res = await clustersApi.getAll({ page_size: 500 });
        if (!cancelled) setClusters(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    loadClusters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      try {
        setGroupsLoading(true);
        const params: Record<string, string | number | boolean | undefined> = {
          is_active: true,
        };
        if (selectedBranch !== "") {
          params.branch = selectedBranch;
        }
        const res = await evangelismApi.getAllGroups(params);
        if (!cancelled) setEvangelismGroups(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [selectedBranch]);

  const scopedEvangelismGroups = useMemo(() => {
    if (allowedGroupIds == null) return evangelismGroups;
    const allowed = new Set(allowedGroupIds.map(Number));
    return evangelismGroups.filter((group) => allowed.has(Number(group.id)));
  }, [evangelismGroups, allowedGroupIds]);

  const scopedClusters = useMemo(() => {
    if (allowedGroupIds == null) return clusters;
    const clusterIds = new Set<number>();
    for (const group of scopedEvangelismGroups) {
      const clusterId = group.cluster?.id ?? group.cluster_id;
      if (clusterId != null && clusterId !== "") {
        clusterIds.add(Number(clusterId));
      }
    }
    return clusters.filter((cluster) => clusterIds.has(Number(cluster.id)));
  }, [clusters, scopedEvangelismGroups, allowedGroupIds]);

  const scopeSelectOptions = useMemo(() => {
    const clustersScoped =
      selectedBranch === ""
        ? scopedClusters
        : scopedClusters.filter((c) => c.branch === selectedBranch);

    const clusterOpts = clustersScoped.map((c) => ({
      value: `cluster:${c.id}`,
      label: (c.name || c.code || `Cluster ${c.id}`).trim(),
      typeLabel: "cluster" as const,
    }));

    const groupOpts = scopedEvangelismGroups.map((g) => ({
      value: `group:${g.id}`,
      label: g.name || `Group ${g.id}`,
      typeLabel: "group" as const,
    }));

    const combined = [...clusterOpts, ...groupOpts];
    combined.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    return combined;
  }, [scopedClusters, scopedEvangelismGroups, selectedBranch]);

  useEffect(() => {
    if (!tallyScope || !onTallyScopeChange) return;
    const allowedValues = new Set(scopeSelectOptions.map((opt) => opt.value));
    if (!allowedValues.has(tallyScope)) {
      onTallyScopeChange("");
    }
  }, [tallyScope, onTallyScopeChange, scopeSelectOptions]);

  const { rows, loading, error } = useEvangelismPeopleTally({
    year: selectedYear,
    branch: selectedBranch === "" ? undefined : selectedBranch,
    ...(isClusterLayout ? {} : scopeParams),
    group_by: isClusterLayout ? "cluster" : undefined,
    months: isClusterLayout ? monthsQueryParam(months) : undefined,
    enabled: !needsBranchForClusters,
  });

  const [drilldown, setDrilldown] = useState<{
    months: number[];
    metric: PeopleTallyMetric;
    label: string;
    clusterId?: number | "unassigned" | null;
    rowKind?: EvangelismPeopleTallyRow["row_kind"];
    clusterName?: string | null;
  } | null>(null);

  /** Cards on mobile by default; table uses horizontal scroll on small screens. */
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  const hasFilterControls = Boolean(
    onYearChange || (!hideBranchFilter && onBranchChange) || onTallyScopeChange,
  );

  const filterGridClass = hideBranchFilter
    ? "mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_auto] md:items-center"
    : "mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center";

  const openDrilldown = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string,
    value: number,
  ) => {
    if (!value) {
      return;
    }
    if (isClusterLayout) {
      const clusterId =
        row.row_kind === "unassigned"
          ? "unassigned"
          : row.row_kind === "cluster"
            ? row.cluster_id ?? null
            : null;
      setDrilldown({
        months,
        metric,
        label,
        clusterId,
        rowKind: row.row_kind,
        clusterName: row.cluster_name,
      });
      return;
    }
    if (!row.month) {
      return;
    }
    setDrilldown({
      months: [row.month],
      metric,
      label,
      clusterName: null,
    });
  };

  const renderDrilldownCell = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string,
  ) => {
    const count = Number(
      row[`${metric}_count` as keyof EvangelismPeopleTallyRow] ?? 0,
    );
    const isTotal = row.row_kind === "total";
    if (count <= 0) {
      return (
        <span
          className={
            emphasizeCountCells
              ? "text-sm font-semibold text-gray-400"
              : `text-sm text-gray-400 ${isTotal ? "font-semibold" : ""}`
          }
        >
          {count}
        </span>
      );
    }

    return (
      <button
        type="button"
        className={
          emphasizeCountCells
            ? "text-base font-medium text-primary hover:text-primary hover:underline"
            : `text-sm font-medium text-primary hover:text-primary hover:underline ${
                isTotal ? "font-semibold" : ""
              }`
        }
        onClick={() => openDrilldown(row, metric, label, count)}
      >
        {count}
      </button>
    );
  };

  const renderClusterName = (row: EvangelismPeopleTallyRow) => {
    const name = (row.cluster_name || row.cluster_code || "Cluster").trim();
    const isTotal = row.row_kind === "total";
    if (
      row.row_kind === "cluster" &&
      row.cluster_id != null &&
      onTallyScopeChange
    ) {
      return (
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => {
            onTallyScopeChange(`cluster:${row.cluster_id}`);
            setLayoutMode("month");
          }}
        >
          {name}
        </button>
      );
    }
    return (
      <span
        className={`text-sm text-gray-700 ${isTotal ? "font-semibold" : ""}`}
      >
        {name}
      </span>
    );
  };

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Tally Records";
    }
    const windowLabel = isClusterLayout
      ? formatMonthsLabel(drilldown.months, selectedYear)
      : `${MONTH_NAMES[(drilldown.months[0] || 1) - 1]} ${selectedYear}`;
    const scopeLabel = isClusterLayout
      ? drilldown.clusterName || "All clusters"
      : null;
    return scopeLabel
      ? `${drilldown.label} — ${windowLabel} — ${scopeLabel}`
      : `${drilldown.label} - ${windowLabel}`;
  }, [drilldown, isClusterLayout, selectedYear]);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        setYearsLoading(true);
        const response = await evangelismApi.getPeopleTallyYears({
          branch: selectedBranch === "" ? undefined : selectedBranch,
          ...(isClusterLayout ? {} : scopeParams),
        });
        const years = response.data.years || [];
        const fallbackYear =
          response.data.default_year || new Date().getFullYear();
        const options = years.length > 0 ? years : [fallbackYear];
        setYearOptions(options);
      } catch (err) {
        console.error(err);
        setYearOptions([new Date().getFullYear()]);
      } finally {
        setYearsLoading(false);
      }
    };

    fetchAvailableYears();
  }, [selectedBranch, scopeParams, isClusterLayout]);

  useEffect(() => {
    if (!onYearChange || yearOptions.length === 0) {
      return;
    }
    if (!yearOptions.includes(selectedYear)) {
      onYearChange(yearOptions[0]);
    }
  }, [onYearChange, selectedYear, yearOptions]);

  const fetchDrilldownPage = useCallback(
    async (page: number) => {
      if (!drilldown) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      const response = await evangelismApi.getPeopleTallyDetail({
        year: selectedYear,
        branch: selectedBranch === "" ? undefined : selectedBranch,
        ...(isClusterLayout
          ? {
              months: monthsQueryParam(drilldown.months),
              ...(drilldown.rowKind === "unassigned"
                ? { cluster: "unassigned" }
                : drilldown.rowKind === "cluster" && drilldown.clusterId != null
                  ? { cluster: drilldown.clusterId }
                  : {}),
            }
          : {
              ...scopeParams,
              month: drilldown.months[0],
            }),
        metric: drilldown.metric,
        page,
        page_size: 20,
      });
      return response.data;
    },
    [
      drilldown,
      selectedYear,
      selectedBranch,
      scopeParams,
      isClusterLayout,
    ],
  );

  const handleResetFilters = () => {
    if (onBranchChange) {
      if (branchSelectionLocked) {
        onBranchChange(
          defaultLockedBranch === "" ? "" : Number(defaultLockedBranch),
        );
      } else {
        onBranchChange("");
      }
    }
    if (onTallyScopeChange) {
      onTallyScopeChange("");
    }
    if (onYearChange) {
      const fallbackYear = yearOptions[0] || new Date().getFullYear();
      onYearChange(fallbackYear);
      setMonths(defaultMonthsForYear(fallbackYear));
    } else {
      setMonths(defaultMonthsForYear(selectedYear));
    }
  };

  const metricColumns = [
    {
      header: "Invited",
      accessor: "invited_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "invited", "Invited"),
    },
    {
      header: "Attended",
      accessor: "attended_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "attended", "Attended"),
    },
    {
      header: "NCC",
      accessor: "students_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "students", "NCC"),
    },
    {
      header: "Baptized",
      accessor: "baptized_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "baptized", "Baptized"),
    },
    {
      header: "Received HG",
      accessor: "received_hg_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "received_hg", "Received HG"),
    },
    {
      header: "REACHED",
      accessor: "reached_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "reached", "Reached"),
    },
    {
      header: "UNIQUE HC",
      accessor: "unique_hc_count" as keyof EvangelismPeopleTallyRow,
      render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
        renderDrilldownCell(row, "unique_hc", "Unique HC"),
    },
  ];

  const columns = isClusterLayout
    ? [
        {
          header: "Cluster",
          accessor: "cluster_name" as keyof EvangelismPeopleTallyRow,
          render: (_value: unknown, row: EvangelismPeopleTallyRow) =>
            renderClusterName(row),
        },
        ...metricColumns,
      ]
    : [
        {
          header: "Month",
          accessor: "month" as keyof EvangelismPeopleTallyRow,
          render: (_value: unknown, row: EvangelismPeopleTallyRow) => (
            <span className="text-sm text-gray-700">
              {row.month ? MONTH_NAMES[row.month - 1] : "—"}
            </span>
          ),
        },
        ...metricColumns,
      ];

  return (
    <Card>
      <div className="">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-gray-900">People Tally</h3>
          <SegmentedControl
            value={layoutMode}
            onChange={setLayoutMode}
            fullWidthOnMobile
            options={[
              { id: "cluster", label: "By cluster" },
              { id: "month", label: "By month" },
            ]}
          />
        </div>
        {hasFilterControls && (
          <div className={filterGridClass}>
            {onYearChange && (
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
            )}
            {!hideBranchFilter &&
              onBranchChange &&
              (() => {
                const tallyBranchInteractive = !branchSelectionLocked;
                const branchSelectEl = (
                  <select
                    aria-label="Filter by branch"
                    aria-disabled={!tallyBranchInteractive}
                    tabIndex={tallyBranchInteractive ? 0 : -1}
                    value={selectedBranch === "" ? "" : selectedBranch}
                    onChange={(e) => {
                      if (!tallyBranchInteractive) return;
                      onBranchChange(Number(e.target.value) || "");
                    }}
                    className={
                      tallyBranchInteractive
                        ? `${EVANGELISM_BRANCH_SELECT_FULL_WIDTH_CLASS} h-11 min-h-[44px] py-0`
                        : `${EVANGELISM_BRANCH_SELECT_LOCKED_CLASS} h-11 min-h-[44px] py-0`
                    }
                  >
                    {branchSelectionLocked ? (
                      selectedBranch === "" ? (
                        <option value="">No branch assigned</option>
                      ) : (
                        <>
                          {branches
                            .filter(
                              (item) => Number(item.id) === selectedBranch,
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          {!branches.some(
                            (item) => Number(item.id) === selectedBranch,
                          ) && (
                            <option value={selectedBranch}>
                              Branch #{selectedBranch}
                            </option>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <option value="">All branches</option>
                        {branches.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                );
                return tallyBranchInteractive ? (
                  branchSelectEl
                ) : (
                  <LockedControlTooltip
                    label={
                      branchLockedHint?.trim()
                        ? branchLockedHint
                        : EVANGELISM_BRANCH_LOCKED_HINT
                    }
                    wrapperClassName="block h-11 min-h-[44px] min-w-0 w-full cursor-default"
                  >
                    {branchSelectEl}
                  </LockedControlTooltip>
                );
              })()}
            {isClusterLayout ? (
              <TallyMonthFilter
                year={selectedYear}
                months={months}
                onChange={setMonths}
              />
            ) : (
              onTallyScopeChange && (
                <div className="min-w-0">
                  <label className="sr-only">Cluster or evangelism group</label>
                  <ScalableSelect
                    options={scopeSelectOptions}
                    value={tallyScope}
                    onChange={onTallyScopeChange}
                    placeholder={
                      groupsLoading ? "Loading groups…" : "Cluster or group..."
                    }
                    searchPlaceholder="Search..."
                    loading={groupsLoading}
                    disabled={groupsLoading && scopeSelectOptions.length === 0}
                    emptyMessage="No clusters or groups match"
                    virtualizeThreshold={80}
                    className="w-full text-sm"
                  />
                </div>
              )
            )}
            <Button
              variant="tertiary"
              onClick={handleResetFilters}
              className="min-h-[44px] text-sm"
            >
              Reset
            </Button>
          </div>
        )}
        {needsBranchForClusters ? (
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
      <TallyDrilldownModal
        isOpen={Boolean(drilldown)}
        title={drilldownTitle}
        requestKey={
          drilldown
            ? `${layoutMode}-${selectedYear}-${monthsQueryParam(drilldown.months)}-${drilldown.metric}-${
                drilldown.rowKind || tallyScope || "all"
              }-${drilldown.clusterId ?? ""}`
            : null
        }
        highlightMonths={
          drilldown?.metric === "unique_hc" ? drilldown.months : null
        }
        highlightYear={drilldown?.metric === "unique_hc" ? selectedYear : null}
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
    </Card>
  );
}

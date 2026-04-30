"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
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
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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
}

type PeopleTallyMetric = Extract<
  EvangelismTallyDrilldownMetric,
  "invited" | "attended" | "students" | "baptized" | "received_hg" | "reached"
>;

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
}: PeopleTallyReportProps) {
  const selectedYear = year || new Date().getFullYear();
  const selectedBranch = branch === "" ? "" : Number(branch);

  const scopeParams = useMemo(
    () => parseTallyScope(tallyScope),
    [tallyScope],
  );

  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [evangelismGroups, setEvangelismGroups] = useState<
    EvangelismGroup[]
  >([]);

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
          page_size: 500,
        };
        if (selectedBranch !== "") {
          params.branch = selectedBranch;
        }
        const res = await evangelismApi.listGroups(params);
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

  const scopeSelectOptions = useMemo(() => {
    const clustersScoped =
      selectedBranch === ""
        ? clusters
        : clusters.filter((c) => c.branch === selectedBranch);

    const clusterOpts = clustersScoped.map((c) => ({
      value: `cluster:${c.id}`,
      label: (c.name || c.code || `Cluster ${c.id}`).trim(),
      typeLabel: "cluster" as const,
    }));

    const groupOpts = evangelismGroups.map((g) => ({
      value: `group:${g.id}`,
      label: g.name || `Group ${g.id}`,
      typeLabel: "group" as const,
    }));

    const combined = [...clusterOpts, ...groupOpts];
    combined.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    return combined;
  }, [clusters, evangelismGroups, selectedBranch]);

  const { rows, loading, error } = useEvangelismPeopleTally({
    year: selectedYear,
    branch: selectedBranch === "" ? undefined : selectedBranch,
    ...scopeParams,
  });

  const [drilldown, setDrilldown] = useState<{
    month: number;
    metric: PeopleTallyMetric;
    label: string;
  } | null>(null);

  /** Below md, Table defaults to cards; when true, use horizontal-scroll table instead. */
  const [useMobileTableLayout, setUseMobileTableLayout] = useState(false);

  const hasFilterControls = Boolean(onYearChange || onBranchChange || onTallyScopeChange);

  const openDrilldown = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string,
    value: number,
  ) => {
    if (!value) {
      return;
    }
    setDrilldown({ month: row.month, metric, label });
  };

  const renderDrilldownCell = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string,
  ) => {
    const count = Number(
      row[`${metric}_count` as keyof EvangelismPeopleTallyRow] ?? 0,
    );
    if (count <= 0) {
      return <span className="text-sm text-gray-400">{count}</span>;
    }

    return (
      <button
        type="button"
        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        onClick={() => openDrilldown(row, metric, label, count)}
      >
        {count}
      </button>
    );
  };

  const drilldownTitle = useMemo(() => {
    if (!drilldown) {
      return "Tally Records";
    }
    return `${drilldown.label} - ${MONTH_NAMES[drilldown.month - 1]} ${selectedYear}`;
  }, [drilldown, selectedYear]);

  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        setYearsLoading(true);
        const response = await evangelismApi.getPeopleTallyYears({
          branch: selectedBranch === "" ? undefined : selectedBranch,
          ...scopeParams,
        });
        const years = response.data.years || [];
        const fallbackYear = response.data.default_year || new Date().getFullYear();
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
  }, [selectedBranch, scopeParams]);

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
        ...scopeParams,
        month: drilldown.month,
        metric: drilldown.metric,
        page,
        page_size: 20,
      });
      return response.data;
    },
    [drilldown, selectedYear, selectedBranch, scopeParams],
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
    }
  };

  return (
    <Card>
      <div className="p-4">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Monthly People Tally</h3>
        {hasFilterControls && (
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
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
            {onBranchChange &&
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
                    className={`h-11 min-h-[44px] w-full rounded-md border border-gray-200 bg-white px-3 py-0 text-sm ${
                      tallyBranchInteractive
                        ? ""
                        : "pointer-events-none cursor-default text-gray-900"
                    }`}
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
            {onTallyScopeChange && (
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
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading tally...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">Error: {error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tally data available
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 md:hidden">
              <span className="text-sm text-gray-600">Layout</span>
              <div
                className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                role="group"
                aria-label="Monthly tally layout on small screens"
              >
                <button
                  type="button"
                  aria-pressed={!useMobileTableLayout}
                  onClick={() => setUseMobileTableLayout(false)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    !useMobileTableLayout
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  aria-pressed={useMobileTableLayout}
                  onClick={() => setUseMobileTableLayout(true)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    useMobileTableLayout
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Table
                </button>
              </div>
              <span className="text-xs text-gray-500">
                Table scrolls horizontally.
              </span>
            </div>
            <Table
              mobileCardView={!useMobileTableLayout}
              columns={[
              {
                header: "Month",
                accessor: "month" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {MONTH_NAMES[row.month - 1]}
                  </span>
                ),
              },
              {
                header: "Invited",
                accessor: "invited_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "invited", "Invited"),
              },
              {
                header: "Attended",
                accessor: "attended_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "attended", "Attended"),
              },
              {
                header: "NCC",
                accessor: "students_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "students", "NCC"),
              },
              {
                header: "Baptized",
                accessor: "baptized_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "baptized", "Baptized"),
              },
              {
                header: "Received HG",
                accessor: "received_hg_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "received_hg", "Received HG"),
              },
              {
                header: "REACHED",
                accessor: "reached_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) =>
                  renderDrilldownCell(row, "reached", "Reached"),
              },
            ]}
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
            ? `${selectedYear}-${drilldown.month}-${drilldown.metric}-${tallyScope || "all"}`
            : null
        }
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
    </Card>
  );
}

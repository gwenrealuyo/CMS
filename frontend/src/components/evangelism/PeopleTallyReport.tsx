"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import {
  EvangelismPeopleTallyRow,
  EvangelismTallyDrilldownMetric,
} from "@/src/types/evangelism";
import { Branch } from "@/src/types/branch";
import { Cluster } from "@/src/types/cluster";
import { useEvangelismPeopleTally } from "@/src/hooks/useEvangelism";
import { evangelismApi } from "@/src/lib/api";
import TallyDrilldownModal from "@/src/components/evangelism/TallyDrilldownModal";

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

interface PeopleTallyReportProps {
  year?: number;
  onYearChange?: (year: number) => void;
  branch?: number | "";
  onBranchChange?: (branch: number | "") => void;
  branches?: Branch[];
  cluster?: number | "";
  onClusterChange?: (cluster: number | "") => void;
  clusters?: Cluster[];
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
  cluster = "",
  onClusterChange,
  clusters = [],
}: PeopleTallyReportProps) {
  const selectedYear = year || new Date().getFullYear();
  const selectedBranch = branch || "";
  const selectedCluster = cluster || "";
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const { rows, loading, error } = useEvangelismPeopleTally({
    year: selectedYear,
    branch: selectedBranch || undefined,
    cluster: selectedCluster || undefined,
  });
  const [drilldown, setDrilldown] = useState<{
    month: number;
    metric: PeopleTallyMetric;
    label: string;
  } | null>(null);
  const hasFilterControls = Boolean(onYearChange || onBranchChange || onClusterChange);

  const openDrilldown = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string,
    value: number
  ) => {
    if (!value) {
      return;
    }
    setDrilldown({ month: row.month, metric, label });
  };

  const renderDrilldownCell = (
    row: EvangelismPeopleTallyRow,
    metric: PeopleTallyMetric,
    label: string
  ) => {
    const count = Number(row[`${metric}_count` as keyof EvangelismPeopleTallyRow] ?? 0);
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
          branch: selectedBranch || undefined,
          cluster: selectedCluster || undefined,
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
  }, [selectedBranch, selectedCluster]);

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
        branch: selectedBranch || undefined,
        cluster: selectedCluster || undefined,
        month: drilldown.month,
        metric: drilldown.metric,
        page,
        page_size: 20,
      });
      return response.data;
    },
    [drilldown, selectedYear, selectedBranch, selectedCluster]
  );

  const handleResetFilters = () => {
    if (onBranchChange) {
      onBranchChange("");
    }
    if (onClusterChange) {
      onClusterChange("");
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
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
            {onYearChange && (
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
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
            {onBranchChange && (
              <select
                value={selectedBranch}
                onChange={(e) => onBranchChange(Number(e.target.value) || "")}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                aria-label="Filter by branch"
              >
                <option value="">All branches</option>
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            {onClusterChange && (
              <select
                value={selectedCluster}
                onChange={(e) => onClusterChange(Number(e.target.value) || "")}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                aria-label="Filter by cluster"
              >
                <option value="">All clusters</option>
                {clusters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || `Cluster ${item.id}`}
                  </option>
                ))}
              </select>
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
          <Table
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
                render: (_value, row) => renderDrilldownCell(row, "invited", "Invited"),
              },
              {
                header: "Attended",
                accessor: "attended_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) => renderDrilldownCell(row, "attended", "Attended"),
              },
              {
                header: "NCC",
                accessor: "students_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) => renderDrilldownCell(row, "students", "NCC"),
              },
              {
                header: "Baptized",
                accessor: "baptized_count" as keyof EvangelismPeopleTallyRow,
                render: (_value, row) => renderDrilldownCell(row, "baptized", "Baptized"),
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
                render: (_value, row) => renderDrilldownCell(row, "reached", "Reached"),
              },
            ]}
            data={rows}
          />
        )}
      </div>
      <TallyDrilldownModal
        isOpen={Boolean(drilldown)}
        title={drilldownTitle}
        requestKey={
          drilldown ? `${selectedYear}-${drilldown.month}-${drilldown.metric}` : null
        }
        onClose={() => setDrilldown(null)}
        fetchPage={fetchDrilldownPage}
      />
    </Card>
  );
}

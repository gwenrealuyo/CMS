"use client";

import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import { EvangelismPeopleTallyRow } from "@/src/types/evangelism";
import { useEvangelismPeopleTally } from "@/src/hooks/useEvangelism";

interface PeopleTallyReportProps {
  year?: number;
  onYearChange?: (year: number) => void;
}

export default function PeopleTallyReport({
  year,
  onYearChange,
}: PeopleTallyReportProps) {
  const { rows, loading, error } = useEvangelismPeopleTally({
    year: year || new Date().getFullYear(),
  });

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading tally...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  const monthNames = [
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

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Monthly People Tally
          </h3>
          {onYearChange && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700">Year</label>
              <select
                value={year || new Date().getFullYear()}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="w-full sm:w-40 rounded-md border border-gray-200 px-3 py-2 min-h-[44px] text-sm"
              >
                {Array.from({ length: 5 }, (_, index) => {
                  const optionYear = new Date().getFullYear() - index;
                  return (
                    <option key={optionYear} value={optionYear}>
                      {optionYear}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
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
                    {monthNames[row.month - 1]}
                  </span>
                ),
              },
              {
                header: "Invited",
                accessor: "invited_count" as keyof EvangelismPeopleTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Attended",
                accessor: "attended_count" as keyof EvangelismPeopleTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Students",
                accessor: "students_count" as keyof EvangelismPeopleTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Baptized",
                accessor: "baptized_count" as keyof EvangelismPeopleTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Received HG",
                accessor: "received_hg_count" as keyof EvangelismPeopleTallyRow,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
            ]}
            data={rows}
          />
        )}
      </div>
    </Card>
  );
}

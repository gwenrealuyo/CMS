"use client";

import { useState } from "react";
import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import { MonthlyStatistics } from "@/src/types/evangelism";
import { useMonthlyStatistics } from "@/src/hooks/useEvangelism";

interface MonthlyStatisticsReportProps {
  clusterId?: number | string;
  year?: number;
}

export default function MonthlyStatisticsReport({
  clusterId,
  year,
}: MonthlyStatisticsReportProps) {
  const { statistics, loading, error } = useMonthlyStatistics({
    cluster: clusterId,
    year: year || new Date().getFullYear(),
  });

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading statistics...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Statistics</h3>
        {statistics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No statistics available</div>
        ) : (
          <Table
            columns={[
              {
                header: "Month",
                accessor: "month" as keyof MonthlyStatistics,
                render: (_value, row) => (
                  <span className="text-sm font-medium text-gray-900">
                    {monthNames[row.month - 1]}
                  </span>
                ),
              },
              {
                header: "Invited",
                accessor: "invited_count" as keyof MonthlyStatistics,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Attended",
                accessor: "attended_count" as keyof MonthlyStatistics,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Baptized",
                accessor: "baptized_count" as keyof MonthlyStatistics,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Received HG",
                accessor: "received_hg_count" as keyof MonthlyStatistics,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
              {
                header: "Converted",
                accessor: "converted_count" as keyof MonthlyStatistics,
                render: (value) => (
                  <span className="text-sm text-gray-700">{value || 0}</span>
                ),
              },
            ]}
            data={statistics}
          />
        )}
      </div>
    </Card>
  );
}


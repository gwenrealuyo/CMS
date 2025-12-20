"use client";

import { useState, useEffect } from "react";
import { clusterReportsApi } from "@/src/lib/api";
import { ComplianceData, ClusterCompliance, ComplianceStatus } from "@/src/types/cluster";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";

export default function ClusterComplianceTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComplianceData | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 28); // 4 weeks ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "ALL">("ALL");

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clusterReportsApi.compliance({
        start_date: startDate,
        end_date: endDate,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
  }, [startDate, endDate, statusFilter]);

  const handleExportCSV = async () => {
    try {
      const response = await clusterReportsApi.exportComplianceCSV({
        start_date: startDate,
        end_date: endDate,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cluster_compliance_${startDate}_${endDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  };

  const getStatusBadgeColor = (status: ComplianceStatus) => {
    switch (status) {
      case "COMPLIANT":
        return "bg-green-100 text-green-800";
      case "NON_COMPLIANT":
        return "bg-red-100 text-red-800";
      case "PARTIAL":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return "↑";
      case "DECLINING":
        return "↓";
      default:
        return "→";
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage message={error} />
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <div className="p-3">
            <div className="text-xs text-gray-600">Total Clusters</div>
            <div className="text-xl font-bold">{data.summary.total_clusters}</div>
          </div>
        </Card>
        <Card>
          <div className="p-3">
            <div className="text-xs text-gray-600">Compliant</div>
            <div className="text-xl font-bold text-green-600">{data.summary.compliant_clusters}</div>
          </div>
        </Card>
        <Card>
          <div className="p-3">
            <div className="text-xs text-gray-600">Non-Compliant</div>
            <div className="text-xl font-bold text-red-600">{data.summary.non_compliant_clusters}</div>
          </div>
        </Card>
        <Card>
          <div className="p-3">
            <div className="text-xs text-gray-600">Overall Compliance Rate</div>
            <div className="text-xl font-bold">{data.summary.compliance_rate.toFixed(1)}%</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ComplianceStatus | "ALL")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md h-[42px]"
              >
                <option value="ALL">All</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="NON_COMPLIANT">Non-Compliant</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExportCSV} variant="secondary" className="h-[42px]">
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Compliance Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cluster
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coordinator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compliance Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reports
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Report
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Since
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.clusters.map((item: ClusterCompliance) => (
                <tr key={item.cluster.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.cluster.name || item.cluster.code || `Cluster ${item.cluster.id}`}
                    </div>
                    {item.cluster.code && (
                      <div className="text-sm text-gray-500">{item.cluster.code}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.cluster.coordinator
                      ? `${item.cluster.coordinator.first_name} ${item.cluster.coordinator.last_name}`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.compliance_rate >= 100
                              ? "bg-green-500"
                              : item.compliance_rate >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(item.compliance_rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">
                        {item.compliance_rate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.reports_submitted} / {item.reports_expected}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.last_report_date
                      ? new Date(item.last_report_date).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.days_since_last_report !== null
                      ? `${item.days_since_last_report} days`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="text-lg">{getTrendIcon(item.trend)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.clusters.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No compliance data found for the selected period.
          </div>
        )}
      </Card>
    </div>
  );
}


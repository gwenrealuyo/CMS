import React, { useState, useEffect, useMemo } from "react";
import {
  ClusterWeeklyReport,
  Cluster,
  ReportAnalytics,
} from "@/src/types/person";
import { clusterWeeklyReportsApi } from "@/src/lib/api";
import ClusterWeeklyReportForm from "./ClusterWeeklyReportForm";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface ClusterReportsDashboardProps {
  clusters: Cluster[];
}

export default function ClusterReportsDashboard({
  clusters,
}: ClusterReportsDashboardProps) {
  const [reports, setReports] = useState<ClusterWeeklyReport[]>([]);
  const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [editingReport, setEditingReport] =
    useState<ClusterWeeklyReport | null>(null);

  // Filters
  const [selectedClusterFilter, setSelectedClusterFilter] =
    useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedGatheringType, setSelectedGatheringType] =
    useState<string>("");

  // Sorting
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Fetch reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await clusterWeeklyReportsApi.getAll();
      setReports(response.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const params: any = {};
      if (selectedClusterFilter) params.cluster = selectedClusterFilter;
      if (selectedYear) params.year = selectedYear;

      const response = await clusterWeeklyReportsApi.getAnalytics(params);
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedClusterFilter, selectedYear]);

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    let filtered = reports.filter((report) => {
      if (selectedClusterFilter && report.cluster !== selectedClusterFilter)
        return false;
      if (selectedYear && report.year !== selectedYear) return false;
      if (
        selectedGatheringType &&
        report.gathering_type !== selectedGatheringType
      )
        return false;
      return true;
    });

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case "cluster":
            aValue = a.cluster_name || "";
            bValue = b.cluster_name || "";
            break;
          case "week":
            aValue = a.week_number;
            bValue = b.week_number;
            break;
          case "meeting_date":
            aValue = new Date(a.meeting_date);
            bValue = new Date(b.meeting_date);
            break;
          case "attendance":
            aValue = a.members_present + a.visitors_present;
            bValue = b.members_present + b.visitors_present;
            break;
          case "type":
            aValue = a.gathering_type;
            bValue = b.gathering_type;
            break;
          case "offerings":
            aValue = a.offerings;
            bValue = b.offerings;
            break;
          case "submitted_by":
            aValue = a.submitted_by_details?.first_name || "";
            bValue = b.submitted_by_details?.first_name || "";
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    reports,
    selectedClusterFilter,
    selectedYear,
    selectedGatheringType,
    sortField,
    sortDirection,
  ]);

  // SortIcon component - only shows arrow for active field
  const SortIcon = ({ field }: { field: string }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block" />
    );
  };

  const handleCreateReport = (cluster: Cluster) => {
    setSelectedCluster(cluster);
    setEditingReport(null);
    setShowForm(true);
  };

  const handleEditReport = (report: ClusterWeeklyReport) => {
    const cluster = clusters.find((c) => c.id === report.cluster);
    if (cluster) {
      setSelectedCluster(cluster);
      setEditingReport(report);
      setShowForm(true);
    }
  };

  const handleSubmitReport = async (data: Partial<ClusterWeeklyReport>) => {
    try {
      if (editingReport) {
        await clusterWeeklyReportsApi.update(editingReport.id, data);
      } else {
        await clusterWeeklyReportsApi.create(data);
      }
      await fetchReports();
      await fetchAnalytics();
      setShowForm(false);
      setSelectedCluster(null);
      setEditingReport(null);
    } catch (error) {
      console.error("Error submitting report:", error);
      throw error;
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        await clusterWeeklyReportsApi.delete(reportId);
        await fetchReports();
        await fetchAnalytics();
      } catch (error) {
        console.error("Error deleting report:", error);
      }
    }
  };

  const getGatheringTypeColor = (type: string) => {
    switch (type) {
      case "PHYSICAL":
        return "bg-green-100 text-green-800";
      case "ONLINE":
        return "bg-blue-100 text-blue-800";
      case "HYBRID":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Cluster Weekly Reports
          </h2>
          <p className="text-gray-600">
            Manage and view weekly cluster reports
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Open form without pre-selecting a cluster
              setSelectedCluster(null);
              setEditingReport(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Submit Report
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Reports
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analytics.total_reports}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Attendance
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {analytics.total_attendance.members +
                    analytics.total_attendance.visitors}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Offerings
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(analytics.total_offerings)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Avg Attendance
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Math.round(
                    analytics.average_attendance.avg_members +
                      analytics.average_attendance.avg_visitors
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cluster
            </label>
            <select
              value={selectedClusterFilter}
              onChange={(e) => setSelectedClusterFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Clusters</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from(
                { length: 5 },
                (_, i) => new Date().getFullYear() - i
              ).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gathering Type
            </label>
            <select
              value={selectedGatheringType}
              onChange={(e) => setSelectedGatheringType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="PHYSICAL">Physical</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Reports ({filteredReports.length})
          </h3>
        </div>

        {filteredReports.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No reports found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by submitting a weekly report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { field: "cluster", label: "Cluster" },
                    { field: "week", label: "Week" },
                    { field: "meeting_date", label: "Meeting Date" },
                    { field: "attendance", label: "Attendance" },
                    { field: "type", label: "Type" },
                    { field: "offerings", label: "Offerings" },
                    { field: "submitted_by", label: "Submitted By" },
                  ].map(({ field, label }) => (
                    <th
                      key={field}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort(field)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{label}</span>
                        <SortIcon field={field} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {report.cluster_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.year} W{report.week_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(report.meeting_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.members_present}M / {report.visitors_present}V
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGatheringTypeColor(
                          report.gathering_type
                        )}`}
                      >
                        {report.gathering_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(report.offerings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.submitted_by_details
                        ? `${report.submitted_by_details.first_name} ${report.submitted_by_details.last_name}`
                        : "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditReport(report)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Edit Report"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Delete Report"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setSelectedCluster(null);
          setEditingReport(null);
        }}
        title={editingReport ? "Edit Weekly Report" : "Submit Weekly Report"}
        className="!mt-0"
      >
        <ClusterWeeklyReportForm
          cluster={selectedCluster}
          clusters={clusters}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setSelectedCluster(null);
            setEditingReport(null);
          }}
          onSubmit={handleSubmitReport}
          initialData={editingReport || undefined}
        />
      </Modal>
    </div>
  );
}

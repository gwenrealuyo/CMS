import React, { useState, useEffect, useMemo, useRef } from "react";
import Button from "@/src/components/ui/Button";
import {
  ClusterWeeklyReport,
  Cluster,
  ReportAnalytics,
} from "@/src/types/person";
import { clusterWeeklyReportsApi, PaginatedResponse } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import ClusterWeeklyReportForm from "./ClusterWeeklyReportForm";
import ViewWeeklyReportModal from "./ViewWeeklyReportModal";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import Pagination from "@/src/components/ui/Pagination";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ClusterReportsDashboardProps {
  clusters: Cluster[];
}

export default function ClusterReportsDashboard({
  clusters,
}: ClusterReportsDashboardProps) {
  const [reports, setReports] = useState<ClusterWeeklyReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [editingReport, setEditingReport] =
    useState<ClusterWeeklyReport | null>(null);
  const [viewingReport, setViewingReport] =
    useState<ClusterWeeklyReport | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    report: ClusterWeeklyReport | null;
    loading: boolean;
  }>({
    isOpen: false,
    report: null,
    loading: false,
  });

  // Filters
  const [selectedClusterFilter, setSelectedClusterFilter] =
    useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedGatheringType, setSelectedGatheringType] =
    useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Sorting
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Column selection
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const availableColumns = [
    { key: "cluster", label: "Cluster", default: true },
    { key: "week", label: "Week", default: true },
    { key: "meeting_date", label: "Meeting Date", default: true },
    { key: "attendance", label: "Attendance", default: true },
    {
      key: "member_attendance_rate",
      label: "Member Rate",
      default: true,
    },
    { key: "type", label: "Type", default: true },
    { key: "offerings", label: "Offerings", default: false },
    { key: "submitted_by", label: "Submitted By", default: false },
  ];
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(availableColumns.filter((col) => col.default).map((col) => col.key))
  );

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Fetch reports with pagination and filters
  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        page_size: itemsPerPage,
      };

      if (selectedClusterFilter) params.cluster = selectedClusterFilter;
      if (selectedYear) params.year = selectedYear;
      if (selectedGatheringType) params.gathering_type = selectedGatheringType;
      if (selectedMonth) params.month = selectedMonth;

      const response = await clusterWeeklyReportsApi.getAll(params);
      const data = response.data as PaginatedResponse<ClusterWeeklyReport>;

      setReports(data.results);
      setTotalCount(data.count);
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
  }, [
    currentPage,
    itemsPerPage,
    selectedClusterFilter,
    selectedMonth,
    selectedYear,
    selectedGatheringType,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedClusterFilter, selectedMonth, selectedYear]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedClusterFilter,
    selectedMonth,
    selectedYear,
    selectedGatheringType,
  ]);

  // Handle click outside export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportButtonRef.current &&
        exportDropdownRef.current &&
        !exportButtonRef.current.contains(event.target as Node) &&
        !exportDropdownRef.current.contains(event.target as Node) &&
        showExportDropdown
      ) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  // Sort reports (client-side sorting on current page)
  const sortedReports = useMemo(() => {
    if (!sortField) return reports;

    const sorted = [...reports];
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "cluster":
          aValue = a.cluster_name || "";
          bValue = b.cluster_name || "";
          break;
        case "week":
          aValue = `${a.year}-${a.week_number}`;
          bValue = `${b.year}-${b.week_number}`;
          break;
        case "meeting_date":
          aValue = new Date(a.meeting_date).getTime();
          bValue = new Date(b.meeting_date).getTime();
          break;
        case "attendance":
          aValue = a.members_present + a.visitors_present;
          bValue = b.members_present + b.visitors_present;
          break;
        case "member_attendance_rate":
          aValue = a.member_attendance_rate ?? 0;
          bValue = b.member_attendance_rate ?? 0;
          break;
        case "type":
          aValue = a.gathering_type;
          bValue = b.gathering_type;
          break;
        case "offerings":
          aValue =
            typeof a.offerings === "string"
              ? parseFloat(a.offerings)
              : a.offerings;
          bValue =
            typeof b.offerings === "string"
              ? parseFloat(b.offerings)
              : b.offerings;
          break;
        case "submitted_by":
          aValue = a.submitted_by_details
            ? `${a.submitted_by_details.first_name} ${a.submitted_by_details.last_name}`
            : "";
          bValue = b.submitted_by_details
            ? `${b.submitted_by_details.first_name} ${b.submitted_by_details.last_name}`
            : "";
          break;
        default:
          aValue = "";
          bValue = "";
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [reports, sortField, sortDirection]);

  // SortIcon component - only shows arrow for active field
  const SortIcon = ({ field }: { field: string }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="w-4 h-4 inline-block" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block" />
    );
  };

  // Memoized cluster options for scalable select
  const clusterOptions = useMemo(
    () => [
      { value: "", label: "All Clusters" },
      ...clusters.map((cluster) => ({
        value: cluster.id,
        label: cluster.name || "Unnamed Cluster",
      })),
    ],
    [clusters]
  );

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
        // Reset to first page when adding new report
        setCurrentPage(1);
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

  const handleDeleteReport = async (report: ClusterWeeklyReport) => {
    setDeleteConfirmation({
      isOpen: true,
      report: report,
      loading: false,
    });
  };

  const confirmDeleteReport = async () => {
    if (deleteConfirmation.report) {
      setDeleteConfirmation((prev) => ({ ...prev, loading: true }));
      try {
        await clusterWeeklyReportsApi.delete(deleteConfirmation.report.id);
        await fetchReports();
        await fetchAnalytics();
        setDeleteConfirmation({
          isOpen: false,
          report: null,
          loading: false,
        });
        // Close view modal if it's open
        if (viewingReport?.id === deleteConfirmation.report.id) {
          setShowViewModal(false);
          setViewingReport(null);
        }
      } catch (error) {
        console.error("Error deleting report:", error);
        setDeleteConfirmation((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      report: null,
      loading: false,
    });
  };

  const handleViewReport = (report: ClusterWeeklyReport) => {
    setViewingReport(report);
    setShowViewModal(true);
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

  // Export functions
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sortedReports.map((report) => ({
        Cluster: report.cluster_name || report.cluster_code || "",
        "Cluster Code": report.cluster_code || "",
        Week: `${report.year} W${report.week_number}`,
        Year: report.year,
        "Week Number": report.week_number,
        "Meeting Date": new Date(report.meeting_date).toLocaleDateString(),
        "Members Present": report.members_present,
        "Visitors Present": report.visitors_present,
        "Member Attendance Rate": report.member_attendance_rate
          ? `${report.member_attendance_rate.toFixed(1)}%`
          : "N/A",
        "Gathering Type": report.gathering_type,
        Offerings: report.offerings,
        "Submitted By": report.submitted_by_details
          ? formatPersonName(report.submitted_by_details)
          : "Unknown",
        "Submitted At": new Date(report.submitted_at).toLocaleDateString(),
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Weekly Reports");
    XLSX.writeFile(workbook, "weekly_reports.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    const tableColumn = [
      "Cluster",
      "Week",
      "Meeting Date",
      "Members",
      "Visitors",
      "Rate",
      "Type",
      "Offerings",
      "Submitted By",
    ];

    const tableRows = sortedReports.map((report) => [
      report.cluster_name || report.cluster_code || "",
      `${report.year} W${report.week_number}`,
      new Date(report.meeting_date).toLocaleDateString(),
      report.members_present.toString(),
      report.visitors_present.toString(),
      report.member_attendance_rate
        ? `${report.member_attendance_rate.toFixed(1)}%`
        : "N/A",
      report.gathering_type,
      formatCurrency(report.offerings),
      report.submitted_by_details
        ? formatPersonName(report.submitted_by_details)
        : "Unknown",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 8 },
    });

    doc.save("weekly_reports.pdf");
  };

  const exportToCSV = () => {
    const csvContent = sortedReports
      .map((report) =>
        [
          report.cluster_name || report.cluster_code || "",
          `${report.year} W${report.week_number}`,
          new Date(report.meeting_date).toLocaleDateString(),
          report.members_present,
          report.visitors_present,
          report.member_attendance_rate
            ? `${report.member_attendance_rate.toFixed(1)}%`
            : "N/A",
          report.gathering_type,
          report.offerings,
          report.submitted_by_details
            ? formatPersonName(report.submitted_by_details)
            : "Unknown",
        ].join(",")
      )
      .join("\n");

    const blob = new Blob(
      [
        `Cluster,Week,Meeting Date,Members,Visitors,Attendance Rate,Type,Offerings,Submitted By\n${csvContent}`,
      ],
      {
        type: "text/csv;charset=utf-8;",
      }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "weekly_reports.csv";
    link.click();
  };

  const handleExport = (format: "excel" | "pdf" | "csv") => {
    switch (format) {
      case "excel":
        exportToExcel();
        break;
      case "pdf":
        exportToPDF();
        break;
      case "csv":
        exportToCSV();
        break;
    }
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
        <h1 className="text-2xl font-bold text-[#2D3748]">
          Cluster Weekly Reports
        </h1>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setSelectedCluster(null);
              setEditingReport(null);
              setShowForm(true);
            }}
          >
            Submit Report
          </Button>
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
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cluster
            </label>
            <ScalableSelect
              options={clusterOptions}
              value={selectedClusterFilter}
              onChange={setSelectedClusterFilter}
              placeholder="Select a cluster"
              searchPlaceholder="Search clusters..."
              className="w-full"
              showSearch={true}
              maxHeight={200}
              emptyMessage="No clusters found"
              virtualizeThreshold={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="px-6 py-4 border-b border-gray-200 flex justify-end">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowColumnsModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Columns
            </button>
            <div className="relative">
              <button
                ref={exportButtonRef}
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                Export
              </button>
              {showExportDropdown && (
                <div
                  ref={exportDropdownRef}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10"
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExport("excel");
                        setShowExportDropdown(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export to Excel
                    </button>
                    <button
                      onClick={() => {
                        handleExport("pdf");
                        setShowExportDropdown(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      Export to PDF
                    </button>
                    <button
                      onClick={() => {
                        handleExport("csv");
                        setShowExportDropdown(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-blue-600"
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
                      Export to CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {sortedReports.length === 0 ? (
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
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {availableColumns.map((col) => {
                      if (!visibleColumns.has(col.key)) return null;
                      return (
                        <th
                          key={col.key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{col.label}</span>
                            <SortIcon field={col.key} />
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedReports.map((report) => (
                    <tr
                      key={report.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      {availableColumns.map((col) => {
                        if (!visibleColumns.has(col.key)) return null;
                        let cellContent;
                        switch (col.key) {
                          case "cluster":
                            cellContent = (
                              <button
                                onClick={() => handleViewReport(report)}
                                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors duration-150"
                                title="Click to view report details"
                              >
                                {report.cluster_code
                                  ? `${report.cluster_code} - ${report.cluster_name}`
                                  : report.cluster_name}
                              </button>
                            );
                            break;
                          case "week":
                            cellContent = (
                              <span className="text-sm text-gray-900">
                                {report.year} W{report.week_number}
                              </span>
                            );
                            break;
                          case "meeting_date":
                            cellContent = (
                              <span className="text-sm text-gray-900">
                                {new Date(
                                  report.meeting_date
                                ).toLocaleDateString()}
                              </span>
                            );
                            break;
                          case "attendance":
                            cellContent = (
                              <span className="text-sm text-gray-900">
                                {report.members_present}M /{" "}
                                <span
                                  className={
                                    report.visitors_present === 0
                                      ? "text-red-600"
                                      : ""
                                  }
                                >
                                  {report.visitors_present}V
                                </span>
                              </span>
                            );
                            break;
                          case "member_attendance_rate":
                            const rate = report.member_attendance_rate ?? 0;
                            const isLowAttendance = rate < 50;
                            cellContent = (
                              <span
                                className={`text-sm ${
                                  isLowAttendance
                                    ? "text-red-600 font-medium"
                                    : "text-gray-900"
                                }`}
                              >
                                {report.member_attendance_rate !== undefined
                                  ? `${report.member_attendance_rate.toFixed(
                                      1
                                    )}%`
                                  : "N/A"}
                              </span>
                            );
                            break;
                          case "type":
                            cellContent = (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGatheringTypeColor(
                                  report.gathering_type
                                )}`}
                              >
                                {report.gathering_type}
                              </span>
                            );
                            break;
                          case "offerings":
                            cellContent = (
                              <span className="text-sm text-gray-900">
                                {formatCurrency(report.offerings)}
                              </span>
                            );
                            break;
                          case "submitted_by":
                            cellContent = (
                              <span className="text-sm text-gray-900">
                                {report.submitted_by_details
                                  ? formatPersonName(
                                      report.submitted_by_details
                                    )
                                  : "Unknown"}
                              </span>
                            );
                            break;
                          default:
                            cellContent = null;
                        }
                        return (
                          <td
                            key={col.key}
                            className={`px-6 py-4 whitespace-nowrap ${
                              col.key === "cluster"
                                ? "text-sm font-medium text-gray-900"
                                : ""
                            }`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewReport(report)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                            title="View Report"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
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
                            onClick={() => handleDeleteReport(report)}
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

            {/* Pagination */}
            {totalCount > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / itemsPerPage)}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalCount}
                onItemsPerPageChange={(newPageSize) => {
                  setItemsPerPage(newPageSize);
                  setCurrentPage(1);
                }}
              />
            )}
          </>
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

      {/* View Report Modal */}
      {viewingReport && (
        <ViewWeeklyReportModal
          report={viewingReport}
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewingReport(null);
          }}
          onEdit={() => {
            setShowViewModal(false);
            handleEditReport(viewingReport);
          }}
          onDelete={() => {
            handleDeleteReport(viewingReport);
          }}
          onCancel={() => {
            setShowViewModal(false);
            setViewingReport(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={confirmDeleteReport}
        title="Delete Weekly Report"
        message={
          deleteConfirmation.report
            ? `Are you sure you want to delete the weekly report for ${deleteConfirmation.report.cluster_name} - ${deleteConfirmation.report.year} Week ${deleteConfirmation.report.week_number}? This action cannot be undone.`
            : "Are you sure you want to delete this report?"
        }
        confirmText="Delete Report"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirmation.loading}
      />

      {/* Columns Configuration Modal */}
      {showColumnsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Configure Columns
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Select which columns to display in the table
              </p>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {availableColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={(e) => {
                        const newVisible = new Set(visibleColumns);
                        if (e.target.checked) {
                          newVisible.add(col.key);
                        } else {
                          newVisible.delete(col.key);
                        }
                        setVisibleColumns(newVisible);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setVisibleColumns(
                    new Set(
                      availableColumns
                        .filter((col) => col.default)
                        .map((col) => col.key)
                    )
                  );
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

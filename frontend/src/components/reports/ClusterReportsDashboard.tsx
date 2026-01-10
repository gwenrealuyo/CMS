import React, { useState, useEffect, useMemo, useRef } from "react";
import Button from "@/src/components/ui/Button";
import {
  ClusterWeeklyReport,
  ClusterWeeklyReportInput,
  Cluster,
  ClusterAnalytics,
} from "@/src/types/cluster";
import { clusterReportsApi, PaginatedResponse } from "@/src/lib/api";
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
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ClusterReportsDashboardProps {
  clusters: Cluster[];
  externalShowForm?: boolean;
  externalSelectedCluster?: Cluster | null;
  externalEditingReport?: ClusterWeeklyReport | null;
  onFormClose?: () => void;
  onSubmitReport?: (data: Partial<ClusterWeeklyReport>) => Promise<void>;
  onEditReport?: (report: ClusterWeeklyReport) => void;
  onSetReportSelectedCluster?: (cluster: Cluster | null) => void;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

export default function ClusterReportsDashboard({
  clusters,
  externalShowForm,
  externalSelectedCluster,
  externalEditingReport,
  onFormClose,
  onSubmitReport: externalOnSubmitReport,
  onEditReport: externalOnEditReport,
  onSetReportSelectedCluster: externalOnSetReportSelectedCluster,
  refreshTrigger,
}: ClusterReportsDashboardProps) {
  const [reports, setReports] = useState<ClusterWeeklyReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [analytics, setAnalytics] = useState<ClusterAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [editingReport, setEditingReport] =
    useState<ClusterWeeklyReport | null>(null);

  // Use external props if provided, otherwise use internal state
  const isFormOpen =
    externalShowForm !== undefined ? externalShowForm : showForm;
  const formSelectedCluster =
    externalSelectedCluster !== undefined
      ? externalSelectedCluster
      : selectedCluster;
  const formEditingReport =
    externalEditingReport !== undefined ? externalEditingReport : editingReport;
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
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedGatheringType, setSelectedGatheringType] =
    useState<string>("");

  // Helper function to get ISO week number
  const getISOWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Helper function to get date range for ISO week
  const getWeekDateRange = (
    year: number,
    weekNumber: number
  ): { start: Date; end: Date } => {
    // ISO week: Week 1 contains Jan 4, and weeks start on Monday
    // Get Jan 4 of the year
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7; // Convert Sunday (0) to 7

    // Find the Monday of week 1
    // Jan 4 is in week 1, so we need to find the Monday of that week
    const daysToMonday = jan4Day === 1 ? 0 : 8 - jan4Day; // Days to go back to Monday
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - daysToMonday);

    // Calculate the start date of the requested week (Monday)
    const weekStart = new Date(week1Monday);
    weekStart.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);

    // Calculate the end date of the week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return { start: weekStart, end: weekEnd };
  };

  // Helper function to format date range
  const formatWeekDateRange = (year: number, weekNumber: number): string => {
    const { start, end } = getWeekDateRange(year, weekNumber);
    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
    }
  };

  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const currentWeek = getISOWeekNumber(new Date());
    return currentWeek.toString();
  });

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

  // Charts visibility
  const [showCharts, setShowCharts] = useState(false);

  // View mode toggle - Initialize based on screen size (cards for mobile, table for desktop)
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });

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
      if (selectedWeek) params.week_number = selectedWeek;

      const response = await clusterReportsApi.getAll(params);
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
      if (selectedMonth) params.month = selectedMonth;
      if (selectedGatheringType) params.gathering_type = selectedGatheringType;
      if (selectedWeek) params.week_number = selectedWeek;

      const response = await clusterReportsApi.analytics(params);
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
    selectedWeek,
    refreshTrigger, // Refresh when trigger changes
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [
    selectedClusterFilter,
    selectedMonth,
    selectedYear,
    selectedGatheringType,
    selectedWeek,
    refreshTrigger, // Refresh analytics when trigger changes
  ]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedClusterFilter,
    selectedMonth,
    selectedYear,
    selectedGatheringType,
    selectedWeek,
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
        value: String(cluster.id),
        label: cluster.name || "Unnamed Cluster",
      })),
    ],
    [clusters]
  );

  const handleCreateReport = (cluster: Cluster) => {
    if (externalSelectedCluster !== undefined) {
      // Controlled from parent
      if (onFormClose) {
        // Parent will handle opening
        return;
      }
    }
    setSelectedCluster(cluster);
    setEditingReport(null);
    setShowForm(true);
  };

  const handleEditReport = (report: ClusterWeeklyReport) => {
    const cluster = clusters.find((c) => c.id === report.cluster);
    if (cluster) {
      // Use external handler if provided
      if (externalOnEditReport) {
        externalOnEditReport(report);
        if (externalOnSetReportSelectedCluster) {
          externalOnSetReportSelectedCluster(cluster);
        }
      } else {
        // Otherwise use internal state
        setSelectedCluster(cluster);
        setEditingReport(report);
        setShowForm(true);
      }
    }
  };

  const handleSubmitReport = async (data: Partial<ClusterWeeklyReport>) => {
    try {
      // Use external handler if provided
      if (externalOnSubmitReport) {
        await externalOnSubmitReport(data as Partial<ClusterWeeklyReportInput>);
        // Refresh reports after external submission
        await fetchReports();
        await fetchAnalytics();
        if (onFormClose) {
          onFormClose();
        }
        return;
      }

      // Otherwise use internal handler
      if (formEditingReport) {
        await clusterReportsApi.update(
          formEditingReport.id.toString(),
          data as ClusterWeeklyReportInput
        );
      } else {
        await clusterReportsApi.create(data as ClusterWeeklyReportInput);
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
        await clusterReportsApi.delete(deleteConfirmation.report.id.toString());
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
          ? formatPersonName(report.submitted_by_details as any)
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
      formatCurrency(
        typeof report.offerings === "number"
          ? report.offerings
          : parseFloat(String(report.offerings)) || 0
      ),
      report.submitted_by_details
        ? formatPersonName(report.submitted_by_details as any)
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
            ? formatPersonName(report.submitted_by_details as any)
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
      {/* <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#2D3748]">
          Cluster Weekly Reports
        </h1>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              if (externalSelectedCluster !== undefined && onFormClose) {
                // Controlled from parent - let parent handle it
                return;
              }
              setSelectedCluster(null);
              setEditingReport(null);
              setShowForm(true);
            }}
          >
            Submit Report
          </Button>
        </div>
      </div> */}

      {/* Analytics Cards */}
      {analytics &&
        (() => {
          // Calculate report frequency (reports per month)
          const reportFrequency = selectedMonth
            ? reports.filter((r) => {
                const reportDate = new Date(r.meeting_date);
                return (
                  reportDate.getMonth() + 1 === parseInt(selectedMonth) &&
                  reportDate.getFullYear() === selectedYear
                );
              }).length
            : Math.round((analytics.total_reports / 12) * 10) / 10; // Average per month if no month selected

          // Calculate member attendance rate (percentage)
          // Use filtered clusters if cluster filter is applied, otherwise use all clusters
          const filteredClusters = selectedClusterFilter
            ? clusters.filter((c) => c.id.toString() === selectedClusterFilter)
            : clusters;

          // Average members per cluster across filtered clusters
          const avgMembersPerCluster =
            filteredClusters.length > 0
              ? filteredClusters.reduce(
                  (sum, c) => sum + (c.members?.length || 0),
                  0
                ) / filteredClusters.length
              : 0;

          // Total possible member attendances (reports * average members per cluster)
          // analytics.total_reports is already filtered by month, year, cluster, gathering_type
          const totalPossibleMemberAttendances =
            analytics.total_reports * avgMembersPerCluster;

          const memberAttendanceRate =
            totalPossibleMemberAttendances > 0
              ? Math.round(
                  (analytics.total_attendance.members /
                    totalPossibleMemberAttendances) *
                    100 *
                    10
                ) / 10
              : 0;

          // Calculate visitor count per month
          const visitorCountPerMonth = selectedMonth
            ? reports
                .filter((r) => {
                  const reportDate = new Date(r.meeting_date);
                  return (
                    reportDate.getMonth() + 1 === parseInt(selectedMonth) &&
                    reportDate.getFullYear() === selectedYear
                  );
                })
                .reduce((sum, r) => sum + (r.visitors_attended?.length || 0), 0)
            : Math.round((analytics.total_attendance.visitors / 12) * 10) / 10;

          // Average member attendance
          // analytics.average_attendance.avg_members is already filtered by month, year, cluster, gathering_type
          const avgMemberAttendance =
            Math.round(analytics.average_attendance.avg_members * 10) / 10;

          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Report Frequency Card */}
              <div
                className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm"
                role="region"
                aria-label="Report Frequency"
              >
                <div className="flex items-center">
                  <div
                    className="p-1.5 bg-blue-100 rounded-lg"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Report Frequency
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Report frequency value"
                    >
                      {reportFrequency}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      {selectedMonth
                        ? "Reports this month"
                        : "Average reports per month"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Attendance Rate Card */}
              <div
                className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm"
                role="region"
                aria-label="Member Attendance Rate"
              >
                <div className="flex items-center">
                  <div
                    className="p-1.5 bg-green-100 rounded-lg"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5 text-green-600"
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
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Member Attendance Rate
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Member attendance rate value"
                    >
                      {memberAttendanceRate}%
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      % of members attending
                    </p>
                  </div>
                </div>
              </div>

              {/* Visitor Count per Month Card */}
              <div
                className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm"
                role="region"
                aria-label="Visitor Count per Month"
              >
                <div className="flex items-center">
                  <div
                    className="p-1.5 bg-yellow-100 rounded-lg"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Visitor Count
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Visitor count per month value"
                    >
                      {visitorCountPerMonth}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      {selectedMonth
                        ? "Visitors this month"
                        : "Average visitors per month"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Average Member Attendance Card */}
              <div
                className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm"
                role="region"
                aria-label="Average Member Attendance"
              >
                <div className="flex items-center">
                  <div
                    className="p-1.5 bg-purple-100 rounded-lg"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5 text-purple-600"
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
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Avg Member Attendance
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Average member attendance value"
                    >
                      {avgMemberAttendance}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Average members per report
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Charts Section */}
      {analytics && reports.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Analytics Charts
            </h2>
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showCharts ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                  Hide Charts
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                  Show Charts
                </>
              )}
            </button>
          </div>
          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Chart 1: Attendance Trend Over Time */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Attendance Trend
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(() => {
                        // Group reports by month and calculate attendance
                        const monthlyData: Record<
                          string,
                          { month: string; members: number; visitors: number }
                        > = {};

                        reports.forEach((report) => {
                          const date = new Date(report.meeting_date);
                          const monthKey = `${date.getFullYear()}-${String(
                            date.getMonth() + 1
                          ).padStart(2, "0")}`;
                          const monthLabel = date.toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          });

                          if (!monthlyData[monthKey]) {
                            monthlyData[monthKey] = {
                              month: monthLabel,
                              members: 0,
                              visitors: 0,
                            };
                          }

                          monthlyData[monthKey].members +=
                            report.members_attended?.length || 0;
                          monthlyData[monthKey].visitors +=
                            report.visitors_attended?.length || 0;
                        });

                        return Object.values(monthlyData).sort((a, b) => {
                          const dateA = new Date(a.month);
                          const dateB = new Date(b.month);
                          return dateA.getTime() - dateB.getTime();
                        });
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="members"
                        stroke="#2563EB"
                        strokeWidth={2}
                        name="Members"
                      />
                      <Line
                        type="monotone"
                        dataKey="visitors"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        name="Visitors"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Cluster Comparison */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Cluster Comparison
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        // Calculate attendance rate per cluster
                        const clusterData: Record<
                          string,
                          {
                            cluster: string;
                            attendanceRate: number;
                            avgAttendance: number;
                          }
                        > = {};

                        reports.forEach((report) => {
                          const clusterId = report.cluster?.toString() || "";
                          const cluster = clusters.find(
                            (c) => c.id.toString() === clusterId
                          );
                          const clusterName =
                            cluster?.name ||
                            cluster?.code ||
                            `Cluster ${clusterId}`;

                          if (!clusterData[clusterId]) {
                            clusterData[clusterId] = {
                              cluster: clusterName,
                              attendanceRate: 0,
                              avgAttendance: 0,
                            };
                          }

                          const memberCount =
                            report.members_attended?.length || 0;
                          const totalMembers = cluster?.members?.length || 1;
                          const rate =
                            totalMembers > 0
                              ? (memberCount / totalMembers) * 100
                              : 0;

                          clusterData[clusterId].avgAttendance += memberCount;
                        });

                        // Calculate averages
                        Object.keys(clusterData).forEach((clusterId) => {
                          const clusterReports = reports.filter(
                            (r) => r.cluster?.toString() === clusterId
                          );
                          if (clusterReports.length > 0) {
                            clusterData[clusterId].avgAttendance = Math.round(
                              clusterData[clusterId].avgAttendance /
                                clusterReports.length
                            );

                            const cluster = clusters.find(
                              (c) => c.id.toString() === clusterId
                            );
                            const totalMembers = cluster?.members?.length || 1;
                            const totalAttendance =
                              clusterData[clusterId].avgAttendance *
                              clusterReports.length;
                            clusterData[clusterId].attendanceRate =
                              totalMembers > 0
                                ? Math.round(
                                    (totalAttendance /
                                      (totalMembers * clusterReports.length)) *
                                      100
                                  )
                                : 0;
                          }
                        });

                        return Object.values(clusterData)
                          .sort((a, b) => b.attendanceRate - a.attendanceRate)
                          .slice(0, 10); // Top 10 clusters
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="cluster"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="attendanceRate"
                        fill="#2563EB"
                        name="Attendance Rate (%)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Gathering Type Distribution */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Gathering Type Distribution
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const typeCounts: Record<string, number> = {};
                          reports.forEach((report) => {
                            const type = report.gathering_type || "UNKNOWN";
                            typeCounts[type] = (typeCounts[type] || 0) + 1;
                          });

                          return Object.entries(typeCounts).map(
                            ([type, count]) => ({
                              name: type,
                              value: count,
                            })
                          );
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(() => {
                          const COLORS = ["#2563EB", "#F59E0B", "#10B981"];
                          const typeCounts: Record<string, number> = {};
                          reports.forEach((report) => {
                            const type = report.gathering_type || "UNKNOWN";
                            typeCounts[type] = (typeCounts[type] || 0) + 1;
                          });

                          return Object.keys(typeCounts).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ));
                        })()}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Attendance by Month */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Attendance by Month
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const monthlyData: Record<
                          string,
                          { month: string; members: number; visitors: number }
                        > = {};

                        reports.forEach((report) => {
                          const date = new Date(report.meeting_date);
                          const monthKey = `${date.getFullYear()}-${String(
                            date.getMonth() + 1
                          ).padStart(2, "0")}`;
                          const monthLabel = date.toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          });

                          if (!monthlyData[monthKey]) {
                            monthlyData[monthKey] = {
                              month: monthLabel,
                              members: 0,
                              visitors: 0,
                            };
                          }

                          monthlyData[monthKey].members +=
                            report.members_attended?.length || 0;
                          monthlyData[monthKey].visitors +=
                            report.visitors_attended?.length || 0;
                        });

                        return Object.values(monthlyData).sort((a, b) => {
                          const dateA = new Date(a.month);
                          const dateB = new Date(b.month);
                          return dateA.getTime() - dateB.getTime();
                        });
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="members" fill="#2563EB" name="Members" />
                      <Bar dataKey="visitors" fill="#F59E0B" name="Visitors" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cluster
            </label>
            <ScalableSelect
              options={clusterOptions}
              value={selectedClusterFilter ? String(selectedClusterFilter) : ""}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <button
                type="button"
                onClick={() => {
                  const currentMonth = new Date().getMonth() + 1;
                  if (selectedMonth === "") {
                    // Switch to current month
                    setSelectedMonth(currentMonth.toString());
                  } else {
                    // Switch to all months
                    setSelectedMonth("");
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                title={
                  selectedMonth === ""
                    ? "Show Current Month"
                    : "Show All Months"
                }
              >
                {selectedMonth === "" ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Current Month
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                    All Months
                  </>
                )}
              </button>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-2 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Week</label>
              <button
                type="button"
                onClick={() => {
                  const currentWeek = getISOWeekNumber(new Date());
                  if (selectedWeek === "") {
                    // Switch to current week
                    setSelectedWeek(currentWeek.toString());
                  } else {
                    // Switch to all weeks
                    setSelectedWeek("");
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                title={
                  selectedWeek === "" ? "Show Current Week" : "Show All Weeks"
                }
              >
                {selectedWeek === "" ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Current Week
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                    All Weeks
                  </>
                )}
              </button>
            </div>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-2 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Weeks</option>
              {Array.from({ length: 53 }, (_, i) => {
                const weekNum = i + 1;
                const currentWeek = getISOWeekNumber(new Date());
                const isCurrentWeek =
                  weekNum === currentWeek &&
                  selectedYear === new Date().getFullYear();
                const dateRange = formatWeekDateRange(selectedYear, weekNum);
                return (
                  <option key={weekNum} value={weekNum.toString()}>
                    W{weekNum} ({dateRange}){isCurrentWeek ? " - Current" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-2 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-2 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-end gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            {/* View Toggle - Mobile Only */}
            <div className="md:hidden flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                  viewMode === "cards"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                title="Card View"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                  viewMode === "table"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                title="Table View"
              >
                <TableCellsIcon className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => setShowColumnsModal(true)}
              className="inline-flex items-center px-4 py-2 min-h-[44px] border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                className="inline-flex items-center px-4 py-2 min-h-[44px] border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
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
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
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
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
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
            {/* Card View - Mobile Only */}
            {viewMode === "cards" && (
              <div className="md:hidden space-y-4 p-4">
                {sortedReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      {/* Cluster Name - Full Width */}
                      <div>
                        <button
                          onClick={() => handleViewReport(report)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-base"
                        >
                          {report.cluster_code
                            ? `${report.cluster_code} - ${report.cluster_name}`
                            : report.cluster_name}
                        </button>
                      </div>
                      {/* Fields in Two Columns */}
                      <div className="grid grid-cols-2 gap-3">
                        {visibleColumns.has("week") && (
                          <div>
                            <span className="text-xs text-gray-500">Week</span>
                            <p className="text-sm text-gray-900">
                              {report.year} W{report.week_number}
                            </p>
                          </div>
                        )}
                        {visibleColumns.has("meeting_date") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Meeting Date
                            </span>
                            <p className="text-sm text-gray-900">
                              {new Date(
                                report.meeting_date
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {visibleColumns.has("attendance") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Attendance
                            </span>
                            <p className="text-sm text-gray-900">
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
                            </p>
                          </div>
                        )}
                        {visibleColumns.has("member_attendance_rate") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Member Rate
                            </span>
                            <p className="text-sm text-gray-900">
                              {report.member_attendance_rate !== undefined
                                ? `${report.member_attendance_rate.toFixed(1)}%`
                                : "N/A"}
                            </p>
                          </div>
                        )}
                        {visibleColumns.has("type") && (
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">
                              Type
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGatheringTypeColor(
                                report.gathering_type
                              )}`}
                            >
                              {report.gathering_type}
                            </span>
                          </div>
                        )}
                        {visibleColumns.has("offerings") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Offerings
                            </span>
                            <p className="text-sm text-gray-900">
                              {formatCurrency(
                                typeof report.offerings === "number"
                                  ? report.offerings
                                  : parseFloat(String(report.offerings)) || 0
                              )}
                            </p>
                          </div>
                        )}
                        {visibleColumns.has("submitted_by") && (
                          <div className="col-span-2">
                            <span className="text-xs text-gray-500">
                              Submitted By
                            </span>
                            <p className="text-sm text-gray-900">
                              {report.submitted_by_details
                                ? formatPersonName(report.submitted_by_details)
                                : "Unknown"}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => handleViewReport(report)}
                          className="flex-1 text-indigo-600 hover:text-indigo-900 py-2 px-3 rounded border border-indigo-200 hover:bg-indigo-50 text-sm font-medium"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditReport(report)}
                          className="flex-1 text-blue-600 hover:text-blue-900 py-2 px-3 rounded border border-blue-200 hover:bg-blue-50 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report)}
                          className="flex-1 text-red-600 hover:text-red-900 py-2 px-3 rounded border border-red-200 hover:bg-red-50 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Table View - Mobile when table selected, always on desktop */}
            <div
              className={`overflow-x-auto ${
                viewMode === "cards" ? "hidden md:block" : ""
              }`}
            >
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
                                {formatCurrency(
                                  typeof report.offerings === "number"
                                    ? report.offerings
                                    : parseFloat(String(report.offerings)) || 0
                                )}
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
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        isOpen={isFormOpen}
        onClose={() => {
          if (onFormClose) {
            onFormClose();
          } else {
            setShowForm(false);
            setSelectedCluster(null);
            setEditingReport(null);
          }
        }}
        title={
          formEditingReport ? "Edit Weekly Report" : "Submit Weekly Report"
        }
        className="!mt-0"
      >
        <ClusterWeeklyReportForm
          cluster={formSelectedCluster as any}
          clusters={clusters as any}
          isOpen={isFormOpen}
          onClose={() => {
            if (onFormClose) {
              onFormClose();
            } else {
              setShowForm(false);
              setSelectedCluster(null);
              setEditingReport(null);
            }
          }}
          onSubmit={handleSubmitReport as any}
          initialData={(formEditingReport as any) || undefined}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 !mt-0">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col sm:mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Configure Columns
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Select which columns to display in the table
              </p>
            </div>
            <div className="px-6 py-4 flex-1 overflow-y-auto">
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
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3">
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
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import Pagination from "@/src/components/ui/Pagination";
import {
  EvangelismAnalytics,
  EvangelismGroup,
  EvangelismWeeklyReport,
} from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import EvangelismWeeklyReportForm, {
  EvangelismWeeklyReportFormValues,
} from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import ViewEvangelismWeeklyReportModal from "@/src/components/evangelism/ViewEvangelismWeeklyReportModal";
import { evangelismApi, PaginatedResponse } from "@/src/lib/api";
import { buildEvangelismWeeklyReportPayloadFromFormValues } from "@/src/lib/evangelismWeeklyReportSubmit";
import { getEvangelismGatheringTypeChipClass } from "@/src/lib/evangelismGatheringTypeStyles";
import { requestNotificationsRefetch } from "@/src/lib/notificationsEvents";
import { isDuplicateMeetingReportError } from "@/src/lib/apiErrors";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import {
  defaultIsoWeekForMonth,
  getIsoWeekDateRange,
  getIsoWeekParts,
  isoWeeksOverlappingMonth,
} from "@/src/lib/isoWeek";
import { canHardDelete } from "@/src/lib/canHardDelete";
import { canSubmitEvangelismReport } from "@/src/lib/evangelism/evangelismPermissions";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { parseTallyScope } from "@/src/components/evangelism/PeopleTallyReport";
import { resolveEvangelismGroupClusterMeta } from "@/src/lib/evangelismGroupDisplay";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatLocaleDate } from "@/src/lib/date";
import {
  canChangeEvangelismBranchFilter,
  EVANGELISM_BRANCH_LOCKED_HINT,
} from "@/src/lib/evangelismBranchFilter";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface EvangelismReportsDashboardProps {
  groups: EvangelismGroup[];
  clusters: Cluster[];
  branches: Branch[];
  /** Increment (e.g. Submit Report header) resets edit state for a new submit */
  openSubmitNonce?: number;
  refreshTrigger?: number;
  /** Pre-select group when opening submit from notification deep link */
  presetGroupId?: string | null;
  /** Open view modal for a report id from notification deep link */
  initialViewReportId?: string | null;
  /** Parent-owned open state so visiting Reports does not replay a stale submit. */
  externalShowForm?: boolean;
  /** Lets the page keep this dashboard mounted while the submit modal is open. */
  onFormOpenChange?: (open: boolean) => void;
  /** When true, branch is controlled by the page header. */
  hideBranchFilter?: boolean;
  /** Page-header branch id; used when `hideBranchFilter` is true. "" means all branches. */
  branchId?: string;
}

const STAT_CARDS_GRID =
  "grid grid-cols-1 tablet:grid-cols-2 xl:grid-cols-4 gap-4";

const FILTER_SELECT_CLASS =
  "w-full px-2 py-2 min-h-[44px] border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-ring focus:border-transparent";

const TOOLBAR_BTN_CLASS =
  "inline-flex shrink-0 items-center px-3 sm:px-4 py-2 min-h-[44px] border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring";

const REPORT_AVAILABLE_COLUMNS: {
  key: string;
  label: string;
  default: boolean;
}[] = [
  { key: "group", label: "Group", default: true },
  { key: "week", label: "Week", default: true },
  { key: "meeting_date", label: "Meeting Date", default: true },
  { key: "gathering", label: "Type", default: true },
  { key: "members", label: "Members", default: true },
  { key: "visitors", label: "Visitors", default: true },
];

function formatWeekDateRange(year: number, weekNumber: number): string {
  const { start, end } = getIsoWeekDateRange(year, weekNumber);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const endDay = end.getDate();
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function reportGatheringLabel(report: EvangelismWeeklyReport): string {
  if (report.cancelled) return "Cancelled";
  return report.gathering_type || "—";
}

function membersCount(report: EvangelismWeeklyReport): number {
  return Array.isArray(report.members_attended)
    ? report.members_attended.length
    : 0;
}

function visitorsCount(report: EvangelismWeeklyReport): number {
  return Array.isArray(report.visitors_attended)
    ? report.visitors_attended.length
    : 0;
}

export default function EvangelismReportsDashboard({
  groups,
  clusters,
  branches,
  openSubmitNonce = 0,
  refreshTrigger = 0,
  presetGroupId = null,
  initialViewReportId = null,
  externalShowForm,
  onFormOpenChange,
  hideBranchFilter = false,
  branchId,
}: EvangelismReportsDashboardProps) {
  const { user, isSeniorCoordinator } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const canChangeBranchFilter = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const canMutateReports = useMemo(
    () => canSubmitEvangelismReport({ user, moduleEnabled }),
    [user, moduleEnabled],
  );
  const userCanHardDeleteReports = canHardDelete(user);
  const reportsBranchUserIdRef = useRef<number | undefined>(undefined);

  const [reports, setReports] = useState<EvangelismWeeklyReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedGroupForForm, setSelectedGroupForForm] =
    useState<EvangelismGroup | null>(null);
  const [editingReport, setEditingReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewingReport, setViewingReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [pendingDeleteReport, setPendingDeleteReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  /** `group:id` via parseTallyScope, or "" for all groups */
  const [reportsScope, setReportsScope] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [selectedWeek, setSelectedWeek] = useState<string>(() =>
    String(getIsoWeekParts(new Date()).week),
  );
  const [selectedGatheringType, setSelectedGatheringType] =
    useState<string>("");

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [visibleReportColumns, setVisibleReportColumns] = useState<Set<string>>(
    () =>
      new Set(
        REPORT_AVAILABLE_COLUMNS.filter((c) => c.default).map((c) => c.key),
      ),
  );
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });

  const [analytics, setAnalytics] = useState<EvangelismAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastAnalyticsUpdatedAt, setLastAnalyticsUpdatedAt] =
    useState<Date | null>(null);
  const [analyticsHighlightFlash, setAnalyticsHighlightFlash] = useState(false);
  const analyticsHighlightTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  const lastNonceRef = useRef(openSubmitNonce);
  const isFormOpen =
    externalShowForm !== undefined ? externalShowForm : showReportModal;

  const applyMonthFilter = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (!monthValue) {
      setSelectedWeek("");
      return;
    }
    setSelectedWeek(
      String(defaultIsoWeekForMonth(selectedYear, Number(monthValue))),
    );
  };

  const applyWeekFilter = (weekValue: string) => {
    setSelectedWeek(weekValue);
    if (!weekValue) return;
    const { start } = getIsoWeekDateRange(selectedYear, Number(weekValue));
    setSelectedMonth(String(start.getMonth() + 1).padStart(2, "0"));
  };

  const weekFilterOptions = useMemo(() => {
    const month = selectedMonth ? Number(selectedMonth) : null;
    const weekNumbers = month
      ? isoWeeksOverlappingMonth(selectedYear, month)
      : Array.from({ length: 53 }, (_, index) => index + 1);

    return weekNumbers.map((weekNum) => ({
      value: weekNum.toString(),
      label: `W${weekNum} (${formatWeekDateRange(selectedYear, weekNum)})`,
    }));
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (openSubmitNonce <= lastNonceRef.current) {
      return;
    }
    lastNonceRef.current = openSubmitNonce;
    setEditingReport(null);
    if (externalShowForm === undefined) {
      setShowReportModal(true);
    }
  }, [openSubmitNonce, externalShowForm]);

  useEffect(() => {
    if (!isFormOpen || editingReport) {
      return;
    }
    if (presetGroupId) {
      const group = groups.find((g) => String(g.id) === presetGroupId);
      setSelectedGroupForForm(group ?? null);
      return;
    }
    if (groups.length === 1) {
      setSelectedGroupForForm(groups[0]);
      return;
    }
    setSelectedGroupForForm(null);
  }, [isFormOpen, presetGroupId, groups, editingReport]);

  useEffect(() => {
    if (!initialViewReportId) {
      return;
    }
    let cancelled = false;
    evangelismApi.getWeeklyReport(initialViewReportId).then((res) => {
      if (!cancelled) {
        setViewingReport(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialViewReportId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        exportButtonRef.current &&
        exportDropdownRef.current &&
        !exportButtonRef.current.contains(e.target as Node) &&
        !exportDropdownRef.current.contains(e.target as Node) &&
        showExportDropdown
      ) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showExportDropdown]);

  useEffect(() => {
    if (hideBranchFilter) {
      const next = branchId ?? "";
      if (selectedBranch !== next) {
        setSelectedBranch(next);
        setReportsScope("");
      }
      return;
    }
    if (!user) {
      reportsBranchUserIdRef.current = undefined;
      return;
    }
    if (reportsBranchUserIdRef.current !== user.id) {
      reportsBranchUserIdRef.current = user.id;
      setSelectedBranch(
        user.branch != null && user.branch !== undefined
          ? String(user.branch)
          : "",
      );
      setReportsScope("");
    }
  }, [user, hideBranchFilter, branchId, selectedBranch]);

  useEffect(() => {
    if (hideBranchFilter) return;
    if (!user || canChangeBranchFilter) return;
    if (user.branch != null && selectedBranch !== String(user.branch)) {
      setSelectedBranch(String(user.branch));
    }
    if (user.branch == null && selectedBranch !== "") {
      setSelectedBranch("");
    }
  }, [user, canChangeBranchFilter, selectedBranch, hideBranchFilter]);

  const evangelismGroupsScoped = useMemo(() => {
    if (!selectedBranch) return groups;
    return groups.filter((eg) => {
      const groupBranch = eg.branch ?? eg.branch_id;
      if (
        groupBranch != null &&
        String(groupBranch) === String(selectedBranch)
      ) {
        return true;
      }
      const { clusterBranch } = resolveEvangelismGroupClusterMeta(
        eg,
        clusters,
        branches,
      );
      if (
        clusterBranch?.id != null &&
        String(clusterBranch.id) === String(selectedBranch)
      ) {
        return true;
      }
      const clusterId = eg.cluster?.id ?? eg.cluster_id;
      if (clusterId == null || clusterId === "") return false;
      const cl = clusters.find((c) => String(c.id) === String(clusterId));
      const raw = cl?.branch ?? eg.cluster?.branch;
      const bid =
        raw != null && typeof raw === "object" && "id" in raw
          ? (raw as { id: number }).id
          : raw;
      return bid != null && String(bid) === String(selectedBranch);
    });
  }, [groups, selectedBranch, clusters, branches]);

  const scopeSelectOptions = useMemo(() => {
    const opts = evangelismGroupsScoped.map((g) => {
      const { clusterBranch, clusterDisplayCode } =
        resolveEvangelismGroupClusterMeta(g, clusters, branches);
      let clusterCode =
        clusterDisplayCode && clusterDisplayCode !== "—"
          ? clusterDisplayCode
          : null;
      let clusterBranchId = clusterBranch?.id ?? null;
      if (!clusterCode && g.cluster_id) {
        const cl = clusters.find((c) => String(c.id) === String(g.cluster_id));
        clusterCode = cl?.code?.trim() || null;
        if (cl?.branch != null) clusterBranchId = Number(cl.branch);
      }
      return {
        value: `group:${g.id}`,
        label: g.name || `Group ${g.id}`,
        clusterCode,
        clusterBranchId,
        hasBibleSharers:
          (g.bible_sharer_ids?.length ?? 0) > 0 ||
          Boolean(g.is_bible_sharers_group),
      };
    });
    opts.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    return opts;
  }, [evangelismGroupsScoped, clusters, branches]);

  useEffect(() => {
    if (parseTallyScope(reportsScope).cluster != null) {
      setReportsScope("");
    }
  }, [reportsScope]);

  const buildFilterParams = useCallback(() => {
    const scope = parseTallyScope(reportsScope);
    const params: Record<string, string | number> = {};
    if (selectedBranch) params.branch = Number(selectedBranch);
    if (scope.cluster != null) params.cluster = scope.cluster;
    if (scope.evangelism_group != null)
      params.evangelism_group = scope.evangelism_group;
    params.year = selectedYear;
    if (selectedMonth) params.month = Number(selectedMonth);
    if (selectedWeek) params.week_number = Number(selectedWeek);
    if (selectedGatheringType) params.gathering_type = selectedGatheringType;
    return params;
  }, [
    selectedBranch,
    reportsScope,
    selectedYear,
    selectedMonth,
    selectedWeek,
    selectedGatheringType,
  ]);

  const refetchReports = useCallback(async () => {
    // Parent bumps refreshTrigger after external creates/updates.
    void refreshTrigger;
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        ...buildFilterParams(),
        page: currentPage,
        page_size: itemsPerPage,
        ordering: "-year,-week_number",
      };

      const response = await evangelismApi.listWeeklyReports(params);
      const raw = response.data as
        | PaginatedResponse<EvangelismWeeklyReport>
        | EvangelismWeeklyReport[]
        | unknown;
      let rows: EvangelismWeeklyReport[] = [];
      let count = 0;
      if (Array.isArray(raw)) {
        rows = raw;
        count = raw.length;
      } else if (
        raw &&
        typeof raw === "object" &&
        "results" in raw &&
        Array.isArray((raw as PaginatedResponse<EvangelismWeeklyReport>).results)
      ) {
        const p = raw as PaginatedResponse<EvangelismWeeklyReport>;
        rows = p.results;
        count = typeof p.count === "number" ? p.count : p.results.length;
      }
      setReports(rows);
      setTotalCount(count);
    } catch (e) {
      console.error(e);
      setReports([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams, currentPage, itemsPerPage, refreshTrigger]);

  const fetchAnalytics = useCallback(async () => {
    void refreshTrigger;
    try {
      setAnalyticsLoading(true);
      const response = await evangelismApi.analytics(buildFilterParams());
      setAnalytics(response.data);
      setLastAnalyticsUpdatedAt(new Date());
      if (analyticsHighlightTimerRef.current) {
        clearTimeout(analyticsHighlightTimerRef.current);
      }
      setAnalyticsHighlightFlash(true);
      analyticsHighlightTimerRef.current = setTimeout(() => {
        setAnalyticsHighlightFlash(false);
        analyticsHighlightTimerRef.current = null;
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [buildFilterParams, refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    const scope = parseTallyScope(reportsScope);
    const params: Record<string, string | number> = {};
    if (selectedBranch) params.branch = Number(selectedBranch);
    if (scope.cluster != null) params.cluster = scope.cluster;
    if (scope.evangelism_group != null)
      params.evangelism_group = scope.evangelism_group;
    if (selectedGatheringType) params.gathering_type = selectedGatheringType;

    setYearsLoading(true);
    evangelismApi
      .weeklyReportsDistinctYears(params)
      .then((res) => {
        if (!cancelled) setAvailableYears(res.data.years ?? []);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setAvailableYears([]);
      })
      .finally(() => {
        if (!cancelled) setYearsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBranch, reportsScope, selectedGatheringType, refreshTrigger]);

  useEffect(() => {
    const fallbackYear = new Date().getFullYear();
    const opts =
      availableYears.length > 0 ? availableYears : [fallbackYear];
    setSelectedYear((y) => (opts.includes(y) ? y : opts[0]));
  }, [availableYears]);

  useEffect(() => {
    void refetchReports();
  }, [refetchReports]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    return () => {
      if (analyticsHighlightTimerRef.current) {
        clearTimeout(analyticsHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBranch,
    reportsScope,
    selectedYear,
    selectedMonth,
    selectedWeek,
    selectedGatheringType,
  ]);

  const closeReportModal = useCallback(() => {
    setShowReportModal(false);
    setEditingReport(null);
    setSelectedGroupForForm(null);
    setFormError(null);
    onFormOpenChange?.(false);
  }, [onFormOpenChange]);

  const openReportModal = useCallback(
    (report?: EvangelismWeeklyReport | null) => {
      setFormError(null);
      if (report) {
        setSelectedGroupForForm(report.evangelism_group);
        setEditingReport(report);
      } else {
        setSelectedGroupForForm(null);
        setEditingReport(null);
      }
      if (externalShowForm === undefined) {
        setShowReportModal(true);
      }
      onFormOpenChange?.(true);
    },
    [externalShowForm, onFormOpenChange],
  );

  const handleSubmitForm = async (values: EvangelismWeeklyReportFormValues) => {
    if (!values.evangelism_group_id) return;
    try {
      setFormSubmitting(true);
      setFormError(null);
      const payload =
        await buildEvangelismWeeklyReportPayloadFromFormValues(values);
      if (editingReport) {
        await evangelismApi.updateWeeklyReport(editingReport.id, payload);
      } else {
        await evangelismApi.createWeeklyReport(payload as never);
      }
      closeReportModal();
      await refetchReports();
      await fetchAnalytics();
      requestNotificationsRefetch();
    } catch (err: unknown) {
      if (isDuplicateMeetingReportError(err)) {
        throw err;
      }
      const e = err as { response?: { data?: Record<string, unknown> } };
      const data = e.response?.data;
      let msg = "Failed to save report.";
      if (data?.detail) msg = String(data.detail);
      else if (data) {
        const first = Object.values(data)[0];
        msg = Array.isArray(first)
          ? String(first[0])
          : typeof first === "string"
            ? first
            : msg;
      }
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSortToggle = () => {
    setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
  };

  const sortedReports = useMemo(() => {
    const list = Array.isArray(reports) ? reports : [];
    return [...list].sort((a, b) => {
      const ta = new Date(a.meeting_date).getTime();
      const tb = new Date(b.meeting_date).getTime();
      return sortDirection === "desc" ? tb - ta : ta - tb;
    });
  }, [reports, sortDirection]);

  const exportRows = () =>
    sortedReports.map((r) => ({
      Group: r.evangelism_group?.name ?? "",
      Week: `${r.year} W${r.week_number}`,
      "Meeting Date": r.meeting_date ? formatLocaleDate(r.meeting_date) : "",
      "Gathering Type": r.cancelled ? "Cancelled" : r.gathering_type || "",
      "Cancellation Reason": r.cancellation_reason || "",
      Members: membersCount(r),
      Visitors: visitorsCount(r),
    }));

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, "Evangelism Reports");
    XLSX.writeFile(wb, "evangelism_weekly_reports.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const cols = [
      "Group",
      "Week",
      "Meeting Date",
      "Type",
      "Members",
      "Visitors",
    ];
    const rows = sortedReports.map((r) => [
      r.evangelism_group?.name ?? "",
      `${r.year} W${r.week_number}`,
      r.meeting_date ? formatLocaleDate(r.meeting_date) : "",
      r.cancelled ? "Cancelled" : r.gathering_type || "",
      String(membersCount(r)),
      String(visitorsCount(r)),
    ]);
    autoTable(doc, {
      head: [cols],
      body: rows,
      startY: 16,
      styles: { fontSize: 8 },
    });
    doc.save("evangelism_weekly_reports.pdf");
  };

  const exportToCSV = () => {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || {
      Group: "",
      Week: "",
      "Meeting Date": "",
      "Gathering Type": "",
      Members: "",
      Visitors: "",
    });
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => escape(row[h as keyof typeof row])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evangelism_weekly_reports.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (fmt: "excel" | "pdf" | "csv") => {
    setShowExportDropdown(false);
    if (fmt === "excel") exportToExcel();
    else if (fmt === "pdf") exportToPDF();
    else exportToCSV();
  };

  const openView = async (report: EvangelismWeeklyReport) => {
    try {
      const res = await evangelismApi.getWeeklyReport(report.id);
      setViewingReport(res.data);
    } catch {
      setViewingReport(report);
    }
  };

  const confirmDelete = async () => {
    const rpt = pendingDeleteReport;
    if (!rpt) return;
    try {
      await evangelismApi.deleteWeeklyReport(rpt.id);
      setPendingDeleteReport(null);
      await refetchReports();
      await fetchAnalytics();
    } catch (e) {
      console.error(e);
    }
  };

  const branchOptions = useMemo(() => {
    if (canChangeBranchFilter) {
      return [
        { value: "", label: "All branches" },
        ...branches.map((b) => ({ value: String(b.id), label: b.name })),
      ];
    }
    if (user?.branch != null) {
      const row = branches.find((b) => Number(b.id) === Number(user.branch));
      const label =
        row?.name ??
        user.branch_name?.trim() ??
        `Branch #${user.branch}`;
      return [{ value: String(user.branch), label }];
    }
    return [{ value: "", label: "No branch assigned" }];
  }, [branches, canChangeBranchFilter, user?.branch, user?.branch_name]);

  const reportFormGroups = useMemo(() => {
    const list = [...evangelismGroupsScoped];
    if (
      selectedGroupForForm &&
      !list.some((g) => String(g.id) === String(selectedGroupForForm.id))
    ) {
      list.unshift(selectedGroupForForm);
    }
    return list;
  }, [evangelismGroupsScoped, selectedGroupForForm]);

  const reportYearSelectOptions = useMemo(() => {
    if (availableYears.length > 0) return availableYears;
    return [new Date().getFullYear()];
  }, [availableYears]);

  const chartMonthlyAttendance = useMemo(() => {
    const apiMonthly = analytics?.chart_series?.monthly_attendance;
    if (apiMonthly?.length) {
      return apiMonthly.map((m) => ({
        month: m.month_label,
        members: m.members,
        visitors: m.visitors,
      }));
    }
    return [];
  }, [analytics?.chart_series?.monthly_attendance]);

  const chartGroupComparison = useMemo(() => {
    const rows = analytics?.chart_series?.group_comparison;
    if (!rows?.length) return [];
    return rows
      .map((row) => ({
        group: row.group_label,
        attendanceRate:
          typeof row.attendance_rate === "number"
            ? Math.min(100, Math.round(row.attendance_rate))
            : 0,
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10);
  }, [analytics?.chart_series?.group_comparison]);

  const chartGatheringPieData = useMemo(() => {
    const dist = analytics?.gathering_type_distribution;
    if (!dist?.length) return [];
    return dist.map((d) => ({
      name: d.gathering_type || "UNKNOWN",
      value: d.count,
    }));
  }, [analytics?.gathering_type_distribution]);

  const renderActionButtons = (
    report: EvangelismWeeklyReport,
    variant: "icon" | "card",
  ) => {
    if (variant === "card") {
      return (
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => void openView(report)}
            className="flex-1 text-indigo-600 hover:text-indigo-900 py-2 px-3 rounded border border-indigo-200 hover:bg-indigo-50 text-sm font-medium"
          >
            View
          </button>
          {canMutateReports && (
            <>
              <button
                type="button"
                onClick={() => openReportModal(report)}
                className="flex-1 text-primary hover:text-primary py-2 px-3 rounded border border-primary/20 hover:bg-primary/10 text-sm font-medium"
              >
                Edit
              </button>
              {userCanHardDeleteReports && (
                <button
                  type="button"
                  onClick={() => setPendingDeleteReport(report)}
                  className="flex-1 text-red-600 hover:text-red-900 py-2 px-3 rounded border border-red-200 hover:bg-red-50 text-sm font-medium"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      );
    }

    return (
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={() => void openView(report)}
          className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="View Report"
        >
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
        </button>
        {canMutateReports && (
          <>
            <button
              type="button"
              onClick={() => openReportModal(report)}
              className="text-primary hover:text-primary p-1 rounded hover:bg-primary/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Edit Report"
            >
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            {userCanHardDeleteReports && (
              <button
                type="button"
                onClick={() => setPendingDeleteReport(report)}
                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Delete Report"
              >
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const reportFrequency = analytics
    ? selectedMonth
      ? analytics.total_reports
      : Math.round((analytics.total_reports / 12) * 10) / 10
    : 0;
  const memberAttendanceRate = analytics
    ? Math.min(
        100,
        typeof analytics.average_member_attendance_rate === "number"
          ? Math.round(analytics.average_member_attendance_rate * 10) / 10
          : 0,
      )
    : 0;
  const visitorCountPerMonth = analytics
    ? selectedMonth
      ? analytics.total_attendance.visitors
      : Math.round((analytics.total_attendance.visitors / 12) * 10) / 10
    : 0;
  const avgMemberAttendance = analytics
    ? Math.round(analytics.average_attendance.avg_members * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm text-gray-500 max-w-3xl">
            These totals include every report that matches the filters below.
          </p>
          <p
            className="text-xs text-gray-500 shrink-0 tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            {analyticsLoading
              ? "Updating statistics…"
              : lastAnalyticsUpdatedAt
                ? `Statistics updated ${lastAnalyticsUpdatedAt.toLocaleTimeString(
                    undefined,
                    {
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}`
                : null}
          </p>
        </div>

        {analyticsLoading && !analytics ? (
          <div
            className={STAT_CARDS_GRID}
            aria-busy="true"
            aria-label="Loading statistics"
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm animate-pulse"
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg shrink-0" />
                  <div className="ml-4 flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-7 bg-gray-200 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {analytics && (
          <div
            className={`${STAT_CARDS_GRID} transition-shadow duration-300 rounded-lg p-0.5 -m-0.5 ${
              analyticsHighlightFlash
                ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-gray-50"
                : ""
            } ${analyticsLoading ? "opacity-60" : ""}`}
            role="region"
            aria-label="Report statistics"
            aria-busy={analyticsLoading}
          >
            <div className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center min-w-0">
                <div className="p-1.5 chip-primary-surface rounded-lg shrink-0">
                  <svg
                    className="w-5 h-5 text-primary"
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
                <div className="ml-4 min-w-0">
                  <p className="text-sm font-medium text-gray-600">
                    Report Frequency
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reportFrequency}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedMonth
                      ? "Reports this month"
                      : "Average reports per month"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center min-w-0">
                <div className="p-1.5 chip-green-surface rounded-lg shrink-0">
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
                <div className="ml-4 min-w-0">
                  <p className="text-sm font-medium text-gray-600">
                    Member Attendance Rate
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {memberAttendanceRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    % of members attending
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center min-w-0">
                <div className="p-1.5 chip-yellow-surface rounded-lg shrink-0">
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
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
                <div className="ml-4 min-w-0">
                  <p className="text-sm font-medium text-gray-600">
                    Visitor Count
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {visitorCountPerMonth}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedMonth
                      ? "Visitors this month"
                      : "Average visitors per month"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 py-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center min-w-0">
                <div className="p-1.5 chip-purple-surface rounded-lg shrink-0">
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
                <div className="ml-4 min-w-0">
                  <p className="text-sm font-medium text-gray-600">
                    Avg Member Attendance
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {avgMemberAttendance}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Average members per report
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      {analytics && analytics.total_reports > 0 && (
        <div className="mt-2">
          <p className="text-sm text-gray-500 mb-3">
            Charts include every report that matches the filters below—not only
            this page.
          </p>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Analytics Charts
            </h2>
            <button
              type="button"
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              {showCharts ? "Hide Charts" : "Show Charts"}
            </button>
          </div>
          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Attendance Trend
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartMonthlyAttendance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="members"
                        stroke="primary"
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

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Group Comparison
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartGroupComparison}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="group"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="attendanceRate"
                        fill="primary"
                        name="Attendance Rate (%)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Gathering Type Distribution
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartGatheringPieData}
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
                        {chartGatheringPieData.map((_, index) => {
                          const COLORS = ["primary", "#F59E0B", "#10B981"];
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Attendance by Month
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartMonthlyAttendance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="members" fill="primary" name="Members" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:flex lg:flex-nowrap">
          {!hideBranchFilter && (
            <div className="lg:w-36 lg:shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              {canChangeBranchFilter ? (
                <ScalableSelect
                  value={selectedBranch}
                  options={branchOptions}
                  onChange={(v) => {
                    setSelectedBranch(v);
                    setReportsScope("");
                  }}
                  className="w-full min-w-0 text-sm"
                />
              ) : (
                <LockedControlTooltip
                  label={EVANGELISM_BRANCH_LOCKED_HINT}
                  wrapperClassName="block w-full cursor-default"
                >
                  <ScalableSelect
                    value={selectedBranch}
                    options={branchOptions}
                    onChange={() => {}}
                    interactionBlocked
                    className="w-full min-w-0 text-sm"
                  />
                </LockedControlTooltip>
              )}
            </div>
          )}

          <div className="min-w-0 lg:flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evangelism group
            </label>
            <ScalableSelect
              options={[
                { value: "", label: "All groups" },
                ...scopeSelectOptions,
              ]}
              value={reportsScope}
              onChange={setReportsScope}
              placeholder="Select a group"
              searchPlaceholder="Search groups..."
              emptyMessage="No groups found"
              virtualizeThreshold={80}
              className="w-full"
              showSearch
              maxHeight={200}
            />
          </div>

          <div className="lg:w-40 lg:shrink-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Month</label>
              <button
                type="button"
                onClick={() => {
                  const currentMonth = new Date().getMonth() + 1;
                  if (selectedMonth === "") {
                    applyMonthFilter(String(currentMonth).padStart(2, "0"));
                  } else {
                    applyMonthFilter("");
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary hover:underline transition-colors"
                title={
                  selectedMonth === ""
                    ? "Show Current Month"
                    : "Show All Months"
                }
              >
                {selectedMonth === "" ? "Current Month" : "All Months"}
              </button>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => applyMonthFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Months</option>
              {[
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
              ].map((label, idx) => {
                const monthNum = idx + 1;
                const value = String(monthNum).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="lg:w-52 lg:shrink-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Week</label>
              <button
                type="button"
                onClick={() => {
                  const currentWeek = getIsoWeekParts(new Date()).week;
                  if (selectedWeek === "") {
                    applyWeekFilter(String(currentWeek));
                  } else {
                    applyWeekFilter("");
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary hover:underline transition-colors"
                title={
                  selectedWeek === "" ? "Show Current Week" : "Show All Weeks"
                }
              >
                {selectedWeek === "" ? "Current Week" : "All Weeks"}
              </button>
            </div>
            <select
              value={selectedWeek}
              onChange={(e) => applyWeekFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Weeks</option>
              {weekFilterOptions.map((week) => (
                <option key={week.value} value={week.value}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:w-24 lg:shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              disabled={yearsLoading || availableYears.length === 0}
              value={
                yearsLoading || availableYears.length === 0
                  ? ""
                  : reportYearSelectOptions.includes(selectedYear)
                    ? selectedYear
                    : reportYearSelectOptions[0]
              }
              onChange={(e) => {
                const year = parseInt(e.target.value, 10);
                setSelectedYear(year);
                if (!selectedMonth) return;
                const month = Number(selectedMonth);
                const weeks = isoWeeksOverlappingMonth(year, month);
                if (!selectedWeek || !weeks.includes(Number(selectedWeek))) {
                  setSelectedWeek(String(defaultIsoWeekForMonth(year, month)));
                }
              }}
              className={`${FILTER_SELECT_CLASS} disabled:bg-gray-100 disabled:text-gray-500`}
            >
              {yearsLoading ? (
                <option value="">Loading…</option>
              ) : availableYears.length === 0 ? (
                <option value="">No reports yet</option>
              ) : (
                reportYearSelectOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="lg:w-32 lg:shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gathering Type
            </label>
            <select
              value={selectedGatheringType}
              onChange={(e) => setSelectedGatheringType(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All Types</option>
              <option value="PHYSICAL">Physical</option>
              <option value="ONLINE">Online</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <div className="flex min-w-0 items-center gap-2">
              <div className="md:hidden flex shrink-0 items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-2.5 sm:px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                    viewMode === "cards"
                      ? "bg-primary/100 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title="Card View"
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 sm:px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                    viewMode === "table"
                      ? "bg-primary/100 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title="Table View"
                >
                  <TableCellsIcon className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowColumnsModal(true)}
                className={TOOLBAR_BTN_CLASS}
              >
                <svg
                  className="w-4 h-4 mr-2 shrink-0"
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
            </div>
            <div className="relative shrink-0">
              <button
                ref={exportButtonRef}
                type="button"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className={TOOLBAR_BTN_CLASS}
              >
                <DocumentArrowDownIcon className="w-4 h-4 mr-2 shrink-0" />
                Export
              </button>
              {showExportDropdown && (
                <div
                  ref={exportDropdownRef}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10"
                >
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => handleExport("excel")}
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export to Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("pdf")}
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export to PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("csv")}
                      className="flex items-center w-full px-4 py-2 min-h-[44px] text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export to CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
            <svg
              className="animate-spin h-7 w-7"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </div>
        ) : sortedReports.length === 0 ? (
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
            {viewMode === "cards" && (
              <div className="md:hidden space-y-4 p-4">
                {sortedReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="space-y-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => void openView(report)}
                          className="text-primary hover:text-primary hover:underline font-medium text-base"
                        >
                          {report.evangelism_group?.name ?? "—"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {visibleReportColumns.has("week") && (
                          <div>
                            <span className="text-xs text-gray-500">Week</span>
                            <p className="text-sm text-gray-900">
                              {report.year} W{report.week_number}
                            </p>
                          </div>
                        )}
                        {visibleReportColumns.has("meeting_date") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Meeting Date
                            </span>
                            <p className="text-sm text-gray-900">
                              {formatLocaleDate(report.meeting_date)}
                            </p>
                          </div>
                        )}
                        {visibleReportColumns.has("members") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Members
                            </span>
                            <p className="text-sm text-gray-900">
                              {report.cancelled ? "—" : membersCount(report)}
                            </p>
                          </div>
                        )}
                        {visibleReportColumns.has("visitors") && (
                          <div>
                            <span className="text-xs text-gray-500">
                              Visitors
                            </span>
                            <p
                              className={`text-sm ${
                                !report.cancelled && visitorsCount(report) === 0
                                  ? "text-red-600"
                                  : "text-gray-900"
                              }`}
                            >
                              {report.cancelled ? "—" : visitorsCount(report)}
                            </p>
                          </div>
                        )}
                        {visibleReportColumns.has("gathering") && (
                          <div>
                            <span className="text-xs text-gray-500 block mb-1">
                              Type
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                report.cancelled
                                  ? "bg-amber-100 text-amber-800"
                                  : getEvangelismGatheringTypeChipClass(
                                      report.gathering_type,
                                    )
                              }`}
                              title={
                                report.cancelled
                                  ? report.cancellation_reason || undefined
                                  : undefined
                              }
                            >
                              {reportGatheringLabel(report)}
                            </span>
                            {report.cancelled && report.cancellation_reason && (
                              <p className="mt-1 text-xs text-gray-600">
                                {report.cancellation_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {renderActionButtons(report, "card")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`overflow-x-auto ${
                viewMode === "cards" ? "hidden md:block" : ""
              }`}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {REPORT_AVAILABLE_COLUMNS.map((col) => {
                      if (!visibleReportColumns.has(col.key)) return null;
                      const sortable = col.key === "meeting_date";
                      return (
                        <th
                          key={col.key}
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                            sortable
                              ? "cursor-pointer hover:bg-gray-100 transition-colors"
                              : ""
                          }`}
                          onClick={sortable ? handleSortToggle : undefined}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{col.label}</span>
                            {sortable &&
                              (sortDirection === "desc" ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                              ))}
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
                      {visibleReportColumns.has("group") && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void openView(report)}
                            className={`${TABLE_ENTITY_LINK_CLASS} cursor-pointer transition-colors duration-150`}
                            title="Click to view report details"
                          >
                            {report.evangelism_group?.name ?? "—"}
                          </button>
                        </td>
                      )}
                      {visibleReportColumns.has("week") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.year} W{report.week_number}
                        </td>
                      )}
                      {visibleReportColumns.has("meeting_date") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatLocaleDate(report.meeting_date)}
                        </td>
                      )}
                      {visibleReportColumns.has("gathering") && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              report.cancelled
                                ? "bg-amber-100 text-amber-800"
                                : getEvangelismGatheringTypeChipClass(
                                    report.gathering_type,
                                  )
                            }`}
                            title={
                              report.cancelled
                                ? report.cancellation_reason || undefined
                                : undefined
                            }
                          >
                            {reportGatheringLabel(report)}
                          </span>
                        </td>
                      )}
                      {visibleReportColumns.has("members") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.cancelled ? "—" : membersCount(report)}
                        </td>
                      )}
                      {visibleReportColumns.has("visitors") && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-sm ${
                              !report.cancelled && visitorsCount(report) === 0
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {report.cancelled ? "—" : visitorsCount(report)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {renderActionButtons(report, "icon")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalCount > 0 && (
              <div className="px-4 sm:px-6 py-3 border-t border-gray-200">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(1, Math.ceil(totalCount / itemsPerPage))}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalCount}
                  onItemsPerPageChange={(newPageSize) => {
                    setItemsPerPage(newPageSize);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={closeReportModal}
        title={editingReport ? "Edit report" : "Submit report"}
        closeOnOutsideClick={false}
      >
        <EvangelismWeeklyReportForm
          group={selectedGroupForForm}
          availableGroups={reportFormGroups}
          clusters={clusters}
          initialGroupId={presetGroupId}
          initialData={editingReport ?? undefined}
          onSubmit={handleSubmitForm}
          onCancel={closeReportModal}
          isSubmitting={formSubmitting}
          error={formError}
        />
      </Modal>

      <Modal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        title="Configure columns"
      >
        <p className="mb-4 text-sm text-gray-600">
          Select which columns appear in the table. Actions always stay visible.
        </p>
        <div className="space-y-2">
          {REPORT_AVAILABLE_COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={visibleReportColumns.has(col.key)}
                onChange={(e) => {
                  const next = new Set(visibleReportColumns);
                  if (e.target.checked) next.add(col.key);
                  else next.delete(col.key);
                  setVisibleReportColumns(next);
                }}
                className="rounded border-gray-300 text-primary focus:ring-ring"
              />
              <span className="text-sm text-gray-800">{col.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-between sm:gap-3">
          <button
            type="button"
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            onClick={() =>
              setVisibleReportColumns(
                new Set(
                  REPORT_AVAILABLE_COLUMNS.filter((c) => c.default).map(
                    (c) => c.key,
                  ),
                ),
              )
            }
          >
            Reset to default
          </button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowColumnsModal(false)}
          >
            Done
          </Button>
        </div>
      </Modal>

      <ViewEvangelismWeeklyReportModal
        report={viewingReport}
        isOpen={!!viewingReport}
        onClose={() => setViewingReport(null)}
        canMutateReports={canMutateReports}
        onEdit={() => {
          if (!viewingReport) return;
          const rpt = viewingReport;
          setViewingReport(null);
          openReportModal(rpt);
        }}
        onDelete={
          userCanHardDeleteReports
            ? () => {
                if (!viewingReport) return;
                setPendingDeleteReport(viewingReport);
                setViewingReport(null);
              }
            : undefined
        }
      />

      <ConfirmationModal
        isOpen={pendingDeleteReport !== null}
        title="Delete report"
        message="Delete this evangelism report? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onClose={() => setPendingDeleteReport(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

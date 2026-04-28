"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  EvangelismGroup,
  EvangelismWeeklyReport,
  Prospect,
} from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import EvangelismWeeklyReportForm, {
  EvangelismWeeklyReportFormValues,
} from "@/src/components/evangelism/EvangelismWeeklyReportForm";
import ViewEvangelismWeeklyReportModal from "@/src/components/evangelism/ViewEvangelismWeeklyReportModal";
import { evangelismApi, PaginatedResponse } from "@/src/lib/api";
import { buildEvangelismWeeklyReportPayloadFromFormValues } from "@/src/lib/evangelismWeeklyReportSubmit";
import Table from "@/src/components/ui/Table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { parseTallyScope } from "@/src/components/evangelism/PeopleTallyReport";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface EvangelismReportsDashboardProps {
  groups: EvangelismGroup[];
  clusters: Cluster[];
  branches: Branch[];
  /** Increment (e.g. Submit Report header) opens the report modal */
  openSubmitNonce?: number;
  refreshTrigger?: number;
}

const GATHERING_FILTER = [
  { value: "", label: "All types" },
  { value: "PHYSICAL", label: "Physical" },
  { value: "ONLINE", label: "Online" },
  { value: "HYBRID", label: "Hybrid" },
];

/** Matches ScalableSelect trigger: fixed height and border/shadow */
const FILTERS_NATIVE_SELECT_CLASS =
  "h-11 w-full shrink-0 box-border rounded-md border border-gray-300 bg-white px-3 py-0 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

/** Matches cluster weekly toolbar: white pill, gray border, icon + label */
const REPORT_TOOLBAR_BTN_CLASS =
  "inline-flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";

/** Data columns configurable via Columns modal (Actions stays fixed) */
const REPORT_AVAILABLE_COLUMNS: {
  key: string;
  label: string;
  default: boolean;
}[] = [
  { key: "group", label: "Group", default: true },
  { key: "week", label: "Week", default: true },
  { key: "meeting_date", label: "Meeting date", default: true },
  { key: "gathering", label: "Gathering", default: true },
  { key: "members", label: "Members", default: true },
  { key: "visitors", label: "Visitors", default: true },
];

export default function EvangelismReportsDashboard({
  groups,
  clusters,
  branches,
  openSubmitNonce = 0,
  refreshTrigger = 0,
}: EvangelismReportsDashboardProps) {
  const [reports, setReports] = useState<EvangelismWeeklyReport[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedGroupForForm, setSelectedGroupForForm] =
    useState<EvangelismGroup | null>(null);
  const [editingReport, setEditingReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [formGroupDetail, setFormGroupDetail] =
    useState<EvangelismGroup | null>(null);
  const [groupPickerId, setGroupPickerId] = useState<string>("");
  const [formProspects, setFormProspects] = useState<Prospect[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewingReport, setViewingReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [pendingDeleteReport, setPendingDeleteReport] =
    useState<EvangelismWeeklyReport | null>(null);

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  /** Encoded like PeopleTallyReport: `cluster:id` or `group:id`, or "" for all */
  const [reportsScope, setReportsScope] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [selectedGatheringType, setSelectedGatheringType] =
    useState<string>("");

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
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const lastNonceRef = useRef(0);
  useEffect(() => {
    if (openSubmitNonce > lastNonceRef.current) {
      lastNonceRef.current = openSubmitNonce;
      setEditingReport(null);
      setSelectedGroupForForm(null);
      setShowReportModal(true);
    }
  }, [openSubmitNonce]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node) &&
        showExportDropdown
      ) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showExportDropdown]);

  const clustersScoped = useMemo(() => {
    if (!selectedBranch) return clusters;
    return clusters.filter((c) => String(c.branch) === selectedBranch);
  }, [clusters, selectedBranch]);

  const evangelismGroupsScoped = useMemo(() => {
    let g = groups;
    if (selectedBranch) {
      g = g.filter((eg) => {
        const cid = eg.cluster_id;
        if (!cid) return false;
        const cl = clusters.find((c) => String(c.id) === String(cid));
        return cl?.branch != null && String(cl.branch) === selectedBranch;
      });
    }
    return g;
  }, [groups, selectedBranch, clusters]);

  const scopeSelectOptions = useMemo(() => {
    const clusterOpts = clustersScoped.map((c) => ({
      value: `cluster:${c.id}`,
      label: (c.name || c.code || `Cluster ${c.id}`).trim(),
      typeLabel: "cluster" as const,
    }));
    const groupOpts = evangelismGroupsScoped.map((g) => ({
      value: `group:${g.id}`,
      label: g.name || `Group ${g.id}`,
      typeLabel: "group" as const,
    }));
    const combined = [...clusterOpts, ...groupOpts];
    combined.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    return combined;
  }, [clustersScoped, evangelismGroupsScoped]);

  const refetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const scope = parseTallyScope(reportsScope);
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: itemsPerPage,
        ordering: "-year,-week_number",
      };
      if (selectedBranch) params.branch = Number(selectedBranch);
      if (scope.cluster != null) params.cluster = scope.cluster;
      if (scope.evangelism_group != null)
        params.evangelism_group = scope.evangelism_group;
      params.year = selectedYear;
      if (selectedMonth) params.month = Number(selectedMonth);
      if (selectedGatheringType) params.gathering_type = selectedGatheringType;

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
  }, [
    currentPage,
    itemsPerPage,
    selectedBranch,
    reportsScope,
    selectedYear,
    selectedMonth,
    selectedGatheringType,
    refreshTrigger,
  ]);

  useEffect(() => {
    void refetchReports();
  }, [refetchReports]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedBranch,
    reportsScope,
    selectedYear,
    selectedMonth,
    selectedGatheringType,
  ]);

  useEffect(() => {
    if (!showReportModal) {
      setFormGroupDetail(null);
      setGroupPickerId("");
      setFormProspects([]);
      setFormError(null);
      return;
    }

    const creatingNeedsPickGroupOnly =
      !editingReport && !selectedGroupForForm?.id;
    if (creatingNeedsPickGroupOnly) return;

    const gid = selectedGroupForForm?.id;
    if (!gid) return;

    let cancelled = false;
    evangelismApi.getGroup(gid).then((res) => {
      if (!cancelled) setFormGroupDetail(res.data);
    });
    evangelismApi
      .listProspects({ evangelism_group: gid })
      .then((res) => {
        const raw = res.data;
        const arr = Array.isArray(raw)
          ? raw
          : (raw as { results?: Prospect[] }).results ?? [];
        if (!cancelled) setFormProspects(arr);
      })
      .catch(() => {
        if (!cancelled) setFormProspects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showReportModal, selectedGroupForForm?.id, editingReport?.id]);

  const closeReportModal = () => {
    setShowReportModal(false);
    setEditingReport(null);
    setSelectedGroupForForm(null);
    setFormGroupDetail(null);
    setFormError(null);
  };

  const handleContinueGroupPick = async () => {
    if (!groupPickerId) {
      setFormError("Please select an evangelism group.");
      return;
    }
    setFormError(null);
    try {
      const res = await evangelismApi.getGroup(groupPickerId);
      setSelectedGroupForForm(res.data);
    } catch {
      setFormError("Could not load group.");
    }
  };

  const handleSubmitForm = async (values: EvangelismWeeklyReportFormValues) => {
    if (!formGroupDetail) return;
    try {
      setFormSubmitting(true);
      setFormError(null);
      const payload = await buildEvangelismWeeklyReportPayloadFromFormValues(values);
      if (editingReport) {
        await evangelismApi.updateWeeklyReport(editingReport.id, payload);
      } else {
        await evangelismApi.createWeeklyReport(payload as never);
      }
      closeReportModal();
      await refetchReports();
    } catch (err: unknown) {
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

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sortedReports.map((r) => ({
        Group: r.evangelism_group?.name ?? "",
        Week: `${r.year} W${r.week_number}`,
        "Meeting Date": r.meeting_date
          ? new Date(r.meeting_date).toLocaleDateString()
          : "",
        "Gathering Type": r.gathering_type,
        Members: Array.isArray(r.members_attended)
          ? r.members_attended.length
          : 0,
        Visitors: Array.isArray(r.visitors_attended)
          ? r.visitors_attended.length
          : 0,
      }))
    );
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
      r.meeting_date ? new Date(r.meeting_date).toLocaleDateString() : "",
      r.gathering_type,
      String(Array.isArray(r.members_attended) ? r.members_attended.length : 0),
      String(Array.isArray(r.visitors_attended) ? r.visitors_attended.length : 0),
    ]);
    autoTable(doc, {
      head: [cols],
      body: rows,
      startY: 16,
      styles: { fontSize: 8 },
    });
    doc.save("evangelism_weekly_reports.pdf");
  };

  const handleExport = (fmt: "excel" | "pdf") => {
    setShowExportDropdown(false);
    if (fmt === "excel") exportToExcel();
    else exportToPDF();
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
    } catch (e) {
      console.error(e);
    }
  };

  const getGatheringTypeColor = (type?: string) => {
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

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const reportWindowStart =
    totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const reportWindowEnd =
    totalCount === 0
      ? 0
      : Math.min(currentPage * itemsPerPage, totalCount);

  const branchOptions = useMemo(
    () => [
      { value: "", label: "All branches" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches]
  );

  const groupPickerOptions = useMemo(
    () =>
      [
        { value: "", label: "Choose…" },
        ...evangelismGroupsScoped.map((g) => ({
          value: String(g.id),
          label: g.name,
        })),
      ],
    [evangelismGroupsScoped]
  );

  const monthOptions = [{ value: "", label: "All months" }].concat(
    Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      return {
        value: m,
        label: new Date(2000, i, 1).toLocaleDateString("en-US", {
          month: "long",
        }),
      };
    })
  );

  const yearNow = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, i) => ({
    value: String(yearNow - i),
    label: String(yearNow - i),
  }));

  const needsPick =
    showReportModal && !editingReport && !selectedGroupForForm?.id;

  const weeklyReportTableColumns = useMemo(() => {
    const cols: Parameters<typeof Table<EvangelismWeeklyReport>>[0]["columns"] =
      [];

    const v = visibleReportColumns;

    if (v.has("group")) {
      cols.push({
        header: "Group",
        accessor: "evangelism_group" as keyof EvangelismWeeklyReport,
        render: (_x, row) => (
          <span className="text-sm">{row.evangelism_group?.name ?? "—"}</span>
        ),
      });
    }
    if (v.has("week")) {
      cols.push({
        header: "Week",
        accessor: "year" as keyof EvangelismWeeklyReport,
        render: (_y, row) => (
          <span className="text-sm">
            {row.year} W{row.week_number}
          </span>
        ),
      });
    }
    if (v.has("meeting_date")) {
      cols.push({
        header: "Meeting date",
        accessor: "meeting_date" as keyof EvangelismWeeklyReport,
        desktopHeader: (
          <div className="flex items-center gap-1">
            <span>Meeting date</span>
            {sortDirection === "desc" ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUpIcon className="h-4 w-4 text-gray-500" />
            )}
          </div>
        ),
        onHeaderClick: handleSortToggle,
        render: (val) =>
          val ? (
            <span className="text-sm">
              {new Date(val as string).toLocaleDateString()}
            </span>
          ) : (
            <span>—</span>
          ),
      });
    }
    if (v.has("gathering")) {
      cols.push({
        header: "Gathering",
        accessor: "gathering_type" as keyof EvangelismWeeklyReport,
        render: (gval) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getGatheringTypeColor(
              gval as string,
            )}`}
          >
            {String(gval ?? "")}
          </span>
        ),
      });
    }
    if (v.has("members")) {
      cols.push({
        header: "Members",
        accessor: "members_attended" as keyof EvangelismWeeklyReport,
        render: (_m, row) =>
          Array.isArray(row.members_attended) ? row.members_attended.length : 0,
      });
    }
    if (v.has("visitors")) {
      cols.push({
        header: "Visitors",
        accessor: "visitors_attended" as keyof EvangelismWeeklyReport,
        render: (_m, row) => {
          const n = Array.isArray(row.visitors_attended)
            ? row.visitors_attended.length
            : 0;
          return (
            <span
              className={`text-sm ${n === 0 ? "text-red-600" : "text-gray-900"}`}
            >
              {n}
            </span>
          );
        },
      });
    }

    cols.push({
      header: "Actions",
      accessor: "id" as keyof EvangelismWeeklyReport,
      render: (_id, row) => (
        <div className="flex flex-wrap gap-1.5 sm:gap-1">
          <Button
            variant="secondary"
            type="button"
            className="!min-h-[44px] !py-2 !px-3 text-xs sm:!min-h-0 sm:!py-1 sm:!px-2"
            onClick={() => openView(row)}
          >
            View
          </Button>
          <Button
            variant="secondary"
            type="button"
            className="!min-h-[44px] !py-2 !px-3 text-xs !text-blue-700 sm:!min-h-0 sm:!py-1 sm:!px-2"
            onClick={() => {
              setSelectedGroupForForm(row.evangelism_group);
              setEditingReport(row);
              setShowReportModal(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            type="button"
            className="!min-h-[44px] !py-2 !px-3 text-xs !text-red-700 sm:!min-h-0 sm:!py-1 sm:!px-2"
            onClick={() => setPendingDeleteReport(row)}
          >
            Delete
          </Button>
        </div>
      ),
    });

    return cols;
  }, [
    visibleReportColumns,
    sortDirection,
    handleSortToggle,
    getGatheringTypeColor,
    openView,
  ]);

  const reportListToolbar = (
    <div className="flex w-full flex-wrap items-stretch justify-end gap-2 sm:items-center sm:justify-end">
      <button
        type="button"
        className={`${REPORT_TOOLBAR_BTN_CLASS} w-full sm:w-auto`}
        onClick={() => {
          setShowExportDropdown(false);
          setShowColumnsModal(true);
        }}
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
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
      <div ref={exportMenuRef} className="relative w-full sm:w-auto">
        <button
          type="button"
          className={`${REPORT_TOOLBAR_BTN_CLASS} w-full sm:w-auto`}
          onClick={() => setShowExportDropdown((x) => !x)}
        >
          <DocumentArrowDownIcon className="h-4 w-4 shrink-0" />
          Export
        </button>
        {showExportDropdown && (
          <div className="absolute right-0 z-20 mt-1 w-full min-w-[10rem] rounded-md border border-gray-200 bg-white shadow-lg py-1 sm:w-40">
            <button
              type="button"
              className="w-full px-3 py-3 text-left text-sm hover:bg-gray-50 sm:py-2"
              onClick={() => handleExport("excel")}
            >
              Excel
            </button>
            <button
              type="button"
              className="w-full px-3 py-3 text-left text-sm hover:bg-gray-50 sm:py-2"
              onClick={() => handleExport("pdf")}
            >
              PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid min-w-0 w-full grid-cols-1 gap-4 md:gap-3 md:[grid-template-columns:minmax(0,1.15fr)_minmax(0,2.1fr)_minmax(6.5rem,0.68fr)_minmax(10.5rem,0.92fr)_minmax(10.5rem,0.88fr)] lg:gap-4">
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Branch
            </label>
            <ScalableSelect
              value={selectedBranch}
              options={branchOptions}
              onChange={(v) => {
                setSelectedBranch(v);
                setReportsScope("");
              }}
              className="w-full min-w-0 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cluster or group
            </label>
            <ScalableSelect
              options={[
                { value: "", label: "All clusters and groups" },
                ...scopeSelectOptions,
              ]}
              value={reportsScope}
              onChange={setReportsScope}
              placeholder="Cluster or group..."
              searchPlaceholder="Search..."
              emptyMessage="No clusters or groups match"
              virtualizeThreshold={80}
              className="w-full min-w-0 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Year
            </label>
            <select
              className={FILTERS_NATIVE_SELECT_CLASS}
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Year (meeting date)"
            >
              {yearOptions.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Month
            </label>
            <select
              className={FILTERS_NATIVE_SELECT_CLASS}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Month (meeting date)"
            >
              {monthOptions.map((mo) => (
                <option key={mo.value || "all-months"} value={mo.value}>
                  {mo.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Gathering type
            </label>
            <select
              className={FILTERS_NATIVE_SELECT_CLASS}
              value={selectedGatheringType}
              onChange={(e) => setSelectedGatheringType(e.target.value)}
              aria-label="Gathering type"
            >
              {GATHERING_FILTER.map((g) => (
                <option key={g.value || "all-types"} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

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
      ) : (
        <Card
          title={`Weekly reports (${totalCount})`}
          headerAction={reportListToolbar}
          className="min-w-0"
        >
          <div className="-mx-4 min-w-0 rounded-lg border border-gray-200 shadow-sm md:-mx-6">
            <div className="overflow-x-auto">
              <Table
                data={sortedReports}
                columns={weeklyReportTableColumns}
              />
            </div>
            {totalCount > 0 && (
              <div className="border-t border-gray-200 bg-white px-4 md:px-6 py-3">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <div className="text-center text-sm text-gray-700 sm:text-left">
                    Showing{" "}
                    <span className="font-medium">{reportWindowStart}</span>{" "}
                    to{" "}
                    <span className="font-medium">{reportWindowEnd}</span>{" "}
                    of{" "}
                    <span className="font-medium">{totalCount}</span>{" "}
                    results
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-4 space-x-0">
                    <div className="flex items-center space-x-2">
                      <label
                        htmlFor="weekly-reports-items-per-page"
                        className="hidden text-sm text-gray-700 sm:inline"
                      >
                        Show:
                      </label>
                      <select
                        id="weekly-reports-items-per-page"
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:min-h-0"
                        aria-label="Items per page"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:min-w-0"
                        aria-label="Previous page"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                      <span className="flex min-h-[44px] items-center px-3 py-2 text-sm text-gray-700 md:min-h-0">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage(
                            Math.min(totalPages, currentPage + 1),
                          )
                        }
                        disabled={currentPage === totalPages || totalPages <= 1}
                        className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:min-w-0"
                        aria-label="Next page"
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={showReportModal}
        onClose={closeReportModal}
        title={
          editingReport ? "Edit weekly report" : "Submit weekly report"
        }
      >
        {needsPick ? (
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {formError}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700">
              Evangelism group
            </label>
            <ScalableSelect
              value={groupPickerId}
              options={groupPickerOptions}
              onChange={(v) => setGroupPickerId(v)}
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={closeReportModal}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleContinueGroupPick()}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : formGroupDetail ? (
          <EvangelismWeeklyReportForm
            group={formGroupDetail}
            prospects={formProspects}
            initialData={editingReport ?? undefined}
            onSubmit={handleSubmitForm}
            onCancel={closeReportModal}
            isSubmitting={formSubmitting}
            error={formError}
          />
        ) : (
          <div className="py-8 text-center text-gray-500">Loading…</div>
        )}
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
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
        onEdit={() => {
          if (!viewingReport) return;
          const rpt = viewingReport;
          const grp =
            viewingReport.evangelism_group as EvangelismGroup;
          setViewingReport(null);
          setSelectedGroupForForm(grp);
          setEditingReport(rpt);
          setShowReportModal(true);
        }}
        onDelete={() => {
          if (!viewingReport) return;
          setPendingDeleteReport(viewingReport);
          setViewingReport(null);
        }}
      />

      <ConfirmationModal
        isOpen={pendingDeleteReport !== null}
        title="Delete report"
        message="Delete this evangelism weekly report? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onClose={() => setPendingDeleteReport(null)}
        onConfirm={() => void confirmDelete()}
      />

    </div>
  );
}

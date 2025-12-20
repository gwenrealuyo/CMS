"use client";

import { useState, useEffect, Fragment } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import Modal from "@/src/components/ui/Modal";
import Pagination from "@/src/components/ui/Pagination";
import toast from "react-hot-toast";
import {
  CheckCircleIcon,
  LockOpenIcon,
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  TableCellsIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import {
  authApi,
  PasswordResetRequest,
  LockedAccount,
  AuditLog,
  branchesApi,
} from "@/src/lib/api";
import { Branch } from "@/src/types/branch";
import ModuleCoordinatorManager from "@/src/components/admin/ModuleCoordinatorManager";
import BranchForm from "@/src/components/admin/BranchForm";

type Tab =
  | "overview"
  | "password-resets"
  | "locked-accounts"
  | "audit-logs"
  | "module-coordinators"
  | "branches";

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminSettingsPageContent />
    </ProtectedRoute>
  );
}

function AdminSettingsPageContent() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [dashboardStats, setDashboardStats] = useState<{
    pending_password_resets: number;
    locked_accounts: number;
    recent_activity: AuditLog[];
  } | null>(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState<
    PasswordResetRequest[]
  >([]);
  const [resetRequestsPage, setResetRequestsPage] = useState(1);
  const [resetRequestsTotal, setResetRequestsTotal] = useState(0);
  const [resetRequestsItemsPerPage, setResetRequestsItemsPerPage] =
    useState(10);
  const [resetRequestsSearch, setResetRequestsSearch] = useState("");
  const [resetRequestsSearchDebounced, setResetRequestsSearchDebounced] =
    useState("");
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [lockedAccountsPage, setLockedAccountsPage] = useState(1);
  const [lockedAccountsTotal, setLockedAccountsTotal] = useState(0);
  const [lockedAccountsItemsPerPage, setLockedAccountsItemsPerPage] =
    useState(10);
  const [lockedAccountsSearch, setLockedAccountsSearch] = useState("");
  const [lockedAccountsSearchDebounced, setLockedAccountsSearchDebounced] =
    useState("");
  const [lockedAccountsFilter, setLockedAccountsFilter] = useState("");
  const [lockedAccountsSort, setLockedAccountsSort] = useState<{
    field: string;
    order: "asc" | "desc";
  }>({ field: "last_attempt", order: "desc" });
  const [expandedLockedAccount, setExpandedLockedAccount] = useState<
    number | null
  >(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilters, setAuditFilters] = useState({
    action: "",
    start_date: "",
    end_date: "",
    user_search: "",
    ip_address: "",
  });
  const [expandedAuditLog, setExpandedAuditLog] = useState<number | null>(null);
  const [approveConfirmation, setApproveConfirmation] = useState<{
    isOpen: boolean;
    request: PasswordResetRequest | null;
    loading: boolean;
  }>({
    isOpen: false,
    request: null,
    loading: false,
  });

  // Branch management state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showBranchView, setShowBranchView] = useState(false);
  const [branchDeleteConfirmation, setBranchDeleteConfirmation] = useState<{
    isOpen: boolean;
    branch: Branch | null;
    loading: boolean;
  }>({
    isOpen: false,
    branch: null,
    loading: false,
  });
  const [branchSearch, setBranchSearch] = useState("");
  const [branchSearchDebounced, setBranchSearchDebounced] = useState("");
  const [branchFilter, setBranchFilter] = useState<{
    is_active: string; // "ALL" | "ACTIVE" | "INACTIVE"
    is_headquarters: string; // "ALL" | "HQ" | "NON_HQ"
  }>({
    is_active: "ALL",
    is_headquarters: "ALL",
  });
  const [branchSort, setBranchSort] = useState<{
    field: "name" | "code" | "created_at";
    order: "asc" | "desc";
  }>({ field: "name", order: "asc" });
  const [unlockConfirmation, setUnlockConfirmation] = useState<{
    isOpen: boolean;
    account: LockedAccount | null;
    loading: boolean;
  }>({
    isOpen: false,
    account: null,
    loading: false,
  });
  const [rejectConfirmation, setRejectConfirmation] = useState<{
    isOpen: boolean;
    request: PasswordResetRequest | null;
    loading: boolean;
    notes: string;
  }>({
    isOpen: false,
    request: null,
    loading: false,
    notes: "",
  });

  // View mode states for tables - Initialize based on screen size
  const [overviewViewMode, setOverviewViewMode] = useState<"table" | "cards">(
    () => {
      if (typeof window !== "undefined") {
        return window.innerWidth < 768 ? "cards" : "table";
      }
      return "table";
    }
  );
  const [passwordResetsViewMode, setPasswordResetsViewMode] = useState<
    "table" | "cards"
  >(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });
  const [lockedAccountsViewMode, setLockedAccountsViewMode] = useState<
    "table" | "cards"
  >(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "table";
  });
  const [auditLogsViewMode, setAuditLogsViewMode] = useState<"table" | "cards">(
    () => {
      if (typeof window !== "undefined") {
        return window.innerWidth < 768 ? "cards" : "table";
      }
      return "table";
    }
  );

  // Debounce search input for password reset requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setResetRequestsSearchDebounced(resetRequestsSearch);
      setResetRequestsPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [resetRequestsSearch]);

  // Debounce search input for locked accounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setLockedAccountsSearchDebounced(lockedAccountsSearch);
      setLockedAccountsPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [lockedAccountsSearch]);

  // Debounce search input for branches
  useEffect(() => {
    const timer = setTimeout(() => {
      setBranchSearchDebounced(branchSearch);
    }, 500);

    return () => clearTimeout(timer);
  }, [branchSearch]);

  useEffect(() => {
    fetchData();
  }, [
    activeTab,
    statusFilter,
    auditPage,
    auditFilters,
    resetRequestsPage,
    resetRequestsItemsPerPage,
    resetRequestsSearchDebounced,
    lockedAccountsPage,
    lockedAccountsItemsPerPage,
    lockedAccountsSearchDebounced,
    lockedAccountsFilter,
    lockedAccountsSort,
    branchSearchDebounced,
    branchFilter,
    branchSort,
  ]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "overview") {
        const response = await authApi.getAdminDashboardStats();
        setDashboardStats(response.data);
      } else if (activeTab === "password-resets") {
        const status = statusFilter === "ALL" ? undefined : statusFilter;
        const response = await authApi.getPasswordResetRequests(
          status,
          resetRequestsPage,
          resetRequestsItemsPerPage,
          resetRequestsSearchDebounced || undefined
        );
        setPasswordResetRequests(response.data.results);
        setResetRequestsTotal(response.data.count);
      } else if (activeTab === "locked-accounts") {
        const response = await authApi.getLockedAccounts(
          lockedAccountsPage,
          lockedAccountsItemsPerPage,
          lockedAccountsSearchDebounced || undefined,
          lockedAccountsFilter || undefined,
          lockedAccountsSort.field,
          lockedAccountsSort.order
        );
        setLockedAccounts(response.data.results);
        setLockedAccountsTotal(response.data.count);
      } else if (activeTab === "audit-logs") {
        const response = await authApi.getAuditLogs({
          ...auditFilters,
          page: auditPage,
          page_size: 50,
        });
        setAuditLogs(response.data.results);
        setAuditTotal(response.data.count);
      } else if (activeTab === "branches") {
        setBranchesLoading(true);
        try {
          const params: {
            is_headquarters?: boolean;
            is_active?: boolean;
            search?: string;
          } = {};

          if (branchSearchDebounced) {
            params.search = branchSearchDebounced;
          }
          if (branchFilter.is_active !== "ALL") {
            params.is_active = branchFilter.is_active === "ACTIVE";
          }
          if (branchFilter.is_headquarters !== "ALL") {
            params.is_headquarters = branchFilter.is_headquarters === "HQ";
          }

          const response = await branchesApi.getAll(params);
          let filteredBranches = response.data;

          // Client-side sorting
          filteredBranches = [...filteredBranches].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (branchSort.field) {
              case "name":
                aValue = a.name?.toLowerCase() || "";
                bValue = b.name?.toLowerCase() || "";
                break;
              case "code":
                aValue = a.code?.toLowerCase() || "";
                bValue = b.code?.toLowerCase() || "";
                break;
              case "created_at":
                aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
                bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
                break;
              default:
                return 0;
            }

            if (aValue < bValue) return branchSort.order === "asc" ? -1 : 1;
            if (aValue > bValue) return branchSort.order === "asc" ? 1 : -1;
            return 0;
          });

          setBranches(filteredBranches);
        } catch (err) {
          console.error("Failed to fetch branches:", err);
          setError("Failed to load branches");
        } finally {
          setBranchesLoading(false);
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to load data."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReset = (request: PasswordResetRequest) => {
    setApproveConfirmation({
      isOpen: true,
      request,
      loading: false,
    });
  };

  const confirmApproveReset = async () => {
    if (!approveConfirmation.request) return;

    setApproveConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await authApi.approvePasswordReset(approveConfirmation.request.id);
      setApproveConfirmation({
        isOpen: false,
        request: null,
        loading: false,
      });
      toast.success("Password reset request approved successfully.");
      await fetchData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to approve request."
      );
      setApproveConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRejectReset = (request: PasswordResetRequest) => {
    setRejectConfirmation({
      isOpen: true,
      request,
      loading: false,
      notes: "",
    });
  };

  const confirmRejectReset = async () => {
    if (!rejectConfirmation.request) return;
    if (!rejectConfirmation.notes.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    setRejectConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await authApi.rejectPasswordReset(
        rejectConfirmation.request.id,
        rejectConfirmation.notes
      );
      setRejectConfirmation({
        isOpen: false,
        request: null,
        loading: false,
        notes: "",
      });
      toast.success("Password reset request rejected successfully.");
      await fetchData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to reject request."
      );
      setRejectConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleUnlockAccount = (account: LockedAccount) => {
    setUnlockConfirmation({
      isOpen: true,
      account,
      loading: false,
    });
  };

  const confirmUnlockAccount = async () => {
    if (!unlockConfirmation.account) return;

    setUnlockConfirmation((prev) => ({ ...prev, loading: true }));
    try {
      await authApi.unlockAccount(unlockConfirmation.account.user_id);
      setUnlockConfirmation({
        isOpen: false,
        account: null,
        loading: false,
      });
      toast.success("Account unlocked successfully.");
      await fetchData();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to unlock account."
      );
      setUnlockConfirmation((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      LOGIN_SUCCESS: "bg-green-100 text-green-800 border-green-200",
      LOGIN_FAILURE: "bg-red-100 text-red-800 border-red-200",
      LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
      PASSWORD_CHANGE: "bg-blue-100 text-blue-800 border-blue-200",
      PASSWORD_RESET_REQUEST: "bg-yellow-100 text-yellow-800 border-yellow-200",
      PASSWORD_RESET_APPROVED: "bg-green-100 text-green-800 border-green-200",
      PASSWORD_RESET_REJECTED: "bg-red-100 text-red-800 border-red-200",
      ACCOUNT_LOCKED: "bg-red-100 text-red-800 border-red-200",
      ACCOUNT_UNLOCKED: "bg-blue-100 text-blue-800 border-blue-200",
      TOKEN_REFRESH: "bg-purple-100 text-purple-800 border-purple-200",
      ROLE_CHANGE: "bg-indigo-100 text-indigo-800 border-indigo-200",
      ACCOUNT_ACTIVATED: "bg-green-100 text-green-800 border-green-200",
      ACCOUNT_DEACTIVATED: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[action] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3748]">Admin Settings</h1>
          <p className="text-gray-500">
            Manage password reset requests, locked accounts, and view audit logs
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "overview"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("password-resets")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "password-resets"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Password Reset Requests
            </button>
            <button
              onClick={() => setActiveTab("locked-accounts")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "locked-accounts"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Locked Accounts
            </button>
            <button
              onClick={() => setActiveTab("audit-logs")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "audit-logs"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab("module-coordinators")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "module-coordinators"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Module Coordinators
            </button>
            <button
              onClick={() => setActiveTab("branches")}
              className={`py-4 px-1 border-b-2 font-medium text-sm min-h-[44px] ${
                activeTab === "branches"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Branches
            </button>
          </nav>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[#2D3748]">
                  Dashboard Overview
                </h2>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Pending Password Resets
                        </p>
                        <p className="text-3xl font-bold text-[#2D3748] mt-2">
                          {dashboardStats?.pending_password_resets ?? 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-6 h-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Locked Accounts
                        </p>
                        <p className="text-3xl font-bold text-[#2D3748] mt-2">
                          {dashboardStats?.locked_accounts ?? 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <LockOpenIcon className="w-6 h-6 text-red-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-md">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#2D3748]">
                      Recent Activity
                    </h3>
                    {/* View Toggle - Mobile Only */}
                    <div className="md:hidden flex items-center">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setOverviewViewMode("cards")}
                          className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                            overviewViewMode === "cards"
                              ? "bg-blue-500 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                          title="Card View"
                        >
                          <Squares2X2Icon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setOverviewViewMode("table")}
                          className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                            overviewViewMode === "table"
                              ? "bg-blue-500 text-white"
                              : "bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                          title="Table View"
                        >
                          <TableCellsIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card View - Mobile Only */}
                  {overviewViewMode === "cards" && (
                    <div className="md:hidden p-4 space-y-3">
                      {dashboardStats?.recent_activity &&
                      dashboardStats.recent_activity.length > 0 ? (
                        dashboardStats.recent_activity.map((log) => (
                          <div
                            key={log.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                          >
                            <div className="space-y-3">
                              {/* First Row - Action Badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  Action
                                </span>
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getActionBadgeColor(
                                    log.action
                                  )}`}
                                >
                                  {log.action.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Timestamp
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {formatDate(log.timestamp)}
                                  </p>
                                </div>
                                <div className="flex items-start justify-between">
                                  <span className="text-xs text-gray-500">
                                    User
                                  </span>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 break-words">
                                      {log.username || "Unknown"}
                                    </p>
                                    {log.full_name && (
                                      <p className="text-xs text-gray-500 break-words">
                                        {log.full_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    IP Address
                                  </span>
                                  <p className="text-sm text-gray-900 text-right break-words">
                                    {log.ip_address}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          No recent activity found.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Table View */}
                  <div
                    className={`overflow-x-auto ${
                      overviewViewMode === "cards" ? "hidden md:block" : ""
                    }`}
                  >
                    {dashboardStats?.recent_activity &&
                    dashboardStats.recent_activity.length > 0 ? (
                      <table className="w-full min-w-[700px] divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Timestamp
                            </th>
                            <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                            <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              IP Address
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dashboardStats.recent_activity.map((log) => (
                            <tr key={log.id}>
                              <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                {formatDate(log.timestamp)}
                              </td>
                              <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-900">
                                <div className="min-w-0">
                                  <div className="break-words">
                                    {log.username || "Unknown"}
                                  </div>
                                  {log.full_name && (
                                    <div className="text-xs text-gray-500 break-words">
                                      {log.full_name}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-4 md:px-6 md:py-4">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getActionBadgeColor(
                                    log.action
                                  )}`}
                                >
                                  {log.action.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500 break-words">
                                {log.ip_address}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        No recent activity found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Password Reset Requests Tab */}
            {activeTab === "password-resets" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-[#2D3748]">
                    Password Reset Requests
                  </h2>
                  {/* View Toggle - Mobile Only */}
                  <div className="md:hidden flex items-center">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setPasswordResetsViewMode("cards")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          passwordResetsViewMode === "cards"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Card View"
                      >
                        <Squares2X2Icon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setPasswordResetsViewMode("table")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          passwordResetsViewMode === "table"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Table View"
                      >
                        <TableCellsIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Search
                      </label>
                      <input
                        type="text"
                        value={resetRequestsSearch}
                        onChange={(e) => {
                          setResetRequestsSearch(e.target.value);
                        }}
                        placeholder="Search by name, email, or username..."
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value);
                          setResetRequestsPage(1);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setResetRequestsSearch("");
                          setStatusFilter("ALL");
                          setResetRequestsPage(1);
                        }}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                {passwordResetRequests.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-500">
                      No password reset requests found.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Card View - Mobile Only */}
                    {passwordResetsViewMode === "cards" && (
                      <div className="md:hidden space-y-3">
                        {passwordResetRequests.map((request) => (
                          <div
                            key={request.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                          >
                            <div className="space-y-3">
                              {/* First Row - Status Badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  Status
                                </span>
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    request.status === "APPROVED"
                                      ? "bg-green-100 text-green-800"
                                      : request.status === "PENDING"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {request.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start justify-between">
                                  <span className="text-xs text-gray-500">
                                    User
                                  </span>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 break-words">
                                      {request.full_name}
                                    </p>
                                    <p className="text-xs text-gray-500 break-words">
                                      {request.username}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Requested At
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {formatDate(request.requested_at)}
                                  </p>
                                </div>
                                {request.notes && (
                                  <div className="flex items-start justify-between">
                                    <span className="text-xs text-gray-500">
                                      Notes
                                    </span>
                                    <p className="text-sm text-gray-900 text-right break-words max-w-[60%]">
                                      {request.notes}
                                    </p>
                                  </div>
                                )}
                                {request.status === "PENDING" && (
                                  <div className="pt-2 border-t border-gray-200">
                                    <span className="text-xs text-gray-500 block mb-2">
                                      Actions
                                    </span>
                                    <div className="flex flex-col gap-2">
                                      <button
                                        onClick={() =>
                                          handleApproveReset(request)
                                        }
                                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-green-500 text-green-600 rounded-md hover:bg-green-50 transition-colors"
                                      >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRejectReset(request)
                                        }
                                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                      >
                                        <XCircleIcon className="w-4 h-4" />
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Table View */}
                    <div
                      className={`bg-white rounded-lg shadow-md overflow-hidden ${
                        passwordResetsViewMode === "cards"
                          ? "hidden md:block"
                          : ""
                      }`}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Requested At
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Notes
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {passwordResetRequests.map((request) => (
                              <tr key={request.id}>
                                <td className="px-3 py-4 md:px-6 md:py-4">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 break-words">
                                      {request.full_name}
                                    </div>
                                    <div className="text-sm text-gray-500 break-words">
                                      {request.username}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                  {formatDate(request.requested_at)}
                                </td>
                                <td className="px-3 py-4 md:px-6 md:py-4">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      request.status === "APPROVED"
                                        ? "bg-green-100 text-green-800"
                                        : request.status === "PENDING"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {request.status}
                                  </span>
                                </td>
                                <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500 break-words">
                                  {request.notes || "-"}
                                </td>
                                <td className="px-3 py-4 md:px-6 md:py-4 text-sm font-medium">
                                  {request.status === "PENDING" && (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <button
                                        onClick={() =>
                                          handleApproveReset(request)
                                        }
                                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-green-500 text-green-600 rounded-md hover:bg-green-50 transition-colors"
                                      >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRejectReset(request)
                                        }
                                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-red-500 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                      >
                                        <XCircleIcon className="w-4 h-4" />
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* Pagination */}
                {resetRequestsTotal > 0 && (
                  <Pagination
                    currentPage={resetRequestsPage}
                    totalPages={Math.ceil(
                      resetRequestsTotal / resetRequestsItemsPerPage
                    )}
                    onPageChange={(page) => {
                      setResetRequestsPage(page);
                    }}
                    itemsPerPage={resetRequestsItemsPerPage}
                    totalItems={resetRequestsTotal}
                    onItemsPerPageChange={(newItemsPerPage) => {
                      setResetRequestsItemsPerPage(newItemsPerPage);
                      setResetRequestsPage(1);
                    }}
                    showItemsPerPage={true}
                  />
                )}
              </div>
            )}

            {/* Locked Accounts Tab */}
            {activeTab === "locked-accounts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-[#2D3748]">
                    Locked Accounts
                  </h2>
                  {/* View Toggle - Mobile Only */}
                  <div className="md:hidden flex items-center">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setLockedAccountsViewMode("cards")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          lockedAccountsViewMode === "cards"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Card View"
                      >
                        <Squares2X2Icon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setLockedAccountsViewMode("table")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          lockedAccountsViewMode === "table"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Table View"
                      >
                        <TableCellsIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Search
                      </label>
                      <input
                        type="text"
                        value={lockedAccountsSearch}
                        onChange={(e) => {
                          setLockedAccountsSearch(e.target.value);
                        }}
                        placeholder="Search by name, email, or username..."
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lockout Type
                      </label>
                      <select
                        value={lockedAccountsFilter}
                        onChange={(e) => {
                          setLockedAccountsFilter(e.target.value);
                          setLockedAccountsPage(1);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="">All Lockouts</option>
                        <option value="temporary">Temporary</option>
                        <option value="permanent">Permanent</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setLockedAccountsSearch("");
                          setLockedAccountsFilter("");
                          setLockedAccountsSort({
                            field: "last_attempt",
                            order: "desc",
                          });
                          setLockedAccountsPage(1);
                        }}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                {lockedAccounts.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-500">No locked accounts found.</p>
                  </div>
                ) : (
                  <>
                    {/* Card View - Mobile Only */}
                    {lockedAccountsViewMode === "cards" && (
                      <div className="md:hidden space-y-3">
                        {lockedAccounts.map((account) => (
                          <div
                            key={account.user_id}
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                          >
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start justify-between">
                                  <span className="text-xs text-gray-500">
                                    User
                                  </span>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 break-words">
                                      {account.full_name}
                                    </p>
                                    <p className="text-xs text-gray-500 break-words">
                                      {account.username}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Failed Attempts
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {account.failed_attempts}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Locked Until
                                  </span>
                                  <p className="text-sm text-gray-900 text-right break-words max-w-[60%]">
                                    {account.locked_until
                                      ? formatDate(account.locked_until)
                                      : "Permanent (Admin unlock required)"}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Lockout Count
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {account.lockout_count}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Last Attempt
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {formatDate(account.last_attempt)}
                                  </p>
                                </div>
                                {expandedLockedAccount === account.user_id && (
                                  <div className="pt-2 border-t border-gray-200 space-y-2">
                                    <h4 className="text-sm font-semibold text-gray-900">
                                      Lockout Details
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2 text-sm">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">
                                          Lockout Type:
                                        </span>
                                        <span className="text-right">
                                          {account.locked_until
                                            ? "Temporary"
                                            : "Permanent"}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">
                                          Failed Attempts:
                                        </span>
                                        <span className="text-right">
                                          {account.failed_attempts}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">
                                          Lockout Count:
                                        </span>
                                        <span className="text-right">
                                          {account.lockout_count}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">
                                          Last Attempt:
                                        </span>
                                        <span className="text-right">
                                          {formatDate(
                                            account.locked_until ||
                                              account.last_attempt
                                          )}
                                        </span>
                                      </div>
                                      {account.locked_until && (
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-gray-700">
                                            Auto-unlocks at:
                                          </span>
                                          <span className="text-right">
                                            {formatDate(account.locked_until)}
                                          </span>
                                        </div>
                                      )}
                                      {!account.locked_until && (
                                        <div className="text-amber-600 text-sm">
                                          This account requires admin unlock. It
                                          has been locked{" "}
                                          {account.lockout_count} time(s).
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="pt-2 border-t border-gray-200 flex flex-col gap-2">
                                <button
                                  onClick={() =>
                                    setExpandedLockedAccount(
                                      expandedLockedAccount === account.user_id
                                        ? null
                                        : account.user_id
                                    )
                                  }
                                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                  <ChevronRightIcon
                                    className={`w-4 h-4 transition-transform ${
                                      expandedLockedAccount === account.user_id
                                        ? "rotate-90"
                                        : ""
                                    }`}
                                  />
                                  {expandedLockedAccount === account.user_id
                                    ? "Hide Details"
                                    : "Show Details"}
                                </button>
                                <button
                                  onClick={() => handleUnlockAccount(account)}
                                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                                >
                                  <LockOpenIcon className="w-4 h-4" />
                                  Unlock
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Table View */}
                    <div
                      className={`bg-white rounded-lg shadow-md overflow-hidden ${
                        lockedAccountsViewMode === "cards"
                          ? "hidden md:block"
                          : ""
                      }`}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                  const newOrder =
                                    lockedAccountsSort.field === "user" &&
                                    lockedAccountsSort.order === "asc"
                                      ? "desc"
                                      : "asc";
                                  setLockedAccountsSort({
                                    field: "user",
                                    order: newOrder,
                                  });
                                  setLockedAccountsPage(1);
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  User
                                  {lockedAccountsSort.field === "user" &&
                                    (lockedAccountsSort.order === "asc" ? (
                                      <ChevronUpIcon className="w-4 h-4" />
                                    ) : (
                                      <ChevronDownIcon className="w-4 h-4" />
                                    ))}
                                </div>
                              </th>
                              <th
                                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-32"
                                onClick={() => {
                                  const newOrder =
                                    lockedAccountsSort.field ===
                                      "failed_attempts" &&
                                    lockedAccountsSort.order === "asc"
                                      ? "desc"
                                      : "asc";
                                  setLockedAccountsSort({
                                    field: "failed_attempts",
                                    order: newOrder,
                                  });
                                  setLockedAccountsPage(1);
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  Failed Attempts
                                  {lockedAccountsSort.field ===
                                    "failed_attempts" &&
                                    (lockedAccountsSort.order === "asc" ? (
                                      <ChevronUpIcon className="w-4 h-4" />
                                    ) : (
                                      <ChevronDownIcon className="w-4 h-4" />
                                    ))}
                                </div>
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Locked Until
                              </th>
                              <th
                                className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                  const newOrder =
                                    lockedAccountsSort.field ===
                                      "lockout_count" &&
                                    lockedAccountsSort.order === "asc"
                                      ? "desc"
                                      : "asc";
                                  setLockedAccountsSort({
                                    field: "lockout_count",
                                    order: newOrder,
                                  });
                                  setLockedAccountsPage(1);
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  Lockout Count
                                  {lockedAccountsSort.field ===
                                    "lockout_count" &&
                                    (lockedAccountsSort.order === "asc" ? (
                                      <ChevronUpIcon className="w-4 h-4" />
                                    ) : (
                                      <ChevronDownIcon className="w-4 h-4" />
                                    ))}
                                </div>
                              </th>
                              <th
                                className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                  const newOrder =
                                    lockedAccountsSort.field ===
                                      "last_attempt" &&
                                    lockedAccountsSort.order === "asc"
                                      ? "desc"
                                      : "asc";
                                  setLockedAccountsSort({
                                    field: "last_attempt",
                                    order: newOrder,
                                  });
                                  setLockedAccountsPage(1);
                                }}
                              >
                                <div className="flex items-center gap-1">
                                  Last Attempt
                                  {lockedAccountsSort.field ===
                                    "last_attempt" &&
                                    (lockedAccountsSort.order === "asc" ? (
                                      <ChevronUpIcon className="w-4 h-4" />
                                    ) : (
                                      <ChevronDownIcon className="w-4 h-4" />
                                    ))}
                                </div>
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {lockedAccounts.map((account) => (
                              <Fragment key={account.user_id}>
                                <tr>
                                  <td className="px-3 py-4 md:px-6 md:py-4">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-gray-900 break-words">
                                        {account.full_name}
                                      </div>
                                      <div className="text-sm text-gray-500 break-words">
                                        {account.username}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-4 text-sm text-gray-500">
                                    {account.failed_attempts}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500 break-words">
                                    {account.locked_until
                                      ? formatDate(account.locked_until)
                                      : "Permanent (Admin unlock required)"}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                    {account.lockout_count}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                    {formatDate(account.last_attempt)}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() =>
                                          setExpandedLockedAccount(
                                            expandedLockedAccount ===
                                              account.user_id
                                              ? null
                                              : account.user_id
                                          )
                                        }
                                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                        title="View details"
                                      >
                                        <ChevronRightIcon
                                          className={`w-4 h-4 transition-transform ${
                                            expandedLockedAccount ===
                                            account.user_id
                                              ? "rotate-90"
                                              : ""
                                          }`}
                                        />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleUnlockAccount(account)
                                        }
                                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                                      >
                                        <LockOpenIcon className="w-4 h-4" />
                                        Unlock
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedLockedAccount === account.user_id && (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="px-3 py-4 md:px-6 md:py-4 bg-gray-50"
                                    >
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-gray-900">
                                          Lockout Details
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              Lockout Type:
                                            </span>{" "}
                                            {account.locked_until
                                              ? "Temporary"
                                              : "Permanent"}
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              Failed Attempts:
                                            </span>{" "}
                                            {account.failed_attempts}
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              Lockout Count:
                                            </span>{" "}
                                            {account.lockout_count}
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">
                                              Last Attempt:
                                            </span>{" "}
                                            {formatDate(
                                              account.locked_until ||
                                                account.last_attempt
                                            )}
                                          </div>
                                          {account.locked_until && (
                                            <div className="sm:col-span-2">
                                              <span className="font-medium text-gray-700">
                                                Auto-unlocks at:
                                              </span>{" "}
                                              {formatDate(account.locked_until)}
                                            </div>
                                          )}
                                          {!account.locked_until && (
                                            <div className="sm:col-span-2 text-amber-600">
                                              This account requires admin
                                              unlock. It has been locked{" "}
                                              {account.lockout_count} time(s).
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {lockedAccountsTotal > 0 && (
                      <Pagination
                        currentPage={lockedAccountsPage}
                        totalPages={Math.ceil(
                          lockedAccountsTotal / lockedAccountsItemsPerPage
                        )}
                        onPageChange={(page) => {
                          setLockedAccountsPage(page);
                        }}
                        itemsPerPage={lockedAccountsItemsPerPage}
                        totalItems={lockedAccountsTotal}
                        onItemsPerPageChange={(newItemsPerPage) => {
                          setLockedAccountsItemsPerPage(newItemsPerPage);
                          setLockedAccountsPage(1);
                        }}
                        showItemsPerPage={true}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === "audit-logs" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-[#2D3748]">
                    Audit Logs
                  </h2>
                  {/* View Toggle - Mobile Only */}
                  <div className="md:hidden flex items-center">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setAuditLogsViewMode("cards")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          auditLogsViewMode === "cards"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Card View"
                      >
                        <Squares2X2Icon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setAuditLogsViewMode("table")}
                        className={`px-3 py-2 min-h-[44px] flex items-center justify-center transition-colors ${
                          auditLogsViewMode === "table"
                            ? "bg-blue-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        title="Table View"
                      >
                        <TableCellsIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User Search
                      </label>
                      <input
                        type="text"
                        value={auditFilters.user_search}
                        onChange={(e) =>
                          setAuditFilters({
                            ...auditFilters,
                            user_search: e.target.value,
                          })
                        }
                        placeholder="Search by username or name..."
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IP Address
                      </label>
                      <input
                        type="text"
                        value={auditFilters.ip_address}
                        onChange={(e) =>
                          setAuditFilters({
                            ...auditFilters,
                            ip_address: e.target.value,
                          })
                        }
                        placeholder="Filter by IP address..."
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date Range Presets
                      </label>
                      <select
                        onChange={(e) => {
                          const preset = e.target.value;
                          const today = new Date();
                          const startOfDay = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            today.getDate()
                          );
                          let startDate = "";
                          let endDate = "";

                          if (preset === "today") {
                            startDate = startOfDay.toISOString().split("T")[0];
                            endDate = startDate;
                          } else if (preset === "this_week") {
                            const dayOfWeek = today.getDay();
                            const diff = today.getDate() - dayOfWeek;
                            const start = new Date(today.setDate(diff));
                            startDate = start.toISOString().split("T")[0];
                            endDate = new Date().toISOString().split("T")[0];
                          } else if (preset === "this_month") {
                            startDate = new Date(
                              today.getFullYear(),
                              today.getMonth(),
                              1
                            )
                              .toISOString()
                              .split("T")[0];
                            endDate = new Date().toISOString().split("T")[0];
                          } else if (preset === "last_30_days") {
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            startDate = thirtyDaysAgo
                              .toISOString()
                              .split("T")[0];
                            endDate = new Date().toISOString().split("T")[0];
                          }

                          if (preset) {
                            setAuditFilters({
                              ...auditFilters,
                              start_date: startDate,
                              end_date: endDate,
                            });
                            setAuditPage(1);
                          }
                          e.target.value = "";
                        }}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="">Select preset...</option>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_30_days">Last 30 Days</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Action
                      </label>
                      <select
                        value={auditFilters.action}
                        onChange={(e) =>
                          setAuditFilters({
                            ...auditFilters,
                            action: e.target.value,
                          })
                        }
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="">All Actions</option>
                        <option value="LOGIN_SUCCESS">Login Success</option>
                        <option value="LOGIN_FAILURE">Login Failure</option>
                        <option value="LOGOUT">Logout</option>
                        <option value="PASSWORD_CHANGE">Password Change</option>
                        <option value="PASSWORD_RESET_REQUEST">
                          Password Reset Request
                        </option>
                        <option value="PASSWORD_RESET_APPROVED">
                          Password Reset Approved
                        </option>
                        <option value="PASSWORD_RESET_REJECTED">
                          Password Reset Rejected
                        </option>
                        <option value="ACCOUNT_LOCKED">Account Locked</option>
                        <option value="ACCOUNT_UNLOCKED">
                          Account Unlocked
                        </option>
                        <option value="TOKEN_REFRESH">Token Refresh</option>
                        <option value="ROLE_CHANGE">Role Change</option>
                        <option value="ACCOUNT_ACTIVATED">
                          Account Activated
                        </option>
                        <option value="ACCOUNT_DEACTIVATED">
                          Account Deactivated
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={auditFilters.start_date}
                        onChange={(e) =>
                          setAuditFilters({
                            ...auditFilters,
                            start_date: e.target.value,
                          })
                        }
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={auditFilters.end_date}
                        onChange={(e) =>
                          setAuditFilters({
                            ...auditFilters,
                            end_date: e.target.value,
                          })
                        }
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="tertiary"
                        onClick={() => {
                          setAuditFilters({
                            action: "",
                            start_date: "",
                            end_date: "",
                            user_search: "",
                            ip_address: "",
                          });
                          setAuditPage(1);
                        }}
                        className="w-full sm:w-auto min-h-[44px]"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-500">No audit logs found.</p>
                  </div>
                ) : (
                  <>
                    {/* Card View - Mobile Only */}
                    {auditLogsViewMode === "cards" && (
                      <div className="md:hidden space-y-3">
                        {auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                          >
                            <div className="space-y-3">
                              {/* First Row - Action Badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  Action
                                </span>
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getActionBadgeColor(
                                    log.action
                                  )}`}
                                >
                                  {log.action.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Timestamp
                                  </span>
                                  <p className="text-sm text-gray-900 text-right">
                                    {formatDate(log.timestamp)}
                                  </p>
                                </div>
                                <div className="flex items-start justify-between">
                                  <span className="text-xs text-gray-500">
                                    User
                                  </span>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 break-words">
                                      {log.username || "Unknown"}
                                    </p>
                                    {log.full_name && (
                                      <p className="text-xs text-gray-500 break-words">
                                        {log.full_name}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    IP Address
                                  </span>
                                  <p className="text-sm text-gray-900 text-right break-words">
                                    {log.ip_address}
                                  </p>
                                </div>
                                {expandedAuditLog === log.id &&
                                  log.details &&
                                  Object.keys(log.details).length > 0 && (
                                    <div className="pt-2 border-t border-gray-200">
                                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                                        Details
                                      </h4>
                                      <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                              </div>
                              {log.details &&
                              Object.keys(log.details).length > 0 ? (
                                <div className="pt-2 border-t border-gray-200">
                                  <button
                                    onClick={() =>
                                      setExpandedAuditLog(
                                        expandedAuditLog === log.id
                                          ? null
                                          : log.id
                                      )
                                    }
                                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                  >
                                    <ChevronRightIcon
                                      className={`w-4 h-4 transition-transform ${
                                        expandedAuditLog === log.id
                                          ? "rotate-90"
                                          : ""
                                      }`}
                                    />
                                    {expandedAuditLog === log.id
                                      ? "Hide Details"
                                      : `View Details (${
                                          Object.keys(log.details).length
                                        } field(s))`}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Table View */}
                    <div
                      className={`bg-white rounded-lg shadow-md overflow-hidden ${
                        auditLogsViewMode === "cards" ? "hidden md:block" : ""
                      }`}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Timestamp
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Action
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                IP Address
                              </th>
                              <th className="px-3 py-3 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Details
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {auditLogs.map((log) => (
                              <Fragment key={log.id}>
                                <tr>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                    {formatDate(log.timestamp)}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-900">
                                    <div className="min-w-0">
                                      <div className="break-words">
                                        {log.username || "Unknown"}
                                      </div>
                                      {log.full_name && (
                                        <div className="text-xs text-gray-500 break-words">
                                          {log.full_name}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4">
                                    <span
                                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getActionBadgeColor(
                                        log.action
                                      )}`}
                                    >
                                      {log.action.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500 break-words">
                                    {log.ip_address}
                                  </td>
                                  <td className="px-3 py-4 md:px-6 md:py-4 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                      {log.details &&
                                      Object.keys(log.details).length > 0 ? (
                                        <>
                                          <span
                                            key={`${log.id}-span`}
                                            className="text-gray-400 text-xs"
                                          >
                                            {Object.keys(log.details).length}{" "}
                                            field(s)
                                          </span>
                                          <button
                                            key={`${log.id}-button`}
                                            onClick={() =>
                                              setExpandedAuditLog(
                                                expandedAuditLog === log.id
                                                  ? null
                                                  : log.id
                                              )
                                            }
                                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                            title="View details"
                                          >
                                            <ChevronRightIcon
                                              className={`w-4 h-4 transition-transform ${
                                                expandedAuditLog === log.id
                                                  ? "rotate-90"
                                                  : ""
                                              }`}
                                            />
                                          </button>
                                        </>
                                      ) : (
                                        "-"
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {expandedAuditLog === log.id &&
                                  log.details &&
                                  Object.keys(log.details).length > 0 && (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="px-3 py-4 md:px-6 md:py-4 bg-gray-50"
                                      >
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-semibold text-gray-900">
                                            Details
                                          </h4>
                                          <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
                                            {JSON.stringify(
                                              log.details,
                                              null,
                                              2
                                            )}
                                          </pre>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {auditTotal > 0 && (
                      <Pagination
                        currentPage={auditPage}
                        totalPages={Math.ceil(auditTotal / 50)}
                        onPageChange={(page) => {
                          setAuditPage(page);
                        }}
                        itemsPerPage={50}
                        totalItems={auditTotal}
                        onItemsPerPageChange={(newItemsPerPage) => {
                          // Keep page size at 50 for audit logs
                          setAuditPage(1);
                        }}
                        showItemsPerPage={false}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Module Coordinators Tab */}
            {activeTab === "module-coordinators" && (
              <ModuleCoordinatorManager />
            )}

            {/* Branches Tab */}
            {activeTab === "branches" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-[#2D3748]">
                    Branch Management
                  </h2>
                  <Button
                    onClick={() => {
                      setEditingBranch(null);
                      setShowBranchForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px] sm:min-h-0"
                  >
                    Create Branch
                  </Button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Search
                      </label>
                      <input
                        type="text"
                        value={branchSearch}
                        onChange={(e) => {
                          setBranchSearch(e.target.value);
                        }}
                        placeholder="Search by name or code..."
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={branchFilter.is_active}
                        onChange={(e) => {
                          setBranchFilter((prev) => ({
                            ...prev,
                            is_active: e.target.value,
                          }));
                        }}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={branchFilter.is_headquarters}
                        onChange={(e) => {
                          setBranchFilter((prev) => ({
                            ...prev,
                            is_headquarters: e.target.value,
                          }));
                        }}
                        className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      >
                        <option value="ALL">All Types</option>
                        <option value="HQ">Headquarters</option>
                        <option value="NON_HQ">Non-Headquarters</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sort By
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={branchSort.field}
                          onChange={(e) => {
                            setBranchSort((prev) => ({
                              ...prev,
                              field: e.target.value as
                                | "name"
                                | "code"
                                | "created_at",
                            }));
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-sm sm:text-base"
                        >
                          <option value="name">Name</option>
                          <option value="code">Code</option>
                          <option value="created_at">Date Created</option>
                        </select>
                        <button
                          onClick={() => {
                            setBranchSort((prev) => ({
                              ...prev,
                              order: prev.order === "asc" ? "desc" : "asc",
                            }));
                          }}
                          className="min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 flex items-center justify-center transition-colors"
                          title={
                            branchSort.order === "asc"
                              ? "Sort Descending"
                              : "Sort Ascending"
                          }
                        >
                          {branchSort.order === "asc" ? (
                            <ChevronUpIcon className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 flex justify-end">
                    <Button
                      variant="tertiary"
                      onClick={() => {
                        setBranchSearch("");
                        setBranchFilter({
                          is_active: "ALL",
                          is_headquarters: "ALL",
                        });
                        setBranchSort({ field: "name", order: "asc" });
                      }}
                      className="w-full sm:w-auto min-h-[44px]"
                    >
                      Reset Filters
                    </Button>
                  </div>
                </div>

                {branchesLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : branches.length === 0 ? (
                  <div className="text-center py-8 px-4 text-sm sm:text-base text-gray-500">
                    No branches found. Create your first branch to get started.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4">
                    {branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-row items-start justify-between mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                                {branch.name}
                              </h3>
                              {branch.code && (
                                <span className="inline-block text-xs font-medium bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full whitespace-nowrap">
                                  {branch.code}
                                </span>
                              )}
                              {branch.is_headquarters && (
                                <div
                                  className="flex items-center text-yellow-500"
                                  title="Headquarters"
                                >
                                  <StarIcon className="w-4 h-4 fill-yellow-500" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center flex-shrink-0">
                            {branch.is_active ? (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full whitespace-nowrap">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full whitespace-nowrap">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <p className="text-xs sm:text-sm text-gray-600 break-words">
                            <span className="font-medium">Address:</span>{" "}
                            <span
                              className={
                                branch.address ? "" : "text-gray-400 italic"
                              }
                            >
                              {branch.address || "Not provided"}
                            </span>
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 break-words">
                            <span className="font-medium">Phone:</span>{" "}
                            <span
                              className={
                                branch.phone ? "" : "text-gray-400 italic"
                              }
                            >
                              {branch.phone || "Not provided"}
                            </span>
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 break-words">
                            <span className="font-medium">Email:</span>{" "}
                            <span
                              className={
                                branch.email ? "" : "text-gray-400 italic"
                              }
                            >
                              {branch.email || "Not provided"}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setViewingBranch(branch);
                              setShowBranchView(true);
                            }}
                            className="w-full min-h-[44px] flex items-center justify-center px-3 py-2.5 sm:py-1.5 text-sm font-medium bg-white border border-gray-500 text-gray-600 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setEditingBranch(branch);
                              setShowBranchForm(true);
                            }}
                            className="w-full min-h-[44px] flex items-center justify-center px-3 py-2.5 sm:py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 active:bg-blue-100 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Branch View Modal */}
                <Modal
                  isOpen={showBranchView}
                  onClose={() => {
                    setShowBranchView(false);
                    setViewingBranch(null);
                  }}
                  title="Branch Details"
                >
                  {viewingBranch && (
                    <div className="space-y-4 sm:space-y-6">
                      {/* Profile Header Card */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-100">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
                            {viewingBranch.name[0]}
                            {viewingBranch.name.split(" ")[1]?.[0] || ""}
                          </div>
                          <div className="flex-1 w-full sm:w-auto text-center sm:text-left">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                                {viewingBranch.name}
                              </h2>
                              {viewingBranch.code && (
                                <span className="inline-block text-sm font-medium bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                                  {viewingBranch.code}
                                </span>
                              )}
                              {viewingBranch.is_headquarters && (
                                <div
                                  className="flex items-center text-yellow-500"
                                  title="Headquarters"
                                >
                                  <StarIcon className="w-5 h-5 fill-yellow-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:space-x-2 mt-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  viewingBranch.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {viewingBranch.is_active
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main Content Grid */}
                      <div className="grid grid-cols-1 gap-4">
                        {/* Contact Information Card */}
                        {(viewingBranch.address ||
                          viewingBranch.phone ||
                          viewingBranch.email) && (
                          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center space-x-2 mb-4">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg
                                  className="w-4 h-4 text-blue-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                  />
                                </svg>
                              </div>
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                Contact Information
                              </h3>
                            </div>
                            <div className="space-y-3">
                              {viewingBranch.address && (
                                <div className="flex items-start space-x-3">
                                  <svg
                                    className="w-4 h-4 text-gray-400 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                  <p className="text-sm text-gray-900 flex-1 whitespace-pre-wrap">
                                    {viewingBranch.address}
                                  </p>
                                </div>
                              )}
                              {viewingBranch.phone && (
                                <div className="flex items-center space-x-3">
                                  <svg
                                    className="w-4 h-4 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    />
                                  </svg>
                                  <p className="text-sm text-gray-900">
                                    {viewingBranch.phone}
                                  </p>
                                </div>
                              )}
                              {viewingBranch.email && (
                                <div className="flex items-center space-x-3">
                                  <svg
                                    className="w-4 h-4 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                  </svg>
                                  <p className="text-sm text-gray-900">
                                    {viewingBranch.email}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 pt-4 border-t border-gray-200">
                        {/* Mobile buttons - full width with text */}
                        <div className="flex flex-col md:hidden gap-3 w-full">
                          <Button
                            onClick={() => {
                              setShowBranchView(false);
                              setViewingBranch(null);
                              setEditingBranch(viewingBranch);
                              setShowBranchForm(true);
                            }}
                            variant="secondary"
                            className="!text-blue-600 py-3 px-4 text-sm font-medium bg-white border border-blue-300 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                            <span>Edit</span>
                          </Button>
                          <Button
                            onClick={() => {
                              setShowBranchView(false);
                              setViewingBranch(null);
                            }}
                            variant="secondary"
                            className="!text-gray-700 py-3 px-4 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                            <span>Cancel</span>
                          </Button>
                          <div className="border-t border-gray-200 my-1"></div>
                          <Button
                            onClick={() => {
                              setShowBranchView(false);
                              setViewingBranch(null);
                              setBranchDeleteConfirmation({
                                isOpen: true,
                                branch: viewingBranch,
                                loading: false,
                              });
                            }}
                            variant="secondary"
                            className="!text-red-600 py-3 px-4 text-sm font-medium bg-white border border-red-300 hover:bg-red-50 hover:border-red-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                            <span>Delete</span>
                          </Button>
                        </div>

                        {/* Desktop/Tablet buttons */}
                        <div className="hidden md:flex md:items-center md:justify-between md:w-full">
                          <Button
                            onClick={() => {
                              setShowBranchView(false);
                              setViewingBranch(null);
                              setBranchDeleteConfirmation({
                                isOpen: true,
                                branch: viewingBranch,
                                loading: false,
                              });
                            }}
                            variant="secondary"
                            className="!text-red-600 px-4 md:py-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
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
                          </Button>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => {
                                setShowBranchView(false);
                                setViewingBranch(null);
                              }}
                              variant="secondary"
                              className="!text-black px-6 md:py-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
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
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                              <span>Cancel</span>
                            </Button>
                            <Button
                              onClick={() => {
                                setShowBranchView(false);
                                setViewingBranch(null);
                                setEditingBranch(viewingBranch);
                                setShowBranchForm(true);
                              }}
                              variant="secondary"
                              className="!text-blue-600 px-6 md:py-4 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
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
                              <span>Edit</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Modal>

                {/* Branch Form Modal */}
                {showBranchForm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !-mt-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {editingBranch ? "Edit Branch" : "Create Branch"}
                          </h3>
                          <button
                            onClick={() => {
                              setShowBranchForm(false);
                              setEditingBranch(null);
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        <BranchForm
                          branch={editingBranch}
                          loading={branchesLoading}
                          onSave={async (data) => {
                            try {
                              setBranchesLoading(true);
                              if (editingBranch) {
                                await branchesApi.patch(editingBranch.id, data);
                                toast.success("Branch updated successfully");
                              } else {
                                await branchesApi.create(data);
                                toast.success("Branch created successfully");
                              }
                              setShowBranchForm(false);
                              setEditingBranch(null);
                              await fetchData();
                            } catch (err: any) {
                              toast.error(
                                err.response?.data?.message ||
                                  err.message ||
                                  "Failed to save branch"
                              );
                            } finally {
                              setBranchesLoading(false);
                            }
                          }}
                          onCancel={() => {
                            setShowBranchForm(false);
                            setEditingBranch(null);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve Password Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={approveConfirmation.isOpen}
        onClose={() =>
          setApproveConfirmation({
            isOpen: false,
            request: null,
            loading: false,
          })
        }
        onConfirm={confirmApproveReset}
        title="Approve Password Reset Request"
        message={
          approveConfirmation.request
            ? `Are you sure you want to approve the password reset request for ${approveConfirmation.request.full_name} (${approveConfirmation.request.email})? The user will be required to change their password on next login.`
            : ""
        }
        confirmText="Approve"
        cancelText="Cancel"
        variant="info"
        loading={approveConfirmation.loading}
      />

      {/* Delete Branch Confirmation Modal */}
      <ConfirmationModal
        isOpen={branchDeleteConfirmation.isOpen}
        onClose={() =>
          setBranchDeleteConfirmation({
            isOpen: false,
            branch: null,
            loading: false,
          })
        }
        onConfirm={async () => {
          if (!branchDeleteConfirmation.branch) return;
          setBranchDeleteConfirmation((prev) => ({ ...prev, loading: true }));
          try {
            await branchesApi.delete(branchDeleteConfirmation.branch.id);
            toast.success("Branch deleted successfully");
            setBranchDeleteConfirmation({
              isOpen: false,
              branch: null,
              loading: false,
            });
            await fetchData();
          } catch (err: any) {
            toast.error(
              err.response?.data?.message ||
                err.message ||
                "Failed to delete branch"
            );
            setBranchDeleteConfirmation((prev) => ({
              ...prev,
              loading: false,
            }));
          }
        }}
        title="Delete Branch"
        message={
          branchDeleteConfirmation.branch
            ? `Are you sure you want to delete the branch "${branchDeleteConfirmation.branch.name}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={branchDeleteConfirmation.loading}
      />

      {/* Unlock Account Confirmation Modal */}
      <ConfirmationModal
        isOpen={unlockConfirmation.isOpen}
        onClose={() =>
          setUnlockConfirmation({
            isOpen: false,
            account: null,
            loading: false,
          })
        }
        onConfirm={confirmUnlockAccount}
        title="Unlock Account"
        message={
          unlockConfirmation.account
            ? `Are you sure you want to unlock the account for ${unlockConfirmation.account.full_name} (${unlockConfirmation.account.email})? This will reset their failed login attempts and allow them to log in again.`
            : ""
        }
        confirmText="Unlock"
        cancelText="Cancel"
        variant="info"
        loading={unlockConfirmation.loading}
      />

      {/* Reject Password Reset Confirmation Modal */}
      {rejectConfirmation.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-75"
            onClick={() =>
              setRejectConfirmation({
                isOpen: false,
                request: null,
                loading: false,
                notes: "",
              })
            }
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <XCircleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Reject Password Reset Request
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Are you sure you want to reject the password reset request
                      for {rejectConfirmation.request?.full_name} (
                      {rejectConfirmation.request?.email})? Please provide a
                      reason for rejection.
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectConfirmation.notes}
                      onChange={(e) =>
                        setRejectConfirmation((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Enter rejection reason..."
                      required
                      rows={4}
                      className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button
                variant="tertiary"
                onClick={() =>
                  setRejectConfirmation({
                    isOpen: false,
                    request: null,
                    loading: false,
                    notes: "",
                  })
                }
                disabled={rejectConfirmation.loading}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRejectReset}
                disabled={
                  rejectConfirmation.loading || !rejectConfirmation.notes.trim()
                }
                className="w-full sm:w-auto min-h-[44px] bg-red-600 hover:bg-red-700"
              >
                {rejectConfirmation.loading ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

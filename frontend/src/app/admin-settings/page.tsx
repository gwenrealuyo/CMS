"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ProtectedRoute from "@/src/components/auth/ProtectedRoute";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import Pagination from "@/src/components/ui/Pagination";
import { CheckCircleIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import {
  authApi,
  PasswordResetRequest,
  LockedAccount,
  AuditLog,
} from "@/src/lib/api";
import ModuleCoordinatorManager from "@/src/components/admin/ModuleCoordinatorManager";

type Tab =
  | "password-resets"
  | "locked-accounts"
  | "audit-logs"
  | "module-coordinators";

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminSettingsPageContent />
    </ProtectedRoute>
  );
}

function AdminSettingsPageContent() {
  const [activeTab, setActiveTab] = useState<Tab>("password-resets");
  const [passwordResetRequests, setPasswordResetRequests] = useState<
    PasswordResetRequest[]
  >([]);
  const [resetRequestsPage, setResetRequestsPage] = useState(1);
  const [resetRequestsTotal, setResetRequestsTotal] = useState(0);
  const [resetRequestsItemsPerPage, setResetRequestsItemsPerPage] =
    useState(10);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [lockedAccountsPage, setLockedAccountsPage] = useState(1);
  const [lockedAccountsTotal, setLockedAccountsTotal] = useState(0);
  const [lockedAccountsItemsPerPage, setLockedAccountsItemsPerPage] =
    useState(10);
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
  });
  const [approveConfirmation, setApproveConfirmation] = useState<{
    isOpen: boolean;
    request: PasswordResetRequest | null;
    loading: boolean;
  }>({
    isOpen: false,
    request: null,
    loading: false,
  });
  const [unlockConfirmation, setUnlockConfirmation] = useState<{
    isOpen: boolean;
    account: LockedAccount | null;
    loading: boolean;
  }>({
    isOpen: false,
    account: null,
    loading: false,
  });

  useEffect(() => {
    fetchData();
  }, [
    activeTab,
    statusFilter,
    auditPage,
    auditFilters,
    resetRequestsPage,
    resetRequestsItemsPerPage,
    lockedAccountsPage,
    lockedAccountsItemsPerPage,
  ]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "password-resets") {
        const status = statusFilter === "ALL" ? undefined : statusFilter;
        const response = await authApi.getPasswordResetRequests(
          status,
          resetRequestsPage,
          resetRequestsItemsPerPage
        );
        setPasswordResetRequests(response.data.results);
        setResetRequestsTotal(response.data.count);
      } else if (activeTab === "locked-accounts") {
        const response = await authApi.getLockedAccounts(
          lockedAccountsPage,
          lockedAccountsItemsPerPage
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
      await fetchData();
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to approve request."
      );
      setApproveConfirmation((prev) => ({ ...prev, loading: false }));
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
      await fetchData();
    } catch (err: any) {
      alert(
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
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("password-resets")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "password-resets"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Password Reset Requests
            </button>
            <button
              onClick={() => setActiveTab("locked-accounts")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "locked-accounts"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Locked Accounts
            </button>
            <button
              onClick={() => setActiveTab("audit-logs")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "audit-logs"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab("module-coordinators")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "module-coordinators"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Module Coordinators
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
            {/* Password Reset Requests Tab */}
            {activeTab === "password-resets" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-[#2D3748]">
                    Password Reset Requests
                  </h2>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setResetRequestsPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                {passwordResetRequests.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-500">
                      No password reset requests found.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Requested At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {passwordResetRequests.map((request) => (
                          <tr key={request.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {request.full_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {request.username} ({request.email})
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(request.requested_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
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
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {request.notes || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {request.status === "PENDING" && (
                                <button
                                  onClick={() => handleApproveReset(request)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-green-500 text-green-600 rounded-md hover:bg-green-50 transition-colors"
                                >
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Approve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                <h2 className="text-xl font-semibold text-[#2D3748]">
                  Locked Accounts
                </h2>

                {lockedAccounts.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <p className="text-gray-500">No locked accounts found.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Failed Attempts
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Locked Until
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Lockout Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lockedAccounts.map((account) => (
                          <tr key={account.user_id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {account.full_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {account.username} ({account.email})
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {account.failed_attempts}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {account.locked_until
                                ? formatDate(account.locked_until)
                                : "Permanent (Admin unlock required)"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {account.lockout_count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleUnlockAccount(account)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                              >
                                <LockOpenIcon className="w-4 h-4" />
                                Unlock
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

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
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === "audit-logs" && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-[#2D3748]">
                  Audit Logs
                </h2>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                          });
                          setAuditPage(1);
                        }}
                        className="w-full"
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
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Timestamp
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              IP Address
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Details
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(log.timestamp)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {log.username || "Unknown"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {log.action.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {log.ip_address}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {log.details &&
                                Object.keys(log.details).length > 0
                                  ? JSON.stringify(log.details)
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        Showing {(auditPage - 1) * 50 + 1} to{" "}
                        {Math.min(auditPage * 50, auditTotal)} of {auditTotal}{" "}
                        results
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            setAuditPage((p) => Math.max(1, p - 1))
                          }
                          disabled={auditPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => setAuditPage((p) => p + 1)}
                          disabled={auditPage * 50 >= auditTotal}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Module Coordinators Tab */}
            {activeTab === "module-coordinators" && (
              <ModuleCoordinatorManager />
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
    </DashboardLayout>
  );
}

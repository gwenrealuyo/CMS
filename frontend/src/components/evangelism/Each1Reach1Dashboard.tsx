"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Modal from "@/src/components/ui/Modal";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { Each1Reach1Goal } from "@/src/types/evangelism";
import { Cluster } from "@/src/types/cluster";
import { Branch } from "@/src/types/branch";
import { useEach1Reach1Goals } from "@/src/hooks/useEvangelism";
import { branchesApi, clustersApi, evangelismApi } from "@/src/lib/api";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  canChangeEvangelismBranchFilter,
  EVANGELISM_BRANCH_LOCKED_HINT,
} from "@/src/lib/evangelismBranchFilter";
import { getEach1Reach1ProgressBarBgClass } from "@/src/lib/each1Reach1ProgressStyles";

interface Each1Reach1DashboardProps {
  year?: number;
}

export default function Each1Reach1Dashboard({
  year,
}: Each1Reach1DashboardProps) {
  const { user, isSeniorCoordinator } = useAuth();
  const canChangeBranchFilter = useMemo(
    () => canChangeEvangelismBranchFilter(user, isSeniorCoordinator),
    [user, isSeniorCoordinator],
  );
  const each1BranchUserIdRef = useRef<number | undefined>(undefined);

  type SortField =
    | "cluster"
    | "target_conversions"
    | "achieved_conversions"
    | "progress_percentage"
    | "status";

  const currentYear = year || new Date().getFullYear();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterBranch, setFilterBranch] = useState<number | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [editingGoalId, setEditingGoalId] = useState<number | string | null>(
    null,
  );
  const [selectedClusterId, setSelectedClusterId] = useState<number | "">("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [achievedConversions, setAchievedConversions] = useState(0);
  const [targetConversions, setTargetConversions] = useState(0);
  const [suggestedTarget, setSuggestedTarget] = useState<number | null>(null);
  const [isTargetDirty, setIsTargetDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("cluster");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilterYear(currentYear);
  }, [currentYear]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Memoize filters to prevent infinite re-renders
  const filters = useMemo(
    () => ({
      year: filterYear,
      status: filterStatus !== "ALL" ? filterStatus : undefined,
      cluster__branch: filterBranch || undefined,
      search: debouncedSearch || undefined,
    }),
    [filterYear, filterStatus, filterBranch, debouncedSearch],
  );
  const {
    goals,
    loading,
    isLoadingMore,
    hasMore,
    error,
    createGoal,
    updateGoal,
    fetchGoals,
    loadMore,
  } = useEach1Reach1Goals(filters);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        setBranchesLoading(true);
        setClustersLoading(true);
        const [clustersResponse, branchesResponse] = await Promise.all([
          clustersApi.getAll(),
          branchesApi.getAll(),
        ]);
        setClusters(clustersResponse.data);
        setBranches(branchesResponse.data);
      } catch (err) {
        console.error(err);
      } finally {
        setBranchesLoading(false);
        setClustersLoading(false);
      }
    };

    loadDependencies();
  }, []);

  useEffect(() => {
    if (!user) {
      each1BranchUserIdRef.current = undefined;
      return;
    }
    if (each1BranchUserIdRef.current !== user.id) {
      each1BranchUserIdRef.current = user.id;
      setFilterBranch(
        user.branch != null && user.branch !== undefined ? user.branch : "",
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user || canChangeBranchFilter) return;
    if (user.branch != null && filterBranch !== user.branch) {
      setFilterBranch(user.branch);
    }
  }, [user, canChangeBranchFilter, filterBranch]);

  useEffect(() => {
    if (!showGoalModal || !selectedClusterId) {
      return;
    }

    const fetchDefaultTarget = async () => {
      try {
        const response = await evangelismApi.getGoalDefaultTarget({
          cluster_id: selectedClusterId,
          year: selectedYear,
        });
        const suggested = response.data.target_conversions || 0;
        setSuggestedTarget(suggested);
        // Only auto-apply suggested defaults during create flow.
        // In edit mode, preserve the existing saved target value.
        if (!isTargetDirty && modalMode === "create") {
          setTargetConversions(suggested);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchDefaultTarget();
  }, [
    showGoalModal,
    selectedClusterId,
    selectedYear,
    isTargetDirty,
    modalMode,
  ]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, goals.length]);

  const resetGoalForm = () => {
    setModalMode("create");
    setEditingGoalId(null);
    setSelectedClusterId("");
    setSelectedYear(filterYear);
    setAchievedConversions(0);
    setTargetConversions(0);
    setSuggestedTarget(null);
    setIsTargetDirty(false);
    setFormError(null);
  };

  const openCreateGoalModal = () => {
    resetGoalForm();
    setModalMode("create");
    setShowGoalModal(true);
  };

  const openEditGoalModal = (goal: Each1Reach1Goal) => {
    setModalMode("edit");
    setEditingGoalId(goal.id);
    setSelectedClusterId(Number(goal.cluster?.id || "") || "");
    setSelectedYear(goal.year || filterYear);
    setTargetConversions(goal.target_conversions || 0);
    setAchievedConversions(goal.achieved_conversions || 0);
    setSuggestedTarget(null);
    setIsTargetDirty(false);
    setFormError(null);
    setShowGoalModal(true);
  };

  const resetFilters = () => {
    setFilterYear(currentYear);
    setFilterStatus("ALL");
    setFilterBranch(
      canChangeBranchFilter
        ? ""
        : user?.branch != null && user.branch !== undefined
          ? user.branch
          : "",
    );
    setSearchInput("");
    setDebouncedSearch("");
  };

  const handleSubmitGoal = async () => {
    if (!selectedClusterId) {
      setFormError("Please select a cluster.");
      return;
    }
    if (targetConversions < 0) {
      setFormError("Target conversions must be 0 or higher.");
      return;
    }
    if (modalMode === "edit" && achievedConversions < 0) {
      setFormError("Achieved conversions must be 0 or higher.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      if (modalMode === "create") {
        await createGoal({
          cluster_id: String(selectedClusterId),
          year: selectedYear,
          target_conversions: targetConversions,
        });
      } else if (editingGoalId !== null) {
        await updateGoal(editingGoalId, {
          cluster_id: String(selectedClusterId),
          year: selectedYear,
          target_conversions: targetConversions,
          achieved_conversions: achievedConversions,
        });
      }
      setShowGoalModal(false);
      resetGoalForm();
      fetchGoals();
    } catch (err: any) {
      const errorData = err?.response?.data;
      const firstError = errorData ? Object.values(errorData)[0] : null;
      const firstErrorMessage = Array.isArray(firstError)
        ? String(firstError[0])
        : typeof firstError === "string"
          ? firstError
          : null;
      const isConflict =
        String(errorData?.non_field_errors?.[0] || firstErrorMessage || "")
          .toLowerCase()
          .includes("unique") ||
        String(errorData?.non_field_errors?.[0] || firstErrorMessage || "")
          .toLowerCase()
          .includes("already exists");
      if (isConflict) {
        setFormError("A goal already exists for this cluster and year.");
      } else {
        setFormError(
          errorData?.detail ||
            firstErrorMessage ||
            `Failed to ${modalMode === "create" ? "create" : "update"} goal.`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const sortedGoals = useMemo(() => {
    const data = [...goals];
    return data.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortField === "cluster") {
        const valueA = (a.cluster?.name || "").toLowerCase();
        const valueB = (b.cluster?.name || "").toLowerCase();
        if (valueA < valueB) return -1 * direction;
        if (valueA > valueB) return 1 * direction;
        return 0;
      }

      if (sortField === "status") {
        const valueA = (a.status || "").toLowerCase();
        const valueB = (b.status || "").toLowerCase();
        if (valueA < valueB) return -1 * direction;
        if (valueA > valueB) return 1 * direction;
        return 0;
      }

      const valueA = Number(a[sortField] ?? 0);
      const valueB = Number(b[sortField] ?? 0);
      return valueA < valueB
        ? -1 * direction
        : valueA > valueB
          ? 1 * direction
          : 0;
    });
  }, [goals, sortDirection, sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  return (
    <Card
      title={`Each 1 Reach 1 Goals - ${filterYear}`}
      headerAction={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.25">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "table"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "bg-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <TableCellsIcon className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "cards"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "bg-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Squares2X2Icon className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
          <Button
            variant="primary"
            className="w-full sm:w-auto min-h-[44px] text-sm sm:ml-2"
            onClick={openCreateGoalModal}
          >
            Create Goal
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        <input
          type="number"
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value) || currentYear)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          min={currentYear - 10}
          max={currentYear + 10}
          aria-label="Filter by year"
          placeholder="Year"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="ALL">All status</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
        {(() => {
          const each1BranchInteractive =
            canChangeBranchFilter && !branchesLoading;
          const branchSelectEl = (
            <select
              aria-label="Filter by branch"
              aria-disabled={!each1BranchInteractive}
              tabIndex={each1BranchInteractive ? 0 : -1}
              value={filterBranch}
              onChange={(e) => {
                if (!each1BranchInteractive) return;
                setFilterBranch(Number(e.target.value) || "");
              }}
              disabled={canChangeBranchFilter && branchesLoading}
              className={`rounded-md border border-gray-200 px-3 py-2 text-sm ${
                !canChangeBranchFilter
                  ? "pointer-events-none cursor-default bg-white text-gray-900"
                  : ""
              } ${
                canChangeBranchFilter && branchesLoading
                  ? "cursor-wait bg-gray-50 text-gray-500"
                  : ""
              }`}
            >
              {canChangeBranchFilter ? (
                <>
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </>
              ) : user?.branch != null ? (
                <>
                  {branches
                    .filter((b) => Number(b.id) === Number(user.branch))
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  {!branches.some(
                    (b) => Number(b.id) === Number(user.branch),
                  ) && (
                    <option value={Number(user.branch)}>
                      {user.branch_name?.trim() ?? `Branch #${user.branch}`}
                    </option>
                  )}
                </>
              ) : (
                <option value="">No branch assigned</option>
              )}
            </select>
          );
          return !canChangeBranchFilter ? (
            <LockedControlTooltip
              label={EVANGELISM_BRANCH_LOCKED_HINT}
              wrapperClassName="block min-w-0 w-full align-middle cursor-default"
            >
              {branchSelectEl}
            </LockedControlTooltip>
          ) : (
            branchSelectEl
          );
        })()}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          placeholder="Search group..."
          aria-label="Search by cluster or evangelism group name"
        />
        <Button
          variant="tertiary"
          onClick={resetFilters}
          className="min-h-[44px] text-sm"
        >
          Reset
        </Button>
      </div>

      {error && <ErrorMessage message={error} />}
      {loading && goals.length === 0 ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center text-gray-500 py-16 border border-dashed border-gray-200 rounded-lg">
          No goals found for {filterYear} with current filters.
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="cursor-pointer px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort("cluster")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Cluster</span>
                      <SortIcon field="cluster" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort("target_conversions")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Target</span>
                      <SortIcon field="target_conversions" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort("achieved_conversions")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Achieved</span>
                      <SortIcon field="achieved_conversions" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort("progress_percentage")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Progress</span>
                      <SortIcon field="progress_percentage" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedGoals.map((goal) => {
                  const percentage = goal.progress_percentage || 0;
                  return (
                    <tr key={goal.id}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                        {goal.cluster?.name || "Unknown Cluster"}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {goal.target_conversions || 0}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {goal.achieved_conversions || 0}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                            <div
                              className={`h-1.5 rounded-full ${getEach1Reach1ProgressBarBgClass(
                                percentage,
                                goal.achieved_conversions,
                                goal.target_conversions,
                              )}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-gray-600">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            goal.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : goal.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {goal.status?.replace("_", " ") || "Not Started"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <Button
                          variant="tertiary"
                          className="min-h-[32px] px-2 py-1 text-xs"
                          onClick={() => openEditGoalModal(goal)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-md border border-gray-200 p-3"
            >
              <h3 className="text-base font-semibold text-gray-900">
                {goal.cluster?.name || "Unknown Cluster"}
              </h3>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                <span>Progress</span>
                <span className="font-medium">
                  {goal.achieved_conversions} / {goal.target_conversions}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
                <div
                  className={`${getEach1Reach1ProgressBarBgClass(
                    goal.progress_percentage || 0,
                    goal.achieved_conversions,
                    goal.target_conversions,
                  )} h-1.5 rounded-full`}
                  style={{
                    width: `${Math.min(goal.progress_percentage || 0, 100)}%`,
                  }}
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-gray-600">Status:</span>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                  {goal.status?.replace("_", " ") || "Not Started"}
                </span>
                <Button
                  variant="tertiary"
                  className="ml-auto min-h-[28px] px-2 py-1 text-xs"
                  onClick={() => openEditGoalModal(goal)}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-2" />
      {isLoadingMore && (
        <div className="py-3 text-center text-sm text-gray-500">
          Loading more clusters...
        </div>
      )}
      {!hasMore && goals.length > 0 && (
        <div className="py-3 text-center text-xs text-gray-400">
          End of results
        </div>
      )}

      <Modal
        isOpen={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          resetGoalForm();
        }}
        title={
          modalMode === "create"
            ? "Create Each 1 Reach 1 Goal"
            : "Edit Each 1 Reach 1 Goal"
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cluster
            </label>
            <select
              value={selectedClusterId}
              onChange={(e) =>
                setSelectedClusterId(Number(e.target.value) || "")
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              disabled={clustersLoading}
            >
              <option value="">Select a cluster</option>
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name || `Cluster ${cluster.id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Year
            </label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(Number(e.target.value) || currentYear)
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              min={currentYear - 5}
              max={currentYear + 5}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Target Conversions
            </label>
            <input
              type="number"
              value={targetConversions}
              onChange={(e) => {
                setIsTargetDirty(true);
                setTargetConversions(Number(e.target.value) || 0);
              }}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              min={0}
            />
            <p className="mt-1 text-xs text-gray-500">
              Default is 2x the cluster non-admin member count. You can adjust
              before saving.
            </p>
            {suggestedTarget !== null && (
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span>Suggested default: {suggestedTarget}</span>
                {suggestedTarget !== targetConversions && (
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      setTargetConversions(suggestedTarget);
                      setIsTargetDirty(false);
                    }}
                  >
                    Use suggested
                  </button>
                )}
              </div>
            )}
          </div>

          {modalMode === "edit" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Achieved Conversions
              </label>
              <input
                type="number"
                value={achievedConversions}
                onChange={(e) =>
                  setAchievedConversions(Number(e.target.value) || 0)
                }
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                min={0}
              />
            </div>
          )}

          {formError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
            <Button
              variant="tertiary"
              className="w-full sm:flex-1 min-h-[44px]"
              onClick={() => {
                setShowGoalModal(false);
                resetGoalForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="w-full sm:flex-1 min-h-[44px]"
              onClick={handleSubmitGoal}
              disabled={isSubmitting || clustersLoading}
            >
              {isSubmitting
                ? modalMode === "create"
                  ? "Creating..."
                  : "Saving..."
                : modalMode === "create"
                  ? "Create Goal"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

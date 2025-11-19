"use client";

import DashboardLayout from "@/src/components/layout/DashboardLayout";
import ClusterContentTabs, {
  ClusterContentTab,
} from "@/src/components/clusters/ClusterContentTabs";
import ClusterCard from "@/src/components/clusters/ClusterCard";
import ClusterView from "@/src/components/clusters/ClusterView";
import ClusterForm from "@/src/components/clusters/ClusterForm";
import ClusterReportsDashboard from "@/src/components/reports/ClusterReportsDashboard";
import ClusterFilterDropdown from "@/src/components/clusters/ClusterFilterDropdown";
import ClusterFilterCard from "@/src/components/clusters/ClusterFilterCard";
import ClusterSortDropdown from "@/src/components/clusters/ClusterSortDropdown";
import AssignMembersModal from "@/src/components/clusters/AssignMembersModal";
import PersonProfile from "@/src/components/people/PersonProfile";
import FamilyView from "@/src/components/families/FamilyView";
import BulkActionsMenu from "@/src/components/people/BulkActionsMenu";
import Modal from "@/src/components/ui/Modal";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import Pagination from "@/src/components/ui/Pagination";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { Cluster, ClusterInput } from "@/src/types/cluster";
import {
  ClusterWeeklyReport,
  ClusterWeeklyReportInput,
} from "@/src/types/cluster";
import { Person, PersonUI, Family } from "@/src/types/person";
import { FilterCondition } from "@/src/components/people/FilterBar";

interface ClustersPageViewProps {
  activeTab: ClusterContentTab;
  onTabChange: (tab: ClusterContentTab) => void;
  // Clusters tab props
  allClusters: Cluster[];
  clusters: Cluster[];
  clustersLoading: boolean;
  clusterSearchQuery: string;
  onClusterSearchChange: (query: string) => void;
  clusterActiveFilters: FilterCondition[];
  onClusterFilterRemove: (filterId: string) => void;
  onClusterClearFilters: () => void;
  clusterSortBy: string;
  clusterSortOrder: "asc" | "desc";
  clusterPaginatedData: Cluster[];
  clusterCurrentPage: number;
  clusterTotalPages: number;
  clusterItemsPerPage: number;
  onClusterPageChange: (page: number) => void;
  onClusterItemsPerPageChange: (size: number) => void;
  onClusterAddFilter: (anchorRect: DOMRect) => void;
  onClusterSortDropdown: (anchorRect: DOMRect) => void;
  showClusterFilterDropdown: boolean;
  showClusterFilterCard: boolean;
  showClusterSortDropdown: boolean;
  selectedClusterField: any;
  clusterFilterDropdownPosition: { top: number; left: number };
  clusterFilterCardPosition: { top: number; left: number };
  clusterSortDropdownPosition: { top: number; left: number };
  onClusterSelectField: (field: any) => void;
  onClusterApplyFilter: (filter: FilterCondition) => void;
  onClusterSelectSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onCloseClusterFilterDropdown: () => void;
  onCloseClusterSortDropdown: () => void;
  onCloseClusterFilterCard: () => void;
  onViewCluster: (cluster: Cluster) => void;
  onEditCluster: (cluster: Cluster) => void;
  onDeleteCluster: (cluster: Cluster) => void;
  onCreateCluster: () => void;
  viewCluster: Cluster | null;
  editCluster: Cluster | null;
  clusterViewMode: "view" | "edit";
  isClusterModalOpen: boolean;
  onCloseClusterModal: () => void;
  clusterDeleteConfirmation: {
    isOpen: boolean;
    cluster: Cluster | null;
    loading: boolean;
  };
  onConfirmDeleteCluster: () => void;
  onCloseDeleteConfirmation: () => void;
  onCreateClusterSubmit: (data: ClusterInput) => Promise<void>;
  onUpdateClusterSubmit: (data: Partial<ClusterInput>) => Promise<void>;
  assignMembersModal: { isOpen: boolean; cluster: Cluster | null };
  onAssignMembers: (memberIds: number[]) => Promise<void>;
  onCloseAssignMembers: () => void;
  onOpenAssignMembers: (cluster: Cluster) => void;
  // Overlay modals
  showClusterOverPerson: boolean;
  clusterOverPerson: Cluster | null;
  onCloseClusterOverPerson: () => void;
  showFamilyOverCluster: boolean;
  familyOverCluster: Family | null;
  onCloseFamilyOverCluster: () => void;
  showPersonOverCluster: boolean;
  personOverCluster: Person | null;
  onClosePersonOverCluster: () => void;
  showEditClusterOverlay: boolean;
  editClusterOverlay: Cluster | null;
  onCloseEditClusterOverlay: () => void;
  onOpenEditClusterOverlay: (cluster: Cluster) => void;
  onUpdateClusterOverlay: (data: Partial<ClusterInput>) => Promise<void>;
  onViewFamily?: (family: Family) => void;
  onViewPerson?: (person: Person) => void;
  // Reports tab props
  reports: ClusterWeeklyReport[];
  reportsLoading: boolean;
  reportsError: string | null;
  isReportFormOpen: boolean;
  onOpenReportForm: (cluster?: Cluster | null) => void;
  onCloseReportForm: () => void;
  editingReport: ClusterWeeklyReport | null;
  onEditReport: (report: ClusterWeeklyReport) => void;
  reportSelectedCluster: Cluster | null;
  onSetReportSelectedCluster: (cluster: Cluster | null) => void;
  onCreateReport: (data: ClusterWeeklyReportInput) => Promise<void>;
  onUpdateReport: (
    id: number,
    data: Partial<ClusterWeeklyReportInput>
  ) => Promise<void>;
  onDeleteReport: (report: ClusterWeeklyReport) => void;
  reportDeleteConfirmation: {
    isOpen: boolean;
    report: ClusterWeeklyReport | null;
    loading: boolean;
  };
  onConfirmDeleteReport: () => void;
  onCloseReportDeleteConfirmation: () => void;
  // Data
  people: Person[];
  peopleUI: PersonUI[];
  families: Family[];
  // Bulk selection
  selectedClusters: Set<string>;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  onSelectCluster: (clusterId: string) => void;
  onSelectAllClusters: () => void;
  onBulkDelete: () => void;
  onBulkExport: (format: "excel" | "pdf" | "csv") => void;
}

export default function ClustersPageView({
  activeTab,
  onTabChange,
  allClusters,
  clusters,
  clustersLoading,
  clusterSearchQuery,
  onClusterSearchChange,
  clusterActiveFilters,
  onClusterFilterRemove,
  onClusterClearFilters,
  clusterSortBy,
  clusterSortOrder,
  clusterPaginatedData,
  clusterCurrentPage,
  clusterTotalPages,
  clusterItemsPerPage,
  onClusterPageChange,
  onClusterItemsPerPageChange,
  onClusterAddFilter,
  onClusterSortDropdown,
  showClusterFilterDropdown,
  showClusterFilterCard,
  showClusterSortDropdown,
  selectedClusterField,
  clusterFilterDropdownPosition,
  clusterFilterCardPosition,
  clusterSortDropdownPosition,
  onClusterSelectField,
  onClusterApplyFilter,
  onClusterSelectSort,
  onCloseClusterFilterDropdown,
  onCloseClusterSortDropdown,
  onCloseClusterFilterCard,
  onViewCluster,
  onEditCluster,
  onDeleteCluster,
  onCreateCluster,
  viewCluster,
  editCluster,
  clusterViewMode,
  isClusterModalOpen,
  onCloseClusterModal,
  clusterDeleteConfirmation,
  onConfirmDeleteCluster,
  onCloseDeleteConfirmation,
  onCreateClusterSubmit,
  onUpdateClusterSubmit,
  assignMembersModal,
  onAssignMembers,
  onCloseAssignMembers,
  onOpenAssignMembers,
  showClusterOverPerson,
  clusterOverPerson,
  onCloseClusterOverPerson,
  showFamilyOverCluster,
  familyOverCluster,
  onCloseFamilyOverCluster,
  showPersonOverCluster,
  personOverCluster,
  onClosePersonOverCluster,
  showEditClusterOverlay,
  editClusterOverlay,
  onCloseEditClusterOverlay,
  onOpenEditClusterOverlay,
  onUpdateClusterOverlay,
  onViewFamily,
  onViewPerson,
  reports,
  reportsLoading,
  reportsError,
  isReportFormOpen,
  onOpenReportForm,
  onCloseReportForm,
  editingReport,
  onEditReport,
  reportSelectedCluster,
  onSetReportSelectedCluster,
  onCreateReport,
  onUpdateReport,
  onDeleteReport,
  reportDeleteConfirmation,
  onConfirmDeleteReport,
  onCloseReportDeleteConfirmation,
  people,
  peopleUI,
  families,
  selectedClusters,
  isSelectionMode,
  onToggleSelectionMode,
  onSelectCluster,
  onSelectAllClusters,
  onBulkDelete,
  onBulkExport,
}: ClustersPageViewProps) {
  // Calculate stats
  const totalMembers = allClusters.reduce(
    (acc, c) => acc + (c.members?.length || 0),
    0
  );
  const unassignedMembers = people.filter(
    (p) =>
      p.username !== "admin" &&
      p.role !== "ADMIN" &&
      !allClusters.some((c) => c.members?.includes(Number(p.id)))
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#2D3748]">Clusters</h1>
            <p className="text-sm text-gray-600">
              Manage clusters and weekly reports
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === "clusters" && (
              <Button onClick={onCreateCluster}>Add Cluster</Button>
            )}
            {activeTab === "reports" && (
              <Button onClick={() => onOpenReportForm()}>Submit Report</Button>
            )}
          </div>
        </div>

        <ClusterContentTabs activeTab={activeTab} onTabChange={onTabChange} />

        {activeTab === "clusters" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className="bg-white rounded-lg border border-gray-200 p-6 py-4 shadow-sm"
                role="region"
                aria-label="Total Clusters"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 bg-blue-100 rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Total Clusters
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Total clusters value"
                    >
                      {allClusters.length}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Total number of clusters
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-white rounded-lg border border-gray-200 p-6 py-4 shadow-sm"
                role="region"
                aria-label="Total Members"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 bg-green-100 rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 14a4 4 0 10-8 0m8 0v1a2 2 0 002 2h1m-11-3v1a2 2 0 01-2 2H5m11-10a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Total Members
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Total members value"
                    >
                      {totalMembers}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Members across all clusters
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="bg-white rounded-lg border border-gray-200 p-6 py-4 shadow-sm"
                role="region"
                aria-label="Unassigned Members"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div
                      className="p-1.5 bg-orange-100 rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-5 h-5 text-orange-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p
                      className="text-sm font-medium text-gray-600"
                      aria-label="Metric label"
                    >
                      Unassigned Members
                    </p>
                    <p
                      className="text-2xl font-semibold text-gray-900"
                      aria-label="Unassigned members value"
                    >
                      {unassignedMembers}
                    </p>
                    <p
                      className="text-xs text-gray-500 mt-1"
                      aria-label="Metric description"
                    >
                      Members not in any cluster
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search clusters…"
                      value={clusterSearchQuery}
                      onChange={(e) => onClusterSearchChange(e.target.value)}
                      className={`w-full pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                        clusterSearchQuery ? "pr-10" : "pr-4"
                      }`}
                    />
                    {clusterSearchQuery && (
                      <button
                        type="button"
                        onClick={() => onClusterSearchChange("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Actions and Filter/Sort Buttons */}
                <div className="flex items-center gap-3 ml-4">
                  {/* Selection Mode Toggle */}
                  <button
                    onClick={onToggleSelectionMode}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      isSelectionMode
                        ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 mr-2 ${
                        isSelectionMode ? "text-blue-600" : "text-gray-500"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {isSelectionMode ? "Cancel Selection" : "Select"}
                  </button>
                  {/* Bulk Actions Menu */}
                  {isSelectionMode && selectedClusters.size > 0 && (
                    <BulkActionsMenu
                      onBulkDelete={onBulkDelete}
                      onBulkExport={onBulkExport}
                      selectedCount={selectedClusters.size}
                    />
                  )}
                  {/* Active Filters Display */}
                  {clusterActiveFilters.length > 0 && (
                    <div className="flex items-center gap-2">
                      {clusterActiveFilters.map((filter) => (
                        <span
                          key={filter.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                        >
                          {filter.label}
                          <button
                            onClick={() => onClusterFilterRemove(filter.id)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            <svg
                              className="w-3 h-3"
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
                        </span>
                      ))}
                      <button
                        onClick={onClusterClearFilters}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  )}

                  {/* Sort Button */}
                  <button
                    onClick={(e) =>
                      onClusterSortDropdown(
                        (
                          e.currentTarget as HTMLButtonElement
                        ).getBoundingClientRect()
                      )
                    }
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={
                          clusterSortOrder === "asc"
                            ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                            : "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                        }
                      />
                    </svg>
                    Sort {clusterSortOrder === "asc" ? "↑" : "↓"}
                  </button>

                  {/* Filter Button */}
                  <button
                    onClick={(e) =>
                      onClusterAddFilter(
                        (
                          e.currentTarget as HTMLButtonElement
                        ).getBoundingClientRect()
                      )
                    }
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Filter
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Clusters Grid */}
            {clustersLoading ? (
              <LoadingSpinner />
            ) : clusters.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No clusters found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {clusterSearchQuery || clusterActiveFilters.length > 0
                    ? "Try adjusting your search or filters to find clusters."
                    : "Get started by creating your first cluster."}
                </p>
                {!clusterSearchQuery && clusterActiveFilters.length === 0 && (
                  <div className="mt-6">
                    <Button onClick={onCreateCluster}>Create Cluster</Button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Select All Checkbox - Only show in selection mode */}
                {isSelectionMode && clusterPaginatedData.length > 0 && (
                  <div className="mb-4 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          selectedClusters.size ===
                            clusterPaginatedData.length &&
                          clusterPaginatedData.length > 0
                        }
                        onChange={onSelectAllClusters}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      Select All ({selectedClusters.size} selected)
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clusterPaginatedData.map((c) => (
                    <ClusterCard
                      key={c.id}
                      cluster={c as any}
                      peopleUI={peopleUI}
                      isSelected={selectedClusters.has(c.id.toString())}
                      isSelectionMode={isSelectionMode}
                      onSelect={() => onSelectCluster(c.id.toString())}
                      onView={() => onViewCluster(c)}
                      onEdit={() => onEditCluster(c)}
                      onDelete={() => onDeleteCluster(c)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            {clusters.length > 0 && (
              <Pagination
                currentPage={clusterCurrentPage}
                totalPages={clusterTotalPages}
                onPageChange={onClusterPageChange}
                itemsPerPage={clusterItemsPerPage}
                totalItems={clusters.length}
                onItemsPerPageChange={onClusterItemsPerPageChange}
                showItemsPerPage={true}
              />
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <ClusterReportsDashboard
            clusters={allClusters as any}
            externalShowForm={isReportFormOpen}
            externalSelectedCluster={reportSelectedCluster}
            externalEditingReport={editingReport}
            onFormClose={onCloseReportForm}
            onEditReport={onEditReport}
            onSetReportSelectedCluster={onSetReportSelectedCluster}
            onSubmitReport={async (data) => {
              // Convert data to ClusterWeeklyReportInput format
              const reportData: ClusterWeeklyReportInput = {
                cluster:
                  typeof data.cluster === "number"
                    ? data.cluster
                    : Number(data.cluster),
                year: data.year!,
                week_number: data.week_number!,
                meeting_date: data.meeting_date!,
                gathering_type: data.gathering_type!,
                members_attended: (data.members_attended || []).map((id: any) =>
                  typeof id === "number" ? id : Number(id)
                ),
                visitors_attended: (data.visitors_attended || []).map(
                  (id: any) => (typeof id === "number" ? id : Number(id))
                ),
                activities_held: data.activities_held || "",
                prayer_requests: data.prayer_requests || "",
                testimonies: data.testimonies || "",
                offerings: String(data.offerings || 0),
                highlights: data.highlights || "",
                lowlights: data.lowlights || "",
                submitted_by: data.submitted_by
                  ? typeof data.submitted_by === "number"
                    ? data.submitted_by
                    : Number(data.submitted_by)
                  : undefined,
              };

              if (editingReport) {
                await onUpdateReport(editingReport.id, reportData);
              } else {
                await onCreateReport(reportData);
              }
            }}
          />
        )}

        {/* Cluster Modal */}
        <Modal
          isOpen={isClusterModalOpen}
          onClose={onCloseClusterModal}
          title={
            clusterViewMode === "view"
              ? ""
              : editCluster
              ? "Edit Cluster"
              : "Create Cluster"
          }
          hideHeader={clusterViewMode === "view" && !!viewCluster}
        >
          {clusterViewMode === "view" && viewCluster ? (
            <ClusterView
              cluster={viewCluster as any}
              clusterMembers={peopleUI.filter((p) =>
                (viewCluster.members || []).includes(Number(p.id))
              )}
              clusterFamilies={families.filter((f) =>
                (viewCluster.families || []).includes(Number(f.id))
              )}
              coordinator={peopleUI.find(
                (p) => p.id === viewCluster.coordinator?.id?.toString()
              )}
              onEdit={() => {
                // This will be handled by the container
                onEditCluster(viewCluster);
              }}
              onDelete={() => onDeleteCluster(viewCluster)}
              onCancel={onCloseClusterModal}
              onClose={onCloseClusterModal}
              onAssignMembers={() => onOpenAssignMembers(viewCluster)}
              onSubmitReport={() => {
                // Switch to reports tab and open form with cluster selected
                onTabChange("reports");
                onOpenReportForm(viewCluster);
              }}
              onViewFamily={onViewFamily}
              onViewPerson={onViewPerson}
            />
          ) : (
            <ClusterForm
              initialData={editCluster || undefined}
              onSubmit={async (data) => {
                if (editCluster) {
                  await onUpdateClusterSubmit(data);
                } else {
                  await onCreateClusterSubmit(data);
                }
              }}
              onCancel={onCloseClusterModal}
              error={null}
              submitting={false}
            />
          )}
        </Modal>

        {/* Delete Cluster Confirmation */}
        <ConfirmationModal
          isOpen={clusterDeleteConfirmation.isOpen}
          onClose={onCloseDeleteConfirmation}
          onConfirm={onConfirmDeleteCluster}
          title="Delete Cluster"
          message={
            clusterDeleteConfirmation.cluster
              ? `Are you sure you want to delete "${
                  clusterDeleteConfirmation.cluster.name ||
                  clusterDeleteConfirmation.cluster.code
                }"? This will also delete all associated weekly reports. This action cannot be undone.`
              : "Are you sure you want to delete this cluster?"
          }
          confirmText="Delete Cluster"
          cancelText="Cancel"
          variant="danger"
          loading={clusterDeleteConfirmation.loading}
        />

        {/* Assign Members Modal */}
        {assignMembersModal.cluster && (
          <Modal
            isOpen={assignMembersModal.isOpen}
            onClose={onCloseAssignMembers}
            title="Assign Members to Cluster"
          >
            <AssignMembersModal
              cluster={assignMembersModal.cluster as any}
              peopleUI={peopleUI}
              isOpen={assignMembersModal.isOpen}
              onClose={onCloseAssignMembers}
              onAssignMembers={async (memberIds: string[]) => {
                await onAssignMembers(memberIds.map(Number));
              }}
            />
          </Modal>
        )}

        {/* Cluster Over Person Modal */}
        {showClusterOverPerson && clusterOverPerson && (
          <Modal
            isOpen={showClusterOverPerson}
            onClose={onCloseClusterOverPerson}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            <ClusterView
              cluster={clusterOverPerson as any}
              clusterMembers={peopleUI.filter((p) =>
                (clusterOverPerson.members || []).includes(Number(p.id))
              )}
              clusterFamilies={families.filter((f) =>
                (clusterOverPerson.families || []).includes(Number(f.id))
              )}
              coordinator={peopleUI.find(
                (p) => p.id === clusterOverPerson.coordinator?.id?.toString()
              )}
              onEdit={() => {
                onOpenEditClusterOverlay(clusterOverPerson);
              }}
              onDelete={() => {}}
              onCancel={onCloseClusterOverPerson}
              onClose={onCloseClusterOverPerson}
              onAssignMembers={() => onOpenAssignMembers(clusterOverPerson)}
              onSubmitReport={() => {
                // Switch to reports tab and open form with cluster selected
                onTabChange("reports");
                onOpenReportForm(clusterOverPerson);
              }}
              onViewFamily={onViewFamily}
              onViewPerson={onViewPerson}
            />
          </Modal>
        )}

        {/* Edit Cluster Overlay Modal */}
        {showEditClusterOverlay && editClusterOverlay && (
          <Modal
            isOpen={showEditClusterOverlay}
            onClose={onCloseEditClusterOverlay}
            title="Edit Cluster"
            className="!mt-0 z-[50]"
          >
            <ClusterForm
              initialData={editClusterOverlay}
              onSubmit={async (data) => {
                await onUpdateClusterOverlay(data);
              }}
              onCancel={onCloseEditClusterOverlay}
              error={null}
              submitting={false}
            />
          </Modal>
        )}

        {/* Filter Dropdown */}
        <ClusterFilterDropdown
          isOpen={showClusterFilterDropdown}
          onClose={onCloseClusterFilterDropdown}
          onSelectField={onClusterSelectField}
          position={clusterFilterDropdownPosition}
        />

        {/* Filter Card */}
        {selectedClusterField && (
          <ClusterFilterCard
            field={selectedClusterField}
            isOpen={showClusterFilterCard}
            onClose={onCloseClusterFilterCard}
            onApplyFilter={onClusterApplyFilter}
            position={clusterFilterCardPosition}
          />
        )}

        {/* Sort Dropdown */}
        <ClusterSortDropdown
          isOpen={showClusterSortDropdown}
          onClose={onCloseClusterSortDropdown}
          onSelectSort={onClusterSelectSort}
          position={clusterSortDropdownPosition}
          currentSortBy={clusterSortBy}
          currentSortOrder={clusterSortOrder}
        />

        {/* Person Profile Modal (overlays View Cluster modal) */}
        {showPersonOverCluster && personOverCluster && (
          <Modal
            isOpen={showPersonOverCluster}
            onClose={onClosePersonOverCluster}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            <PersonProfile
              person={personOverCluster}
              clusters={allClusters as any}
              families={families}
              onViewFamily={(f) => {
                if (onViewFamily) {
                  onViewFamily(f);
                }
              }}
              onViewCluster={(c) => {
                // Open cluster view from person profile
                // Find the cluster in allClusters by ID
                const cluster = allClusters.find(
                  (cl) => cl.id === (c as any).id
                );
                if (cluster) {
                  onViewCluster(cluster);
                }
              }}
              onNoFamilyClick={() => {
                // No-op for now, can be implemented later if needed
              }}
              onNoClusterClick={() => {
                // No-op for now, can be implemented later if needed
              }}
              onEdit={() => {
                // Close person modal and could open edit modal if needed
                onClosePersonOverCluster();
              }}
              onDelete={() => {
                // Close person modal
                onClosePersonOverCluster();
              }}
              onCancel={onClosePersonOverCluster}
              onAddTimeline={() => {
                // Close person modal
                onClosePersonOverCluster();
              }}
              onClose={onClosePersonOverCluster}
              hideEditButton={true}
              hideDeleteButton={true}
            />
          </Modal>
        )}

        {/* Family View Modal (overlays View Cluster modal) */}
        {showFamilyOverCluster && familyOverCluster && (
          <Modal
            isOpen={showFamilyOverCluster}
            onClose={onCloseFamilyOverCluster}
            title=""
            hideHeader
            className="!mt-0 z-[50]"
          >
            <FamilyView
              family={familyOverCluster}
              familyMembers={peopleUI.filter((p) =>
                familyOverCluster.members.includes(p.id)
              )}
              clusters={allClusters as any}
              onEdit={() => {
                // Close family modal, could open edit modal if needed
                onCloseFamilyOverCluster();
              }}
              onDelete={() => {
                // Close family modal
                onCloseFamilyOverCluster();
              }}
              onCancel={onCloseFamilyOverCluster}
              onClose={onCloseFamilyOverCluster}
              hideEditButton={true}
              hideDeleteButton={true}
            />
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

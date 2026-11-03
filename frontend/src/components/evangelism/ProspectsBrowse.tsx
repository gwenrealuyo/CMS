"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/src/components/ui/Modal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import Pagination from "@/src/components/ui/Pagination";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import ProspectsTable from "@/src/components/evangelism/ProspectsTable";
import ProspectProgressForm from "@/src/components/evangelism/ProspectProgressForm";
import { useProspects } from "@/src/hooks/useEvangelism";
import { useAuth } from "@/src/contexts/AuthContext";
import { canHardDelete } from "@/src/lib/canHardDelete";
import { canWriteEvangelismRecords } from "@/src/lib/evangelism/evangelismPermissions";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { TOOLBAR_CARD_CLASS } from "@/src/lib/toolbarStyles";
import { Cluster } from "@/src/types/cluster";
import { Prospect } from "@/src/types/evangelism";

const STAGE_OPTIONS = [
  { value: "INVITED", label: "Invited" },
  { value: "all_active", label: "All active" },
  { value: "ATTENDED", label: "Attended" },
  { value: "TAKEN_NCC", label: "NCC" },
  { value: "BAPTIZED", label: "Baptized" },
  { value: "RECEIVED_HG", label: "Received HG" },
  { value: "REACHED", label: "Reached" },
  { value: "dropped", label: "Dropped off" },
] as const;

type StageFilter = (typeof STAGE_OPTIONS)[number]["value"];

const FILTER_SELECT_CLASS =
  "block h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-ring focus:border-transparent";

interface ProspectsBrowseProps {
  clusters: Cluster[];
  /** Page-header branch id; "" means all branches. */
  branch?: number | "";
  highlightProspectId?: string | null;
  initialClusterId?: string | null;
}

export default function ProspectsBrowse({
  clusters,
  branch = "",
  highlightProspectId,
  initialClusterId,
}: ProspectsBrowseProps) {
  const { user } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const canWrite = canWriteEvangelismRecords({ user, moduleEnabled });
  const userCanHardDelete = canHardDelete(user);

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("INVITED");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [clusterFilter, setClusterFilter] = useState<string>(
    initialClusterId ? String(initialClusterId) : "all",
  );
  const [progressProspect, setProgressProspect] = useState<Prospect | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchValue]);

  useEffect(() => {
    if (initialClusterId) {
      setClusterFilter(String(initialClusterId));
    }
  }, [initialClusterId]);

  useEffect(() => {
    setClusterFilter((prev) => {
      if (prev === "all" || !branch) return prev;
      const stillValid = clusters.some(
        (cluster) =>
          String(cluster.id) === prev &&
          cluster.branch != null &&
          Number(cluster.branch) === Number(branch),
      );
      return stillValid ? prev : "all";
    });
  }, [branch, clusters]);

  const apiFilters = useMemo(() => {
    const filters: {
      pipeline_stage?: string;
      is_dropped_off?: boolean;
      branch?: number | string;
      cluster?: number | string;
      source?: string;
      search?: string;
    } = {
      is_dropped_off: stageFilter === "dropped" ? true : false,
    };
    if (stageFilter !== "all_active" && stageFilter !== "dropped") {
      filters.pipeline_stage = stageFilter;
    }
    if (branch !== "") {
      filters.branch = branch;
    }
    if (clusterFilter !== "all") {
      filters.cluster = clusterFilter;
    }
    if (sourceFilter !== "all") {
      filters.source = sourceFilter;
    }
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    return filters;
  }, [stageFilter, branch, clusterFilter, sourceFilter, debouncedSearch]);

  const {
    prospects,
    totalCount,
    loading,
    error,
    fetchProspects,
    deleteProspect,
  } = useProspects(apiFilters, {
    page: currentPage,
    pageSize: itemsPerPage,
    fetchAll: false,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    stageFilter,
    branch,
    clusterFilter,
    sourceFilter,
    debouncedSearch,
    itemsPerPage,
  ]);

  useEffect(() => {
    if (!highlightProspectId) return;
    const el = document.getElementById(`prospect-${highlightProspectId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightProspectId, prospects]);

  const clustersForBranch = useMemo(() => {
    if (branch === "") return clusters;
    return clusters.filter(
      (cluster) => Number(cluster.branch) === Number(branch),
    );
  }, [clusters, branch]);

  const clusterOptions = useMemo(
    () => [
      { value: "all", label: "All clusters" },
      ...clustersForBranch.map((cluster) => ({
        value: String(cluster.id),
        label: cluster.name || "Untitled Cluster",
        clusterCode: cluster.code || undefined,
        clusterBranchId:
          cluster.branch != null ? Number(cluster.branch) : null,
      })),
    ],
    [clustersForBranch],
  );

  return (
    <div className="space-y-6">
      <div className={TOOLBAR_CARD_CLASS}>
        <div className="flex flex-col gap-3">
          <ToolbarSearch
            fullWidth
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search prospects…"
            ariaLabel="Search prospects"
          />
          <div className="md:hidden">
            <ViewModeToggle
              fullWidth
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {viewMode === "table" && (
              <p className="mt-2 text-xs text-gray-500">
                Table scrolls horizontally.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3 tablet:grid-cols-3">
            <div className="min-w-0 w-full">
              <ScalableSelect
                options={clusterOptions}
                value={clusterFilter || "all"}
                onChange={(value) => setClusterFilter(value || "all")}
                placeholder="All clusters"
                searchPlaceholder="Search clusters..."
                className="block w-full min-w-0 [&_button]:rounded-lg [&_button]:shadow-none"
                showSearch
                maxHeight={220}
                emptyMessage="No clusters found"
                virtualizeThreshold={50}
              />
            </div>
            <div className="min-w-0 w-full">
              <select
                aria-label="Pipeline stage"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                className={FILTER_SELECT_CLASS}
              >
                {STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 w-full">
              <select
                aria-label="Source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={FILTER_SELECT_CLASS}
              >
                <option value="all">All sources</option>
                <option value="cluster">Cluster only</option>
                <option value="evangelism">Evangelism group</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : prospects.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No prospects match these filters.
        </p>
      ) : (
        <>
          <ProspectsTable
            prospects={prospects}
            highlightId={highlightProspectId}
            mobileCardView={effectiveViewMode === "cards"}
            onUpdateProgress={
              canWrite ? (prospect) => setProgressProspect(prospect) : undefined
            }
            onDelete={
              userCanHardDelete
                ? async (prospect) => {
                    await deleteProspect(prospect.id);
                    await fetchProspects();
                  }
                : undefined
            }
          />
          {totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(totalCount / itemsPerPage) || 1)}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={totalCount}
              onItemsPerPageChange={setItemsPerPage}
              showItemsPerPage
            />
          )}
        </>
      )}

      {progressProspect && (
        <Modal
          isOpen
          title="Mark attended"
          onClose={() => setProgressProspect(null)}
        >
          <ProspectProgressForm
            prospect={progressProspect}
            onCancel={() => setProgressProspect(null)}
            onSuccess={() => {
              setProgressProspect(null);
              fetchProspects();
            }}
          />
        </Modal>
      )}

      <p className="text-xs text-gray-500">
        Invited visitors are stored as prospects until they attend. After
        attendance they keep a pipeline row here and a{" "}
        <Link href="/people" className="text-primary hover:underline">
          People
        </Link>{" "}
        profile.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Modal from "@/src/components/ui/Modal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { LockedControlTooltip } from "@/src/components/ui/LockedControlTooltip";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import ProspectsTable from "@/src/components/evangelism/ProspectsTable";
import ProspectProgressForm from "@/src/components/evangelism/ProspectProgressForm";
import { useProspects } from "@/src/hooks/useEvangelism";
import { useAuth } from "@/src/contexts/AuthContext";
import { canWriteEvangelism } from "@/src/lib/evangelism/evangelismPermissions";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import {
  canChangeProspectsBranchFilter,
  defaultProspectsListBranch,
  EVANGELISM_BRANCH_LOCKED_HINT,
} from "@/src/lib/evangelismBranchFilter";
import { TOOLBAR_CARD_CLASS } from "@/src/lib/toolbarStyles";
import { Branch } from "@/src/types/branch";
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
  "block h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-sm text-gray-900 focus:ring-2 focus:ring-ring focus:border-transparent";

interface ProspectsBrowseProps {
  branches: Branch[];
  clusters: Cluster[];
  highlightProspectId?: string | null;
  initialClusterId?: string | null;
}

export default function ProspectsBrowse({
  branches,
  clusters,
  highlightProspectId,
  initialClusterId,
}: ProspectsBrowseProps) {
  const { user, isSeniorCoordinator } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const canWrite = canWriteEvangelism({ user, moduleEnabled });
  const canChangeBranch = canChangeProspectsBranchFilter(
    user,
    isSeniorCoordinator,
  );

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("INVITED");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [clusterFilter, setClusterFilter] = useState<string>(
    initialClusterId ? String(initialClusterId) : "all",
  );
  const [branchFilter, setBranchFilter] = useState<number | "all">(
    defaultProspectsListBranch(user),
  );
  const [progressProspect, setProgressProspect] = useState<Prospect | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;
  const branchUserSyncRef = useRef<number | undefined>(undefined);

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
    if (!user) {
      branchUserSyncRef.current = undefined;
      return;
    }
    if (branchUserSyncRef.current !== user.id) {
      branchUserSyncRef.current = user.id;
      setBranchFilter(defaultProspectsListBranch(user));
      return;
    }
    if (!canChangeBranch && user.branch != null) {
      setBranchFilter(user.branch);
    }
  }, [user, canChangeBranch]);

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
    if (branchFilter !== "all") {
      filters.branch = branchFilter;
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
  }, [stageFilter, branchFilter, clusterFilter, sourceFilter, debouncedSearch]);

  const { prospects, loading, error, fetchProspects } = useProspects(apiFilters);

  useEffect(() => {
    if (!highlightProspectId) return;
    const el = document.getElementById(`prospect-${highlightProspectId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightProspectId, prospects]);

  const clustersForBranch = useMemo(() => {
    if (branchFilter === "all") return clusters;
    return clusters.filter(
      (cluster) => Number(cluster.branch) === Number(branchFilter),
    );
  }, [clusters, branchFilter]);

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

  const filterSelectClass = canChangeBranch
    ? FILTER_SELECT_CLASS
    : `${FILTER_SELECT_CLASS} pointer-events-none cursor-default`;

  const branchSelect = (
    <select
      aria-label="Branch"
      aria-disabled={!canChangeBranch}
      tabIndex={canChangeBranch ? 0 : -1}
      value={branchFilter === "all" ? "all" : String(branchFilter)}
      onChange={(e) => {
        if (!canChangeBranch) return;
        const value = e.target.value;
        setBranchFilter(value === "all" ? "all" : Number(value));
        setClusterFilter("all");
      }}
      className={filterSelectClass}
    >
      {canChangeBranch ? (
        <>
          <option value="all">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>
              {branch.name}
            </option>
          ))}
        </>
      ) : user?.branch != null ? (
        <>
          {branches
            .filter((b) => Number(b.id) === Number(user.branch))
            .map((branch) => (
              <option key={branch.id} value={String(branch.id)}>
                {branch.name}
              </option>
            ))}
          {!branches.some((b) => Number(b.id) === Number(user.branch)) && (
            <option value={String(user.branch)}>
              {user.branch_name?.trim() || `Branch #${user.branch}`}
            </option>
          )}
        </>
      ) : (
        <option value="all">No branch assigned</option>
      )}
    </select>
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
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 w-full">
              {canChangeBranch ? (
                branchSelect
              ) : (
                <LockedControlTooltip
                  label={EVANGELISM_BRANCH_LOCKED_HINT}
                  wrapperClassName="block w-full min-w-0 cursor-default"
                >
                  {branchSelect}
                </LockedControlTooltip>
              )}
            </div>
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
        <ProspectsTable
          prospects={prospects}
          highlightId={highlightProspectId}
          mobileCardView={effectiveViewMode === "cards"}
          onUpdateProgress={
            canWrite ? (prospect) => setProgressProspect(prospect) : undefined
          }
        />
      )}

      {progressProspect && (
        <Modal
          isOpen
          title="Update progress"
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

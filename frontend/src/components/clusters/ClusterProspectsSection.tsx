"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/src/components/ui/Modal";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import ProspectsTable from "@/src/components/evangelism/ProspectsTable";
import { getInitialListViewMode, useIsMdUp } from "@/src/lib/listViewMode";
import ProspectProgressForm from "@/src/components/evangelism/ProspectProgressForm";
import { useProspects } from "@/src/hooks/useEvangelism";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import { canBrowseProspects, canWriteEvangelism } from "@/src/lib/evangelism/evangelismPermissions";
import { Prospect } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { TOOLBAR_BRANCH_SELECT_CLASS } from "@/src/lib/toolbarStyles";

export default function ClusterProspectsSection({
  clusterId,
  compact = false,
  onViewPerson,
}: {
  clusterId: number | string;
  compact?: boolean;
  onViewPerson?: (person: Person) => void;
}) {
  const { user, isSeniorCoordinator } = useAuth();
  const { moduleEnabled } = useModuleSettings();
  const canWrite = canWriteEvangelism({ user, moduleEnabled });
  const showEvangelismLink = canBrowseProspects({ user, isSeniorCoordinator });
  const [stageFilter, setStageFilter] = useState<"INVITED" | "all_active">(
    "INVITED",
  );
  const [progressProspect, setProgressProspect] = useState<Prospect | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("cards"),
  );
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  const filters = useMemo(
    () => ({
      cluster: clusterId,
      pipeline_stage: stageFilter === "INVITED" ? "INVITED" : undefined,
      is_dropped_off: false,
    }),
    [clusterId, stageFilter],
  );
  const { prospects, loading, fetchProspects } = useProspects(filters);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-gray-900 md:text-lg">
            Prospects ({prospects.length})
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="Prospect stage"
              value={stageFilter}
              onChange={(e) =>
                setStageFilter(e.target.value as "INVITED" | "all_active")
              }
              className={TOOLBAR_BRANCH_SELECT_CLASS}
            >
              <option value="INVITED">Invited</option>
              <option value="all_active">All active</option>
            </select>
            {showEvangelismLink && (
              <Link
                href={`/evangelism?tab=prospects&cluster=${clusterId}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
              >
                View in Evangelism
              </Link>
            )}
          </div>
        </div>
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
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : prospects.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {stageFilter === "INVITED"
            ? "No invited prospects for this cluster."
            : "No active prospects for this cluster."}
        </p>
      ) : (
        <ProspectsTable
          prospects={prospects}
          compact={compact}
          mobileCardView={effectiveViewMode === "cards"}
          onUpdateProgress={
            canWrite ? (prospect) => setProgressProspect(prospect) : undefined
          }
          onViewPerson={
            onViewPerson
              ? (prospect) => {
                  if (prospect.person) {
                    onViewPerson(prospect.person);
                  }
                }
              : undefined
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
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Modal from "@/src/components/ui/Modal";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import ProspectsTable from "@/src/components/evangelism/ProspectsTable";
import { useIsMdUp } from "@/src/lib/listViewMode";
import ProspectProgressForm from "@/src/components/evangelism/ProspectProgressForm";
import { useProspects } from "@/src/hooks/useEvangelism";
import { useAuth } from "@/src/contexts/AuthContext";
import { useModuleSettings } from "@/src/hooks/useModuleSettings";
import {
  canBrowseProspects,
  canWriteEvangelism,
} from "@/src/lib/evangelism/evangelismPermissions";
import { Prospect } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";

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
  const [progressProspect, setProgressProspect] = useState<Prospect | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const isMdUp = useIsMdUp();
  const effectiveViewMode: "table" | "cards" = isMdUp ? "table" : viewMode;

  const filters = useMemo(
    () => ({
      cluster: clusterId,
      pipeline_stage: "INVITED" as const,
      is_dropped_off: false,
    }),
    [clusterId],
  );
  const { prospects, loading, fetchProspects } = useProspects(filters);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-gray-900 md:text-lg">
            Prospects ({prospects.length})
          </h3>
          {showEvangelismLink && (
            <Link
              href={`/evangelism?tab=prospects&cluster=${clusterId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View prospects on Evangelism (opens in a new tab)"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              View
              <ArrowTopRightOnSquareIcon
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
            </Link>
          )}
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
          No invited visitors for this cluster. You can record them on a cluster
          or evangelism group weekly report.
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
    </div>
  );
}

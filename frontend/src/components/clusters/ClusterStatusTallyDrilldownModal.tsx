"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { PaginatedResponse } from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonFamilyLabel,
  formatPersonStatusLabel,
  getPersonFamilyChipClass,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import { ClusterStatusTallyDetailRow } from "@/src/types/cluster";

interface ClusterStatusTallyDrilldownModalProps {
  isOpen: boolean;
  title: string;
  requestKey: string | null;
  onClose: () => void;
  fetchPage: (
    page: number,
  ) => Promise<PaginatedResponse<ClusterStatusTallyDetailRow>>;
}

function formatStatusChangeSource(source?: string | null) {
  if (source === "MANUAL") return "Manual";
  if (source === "AUTO_ATTENDANCE") return "Auto attendance";
  if (source === "SYSTEM") return "System";
  return source?.trim() || null;
}

function buildDisplayName(row: ClusterStatusTallyDetailRow) {
  const formatted = formatPersonName({
    id: row.id,
    first_name: row.first_name || undefined,
    middle_name: row.middle_name || undefined,
    last_name: row.last_name || undefined,
    suffix: row.suffix || undefined,
    nickname: row.nickname || undefined,
    username: row.username || undefined,
  });
  if (formatted === "Unknown person" && row.display_name) {
    return row.display_name;
  }
  return formatted;
}

export default function ClusterStatusTallyDrilldownModal({
  isOpen,
  title,
  requestKey,
  onClose,
  fetchPage,
}: ClusterStatusTallyDrilldownModalProps) {
  const [rows, setRows] = useState<ClusterStatusTallyDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const requestSeqRef = useRef(0);

  const loadPage = useCallback(
    async (targetPage: number) => {
      const requestSeq = ++requestSeqRef.current;
      try {
        setLoading(true);
        setError(null);
        const response = await fetchPage(targetPage);
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setRows(response.results || []);
        setCount(response.count || 0);
        setHasNext(Boolean(response.next));
        setHasPrevious(Boolean(response.previous));
        setPage(targetPage);
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        console.error(err);
        setError("Failed to load records.");
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    if (!isOpen || !requestKey) {
      return;
    }
    loadPage(1);
  }, [isOpen, requestKey, loadPage]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-4 md:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading records...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            No records found.
          </div>
        ) : (
          <>
            <div className="shrink-0 text-xs text-gray-500">
              Showing {rows.length} of {count} records
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 md:max-h-[min(50vh,28rem)]">
              {rows.map((row) => {
                const fromLabel = row.from_status
                  ? formatPersonStatusLabel(row.from_status)
                  : null;
                const toLabel = formatPersonStatusLabel(
                  row.to_status || row.status,
                );
                const dateLabel = formatLocaleDate(row.changed_at);
                const sourceLabel = formatStatusChangeSource(row.source);
                const familyLabel = formatPersonFamilyLabel(row.family_names);
                const hasFamily = (row.family_names?.length ?? 0) > 0;
                const transitionClass = row.in_window
                  ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-2 ring-offset-1 ring-gray-700"
                  : "rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700";
                return (
                  <div
                    key={row.id}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <p className="min-w-0 break-words text-sm font-medium text-gray-900">
                      {buildDisplayName(row)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {row.role && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {row.role}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getPersonStatusColor(
                          row.status,
                        )}`}
                      >
                        {formatPersonStatusLabel(row.status)}
                      </span>
                      <span
                        className={getPersonFamilyChipClass(hasFamily)}
                        title={familyLabel}
                      >
                        {familyLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className={`${transitionClass} max-w-full break-words`}>
                        {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
                        {dateLabel ? ` · ${dateLabel}` : ""}
                      </span>
                      {sourceLabel && (
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {sourceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <Button
                variant="tertiary"
                className="min-h-[40px] px-3 py-1.5 text-xs sm:min-h-[36px]"
                disabled={!hasPrevious}
                onClick={() => loadPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="tertiary"
                className="min-h-[40px] px-3 py-1.5 text-xs sm:min-h-[36px]"
                disabled={!hasNext}
                onClick={() => loadPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

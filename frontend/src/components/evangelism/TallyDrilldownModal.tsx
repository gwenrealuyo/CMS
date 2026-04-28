"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { PaginatedResponse } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import { EvangelismTallyDrilldownRow } from "@/src/types/evangelism";

interface TallyDrilldownModalProps {
  isOpen: boolean;
  title: string;
  requestKey: string | null;
  onClose: () => void;
  fetchPage: (page: number) => Promise<PaginatedResponse<EvangelismTallyDrilldownRow>>;
}

export default function TallyDrilldownModal({
  isOpen,
  title,
  requestKey,
  onClose,
  fetchPage,
}: TallyDrilldownModalProps) {
  const [rows, setRows] = useState<EvangelismTallyDrilldownRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const requestSeqRef = useRef(0);

  const getEventDateLabel = (metric: EvangelismTallyDrilldownRow["metric"]) => {
    switch (metric) {
      case "invited":
        return "Invited";
      case "attended":
        return "Attended";
      case "students":
        return "NCC";
      case "baptized":
        return "Baptism Date";
      case "received_hg":
        return "Received HG";
      case "reached":
        return "Reached";
      case "members":
      case "visitors":
        return "Meeting";
      default:
        return "Date";
    }
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : null;

  const shouldShowEventDateChip = (metric: EvangelismTallyDrilldownRow["metric"]) =>
    metric === "members" || metric === "visitors" || metric === "students";

  const buildDisplayName = (row: EvangelismTallyDrilldownRow) => {
    const formatted = formatPersonName({
      id: row.person_id ?? row.id,
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
  };

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
    [fetchPage]
  );

  useEffect(() => {
    if (!isOpen || !requestKey) {
      return;
    }
    loadPage(1);
  }, [isOpen, requestKey, loadPage]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-3">
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading records...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
            No records found.
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500">Showing {rows.length} of {count} records</div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div key={`${row.entity_type}-${row.id}`} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {buildDisplayName(row)}
                        </p>
                        {row.role && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {row.role}
                          </span>
                        )}
                        {row.status && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                            {row.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                      {row.member_id?.trim() || "No Member ID"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.pipeline_stage && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                        {row.pipeline_stage}
                      </span>
                    )}
                    {formatDate(row.date_first_invited) && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        Invited {formatDate(row.date_first_invited)}
                      </span>
                    )}
                    {formatDate(row.date_first_attended) && (
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                        Attended {formatDate(row.date_first_attended)}
                      </span>
                    )}
                    {formatDate(row.lessons_finished_at) && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                        Lessons Finished {formatDate(row.lessons_finished_at)}
                      </span>
                    )}
                    {formatDate(row.water_baptism_date) && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Baptism Date: {formatDate(row.water_baptism_date)}
                      </span>
                    )}
                    {formatDate(row.spirit_baptism_date) && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Received HG {formatDate(row.spirit_baptism_date)}
                      </span>
                    )}
                    {formatDate(row.reached_date) && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        Reached {formatDate(row.reached_date)}
                      </span>
                    )}
                    {formatDate(row.event_date) && shouldShowEventDateChip(row.metric) && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {getEventDateLabel(row.metric)} {formatDate(row.event_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="tertiary"
                className="min-h-[36px] px-3 py-1.5 text-xs"
                disabled={!hasPrevious}
                onClick={() => loadPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="tertiary"
                className="min-h-[36px] px-3 py-1.5 text-xs"
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


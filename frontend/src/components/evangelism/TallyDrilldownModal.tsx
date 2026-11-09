"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { PaginatedResponse } from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonClusterLabel,
  formatPersonFamilyLabel,
  getPersonClusterChipClass,
  getPersonFamilyChipClass,
} from "@/src/lib/personStatus";
import { getIsoWeekPartsFromDateString } from "@/src/lib/isoWeek";
import { EvangelismTallyDrilldownRow } from "@/src/types/evangelism";

interface TallyDrilldownModalProps {
  isOpen: boolean;
  title: string;
  requestKey: string | null;
  onClose: () => void;
  fetchPage: (
    page: number,
  ) => Promise<PaginatedResponse<EvangelismTallyDrilldownRow>>;
  /** When set (Unique HC), emphasize milestone chips whose date falls in these months. */
  highlightMonths?: number[] | null;
  /** When set (Unique HC), emphasize milestone chips whose date falls in these ISO weeks. */
  highlightWeeks?: number[] | null;
  highlightYear?: number | null;
}

export default function TallyDrilldownModal({
  isOpen,
  title,
  requestKey,
  onClose,
  fetchPage,
  highlightMonths = null,
  highlightWeeks = null,
  highlightYear = null,
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
      case "unique_hc":
        return "Unique HC";
      case "members":
      case "visitors":
        return "Meeting";
      default:
        return "Date";
    }
  };

  const formatDate = (value?: string | null) => formatLocaleDate(value);

  const isInHighlightWindow = (value?: string | null) => {
    if (highlightYear == null || !value) {
      return false;
    }
    if (highlightWeeks?.length) {
      const parts = getIsoWeekPartsFromDateString(value.slice(0, 10));
      return (
        parts != null &&
        parts.year === highlightYear &&
        highlightWeeks.includes(parts.week)
      );
    }
    if (!highlightMonths?.length) {
      return false;
    }
    const datePart = value.slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      return false;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    return year === highlightYear && highlightMonths.includes(month);
  };

  const chipClassName = (base: string, value?: string | null) =>
    isInHighlightWindow(value)
      ? `${base} ring-2 ring-offset-1 ring-gray-700 font-semibold`
      : base;

  const shouldShowEventDateChip = (
    metric: EvangelismTallyDrilldownRow["metric"],
  ) => metric === "members" || metric === "visitors";

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
                const familyLabel = formatPersonFamilyLabel(row.family_names);
                const hasFamily = (row.family_names?.length ?? 0) > 0;
                return (
                  <div
                    key={`${row.entity_type}-${row.id}`}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                      <p className="min-w-0 break-words text-sm font-medium text-gray-900">
                        {buildDisplayName(row)}
                      </p>
                      <span className="chip-gray-sm w-fit shrink-0 text-[11px] uppercase tracking-wide">
                        {row.member_id?.trim() || "No Member ID"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {row.role && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {row.role}
                        </span>
                      )}
                      {row.status && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          {row.status}
                        </span>
                      )}
                      <span
                        className={getPersonClusterChipClass(
                          (row.cluster_codes?.length ?? 0) > 0,
                        )}
                      >
                        {formatPersonClusterLabel(row.cluster_codes)}
                      </span>
                      <span
                        className={getPersonFamilyChipClass(hasFamily)}
                        title={familyLabel}
                      >
                        {familyLabel}
                      </span>
                      {row.cord_name && (
                        <span className="inline-flex max-w-full items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800 break-words">
                          {row.cord_name}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                      {row.pipeline_stage && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                          {row.pipeline_stage}
                        </span>
                      )}
                      {formatDate(row.date_first_invited) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700",
                            row.date_first_invited,
                          )}
                        >
                          Invited {formatDate(row.date_first_invited)}
                        </span>
                      )}
                      {formatDate(row.date_first_attended) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700",
                            row.date_first_attended,
                          )}
                        >
                          Attended {formatDate(row.date_first_attended)}
                        </span>
                      )}
                      {formatDate(row.lessons_started_at) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800",
                            row.lessons_started_at,
                          )}
                        >
                          NCC {formatDate(row.lessons_started_at)}
                        </span>
                      )}
                      {(formatDate(row.lessons_finished_at) ||
                        row.has_finished_lessons) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700",
                            row.lessons_finished_at,
                          )}
                        >
                          {formatDate(row.lessons_finished_at)
                            ? `Lessons Finished ${formatDate(row.lessons_finished_at)}`
                            : "Lessons Finished (date unknown)"}
                        </span>
                      )}
                      {formatDate(row.water_baptism_date) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700",
                            row.water_baptism_date,
                          )}
                        >
                          Baptism {formatDate(row.water_baptism_date)}
                        </span>
                      )}
                      {formatDate(row.spirit_baptism_date) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700",
                            row.spirit_baptism_date,
                          )}
                        >
                          Holy Ghost {formatDate(row.spirit_baptism_date)}
                        </span>
                      )}
                      {formatDate(row.reached_date) && (
                        <span
                          className={chipClassName(
                            "rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700",
                            row.reached_date,
                          )}
                        >
                          Reached {formatDate(row.reached_date)}
                        </span>
                      )}
                      {formatDate(row.event_date) &&
                        shouldShowEventDateChip(row.metric) && (
                          <span
                            className={chipClassName(
                              "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700",
                              row.event_date,
                            )}
                          >
                            {getEventDateLabel(row.metric)}{" "}
                            {formatDate(row.event_date)}
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

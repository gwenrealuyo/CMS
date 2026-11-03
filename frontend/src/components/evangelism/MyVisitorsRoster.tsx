"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Button from "@/src/components/ui/Button";
import Pagination from "@/src/components/ui/Pagination";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import { evangelismApi } from "@/src/lib/api";
import { DESKTOP_MIN } from "@/src/lib/breakpoints";
import { formatLongDisplayDate, getLocalTodayDateString } from "@/src/lib/date";
import { useIsDesktopUp } from "@/src/lib/listViewMode";
import {
  LOW_PRIORITY_REASON_PLACEHOLDER,
  VISITOR_FOLLOW_UP_TASK_TYPES,
  visitorAffiliationClass,
  visitorAffiliationLabels,
  visitorFollowUpStatusClass,
  visitorFollowUpStatusLabel,
  visitorNeedsAttentionClass,
  visitorPipelineStageClass,
  visitorPipelineStageLabel,
} from "@/src/lib/visitorFollowUp";
import type {
  FollowUpTask,
  TaskType,
  VisitorFollowUpCase,
  VisitorFollowUpSummary,
} from "@/src/types/evangelism";

type Scope = "mine" | "group" | "branch";

type Props = {
  canUseOversightScope?: boolean;
  defaultScope?: Scope;
};

type TaskDraft = {
  task_type: TaskType;
  custom_label: string;
  due_date: string;
  notes: string;
};

function prospectLabel(row: VisitorFollowUpCase): string {
  const p = row.prospect;
  if (!p) return `Prospect #${row.id}`;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.facebook_name || `Prospect #${p.id}`;
}

function stageCode(row: VisitorFollowUpCase): string {
  return row.prospect?.pipeline_stage || "";
}

function stageLabel(row: VisitorFollowUpCase): string {
  return visitorPipelineStageLabel(
    row.prospect?.pipeline_stage,
    row.prospect?.pipeline_stage_display,
  );
}

function caseStatusLabel(row: VisitorFollowUpCase): string {
  return visitorFollowUpStatusLabel(
    row.case_status,
    row.case_status_display,
    row.closed_reason,
  );
}

function AffiliationChips({ row }: { row: VisitorFollowUpCase }) {
  const labels = visitorAffiliationLabels(row);
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((label) => (
        <span key={label} className={visitorAffiliationClass()}>
          {label}
        </span>
      ))}
    </>
  );
}

function unwrapList(payload: unknown): VisitorFollowUpCase[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as any).results)
  ) {
    return (payload as any).results;
  }
  return [];
}

function unwrapCount(payload: unknown, fallback: number): number {
  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as any).count === "number"
  ) {
    return (payload as any).count;
  }
  return fallback;
}

export default function MyVisitorsRoster({
  canUseOversightScope = false,
  defaultScope = "mine",
}: Props) {
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [rows, setRows] = useState<VisitorFollowUpCase[]>([]);
  const [summary, setSummary] = useState<VisitorFollowUpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "needs" | "low_priority">(
    "open",
  );
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    task_type: "PHONE_CALL",
    custom_label: "",
    due_date: getLocalTodayDateString(),
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showPauseForm, setShowPauseForm] = useState(false);
  const isDesktopUp = useIsDesktopUp();
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const showListPane = isDesktopUp || !mobileDetailOpen;
  const showDetailPane = isDesktopUp || mobileDetailOpen;

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchValue]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage) || 1);

  useEffect(() => {
    setCurrentPage(1);
    setMobileDetailOpen(false);
  }, [scope, filter, debouncedSearch, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selected) {
      setMobileDetailOpen(false);
    }
  }, [selected]);

  useEffect(() => {
    if (isDesktopUp) {
      setMobileDetailOpen(false);
    }
  }, [isDesktopUp]);

  useEffect(() => {
    if (!mobileDetailOpen || isDesktopUp) return;
    detailPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [mobileDetailOpen, selectedId, isDesktopUp]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = {
        scope,
        order: "quietest",
        page: currentPage,
        page_size: itemsPerPage,
      };
      if (filter === "needs") params.needs_attention = true;
      if (filter === "low_priority") params.case_status = "NO_ACTION";
      if (debouncedSearch) params.search = debouncedSearch;
      const [listRes, summaryRes] = await Promise.all([
        evangelismApi.listVisitorFollowUpCases(params),
        evangelismApi.getVisitorFollowUpSummary({ scope }),
      ]);
      const list = unwrapList(listRes.data);
      const count = unwrapCount(listRes.data, list.length);
      setRows(list);
      setTotalCount(count);
      setSummary(summaryRes.data as VisitorFollowUpSummary);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        // Auto-select first row on desktop split view only.
        if (typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN) {
          return list[0]?.id ?? null;
        }
        return null;
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load My Visitors.");
      setRows([]);
      setTotalCount(0);
      setSummary(null);
      setMobileDetailOpen(false);
    } finally {
      setLoading(false);
    }
  }, [scope, filter, debouncedSearch, currentPage, itemsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setShowPauseForm(false);
    setPauseReason("");
  }, [selectedId]);

  const addTask = async () => {
    if (!selected) return;
    if (!taskDraft.due_date) {
      toast.error("Pick a due date for the task.");
      return;
    }
    if (taskDraft.task_type === "OTHER" && !taskDraft.custom_label.trim()) {
      toast.error("Add a short label for Other tasks.");
      return;
    }
    setSaving(true);
    try {
      await evangelismApi.createFollowUpTask({
        prospect_id: selected.prospect.id,
        case_id: selected.id,
        task_type: taskDraft.task_type,
        custom_label: taskDraft.custom_label,
        due_date: taskDraft.due_date,
        notes: taskDraft.notes,
        status: "PENDING",
        priority: "MEDIUM",
      });
      toast.success("Task added");
      setTaskDraft({
        task_type: "PHONE_CALL",
        custom_label: "",
        due_date: getLocalTodayDateString(),
        notes: "",
      });
      await load();
    } catch (err: any) {
      const data = err?.response?.data;
      const msg =
        data?.custom_label?.[0] ||
        data?.assigned_to_id?.[0] ||
        data?.detail ||
        "Could not add task.";
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const completeTask = async (task: FollowUpTask) => {
    try {
      await evangelismApi.completeTask(task.id);
      toast.success("Task completed");
      await load();
    } catch {
      toast.error("Could not complete task.");
    }
  };

  const markLowPriority = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await evangelismApi.markVisitorFollowUpLowPriority(selected.id, {
        reason: pauseReason.trim(),
      });
      toast.success("Marked low priority");
      setShowPauseForm(false);
      setPauseReason("");
      await load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail || "Could not mark low priority.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resumeCase = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await evangelismApi.resumeVisitorFollowUp(selected.id);
      toast.success("Follow-up resumed");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not resume.");
    } finally {
      setSaving(false);
    }
  };

  const markDeceased = async () => {
    if (!selected) return;
    const name = prospectLabel(selected);
    const ok = window.confirm(
      `Mark ${name} as deceased? This closes their visitor follow-up` +
        (selected.prospect?.person
          ? " and updates their person profile status to Deceased."
          : "."),
    );
    if (!ok) return;
    setSaving(true);
    try {
      await evangelismApi.markVisitorFollowUpDeceased(selected.id);
      toast.success("Marked deceased");
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Could not mark deceased.");
    } finally {
      setSaving(false);
    }
  };

  const isLowPriority = selected?.case_status === "NO_ACTION";
  const isClosed = selected?.case_status === "CLOSED";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">My Visitors</h2>
          <p className="text-sm text-slate-600">
            Follow up invited and attending visitors until they enroll in
            Lessons. Status updates from your tasks. Needs attention after 14
            days without activity (including report attendance).
          </p>
        </div>
        {canUseOversightScope ? (
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Scope
            </label>
            <ScalableSelect
              value={scope}
              onChange={(value) => setScope(value as Scope)}
              showSearch={false}
              options={[
                { value: "mine", label: "Mine" },
                { value: "group", label: "My groups / clusters" },
                { value: "branch", label: "Branch" },
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["open", "Open caseload", summary?.open_caseload],
            ["needs", "Needs attention", summary?.needs_attention],
            [
              "low_priority",
              "Low priority",
              summary?.low_priority ?? summary?.no_action,
            ],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              filter === key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
          >
            <div className="text-xs uppercase tracking-wide opacity-80">
              {label}
            </div>
            <div className="text-2xl font-semibold">{count ?? "—"}</div>
          </button>
        ))}
      </div>

      <ToolbarSearch
        fullWidth
        value={searchValue}
        onChange={setSearchValue}
        placeholder="Search by name, cluster, or group…"
        ariaLabel="Search My Visitors"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div
            className={`overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2 ${
              showListPane ? "block" : "hidden"
            }`}
          >
            {rows.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                {debouncedSearch
                  ? `No visitors match “${debouncedSearch}”.`
                  : "No visitor cases in this view."}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const active = row.id === selectedId;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id);
                            setMobileDetailOpen(true);
                          }}
                          className={`flex w-full min-h-[56px] flex-col gap-1 px-4 py-3 text-left ${
                            active ? "bg-slate-50" : "hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-slate-900">
                              {prospectLabel(row)}
                            </span>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <span
                                className={visitorPipelineStageClass(
                                  stageCode(row),
                                )}
                              >
                                {stageLabel(row)}
                              </span>
                              <span
                                className={visitorFollowUpStatusClass(
                                  row.case_status,
                                  row.closed_reason,
                                )}
                              >
                                {caseStatusLabel(row)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <AffiliationChips row={row} />
                            <span>
                              {row.days_since_activity != null
                                ? `${row.days_since_activity}d since activity`
                                : "No activity date"}
                            </span>
                            {row.needs_attention ? (
                              <span className={visitorNeedsAttentionClass()}>
                                Needs attention
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {totalCount > 0 ? (
                  <div className="border-t border-slate-100 px-3 py-3">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={totalCount}
                      onItemsPerPageChange={setItemsPerPage}
                      showItemsPerPage
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div
            ref={detailPanelRef}
            className={`rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3 ${
              showDetailPane ? "block" : "hidden lg:block"
            }`}
          >
            {!isDesktopUp && selected ? (
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
              >
                <span aria-hidden="true">←</span>
                Back to list
              </button>
            ) : null}
            {!selected ? (
              <p className="text-sm text-slate-500">
                Select a visitor to add follow-up tasks.
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {prospectLabel(selected)}
                    </h3>
                    <span
                      className={visitorPipelineStageClass(stageCode(selected))}
                    >
                      {stageLabel(selected)}
                    </span>
                    <span
                      className={visitorFollowUpStatusClass(
                        selected.case_status,
                        selected.closed_reason,
                      )}
                    >
                      {caseStatusLabel(selected)}
                    </span>
                    {selected.needs_attention ? (
                      <span className={visitorNeedsAttentionClass()}>
                        Needs attention
                      </span>
                    ) : null}
                  </div>
                  {(visitorAffiliationLabels(selected).length > 0 ||
                    selected.last_activity_date ||
                    selected.assigned_to ||
                    selected.prospect?.invited_by) && (
                    <div className="mt-2 space-y-1.5">
                      {visitorAffiliationLabels(selected).length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AffiliationChips row={selected} />
                        </div>
                      ) : null}
                      <p className="text-sm text-slate-600">
                        {selected.last_activity_date
                          ? `Last activity ${formatLongDisplayDate(selected.last_activity_date) ?? selected.last_activity_date}`
                          : "No activity date"}
                        {selected.assigned_to ? (
                          <>
                            {" · Owner "}
                            <span className="font-medium text-slate-900">
                              {(selected.assigned_to as any).full_name ||
                                [
                                  (selected.assigned_to as any).first_name,
                                  (selected.assigned_to as any).last_name,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                            </span>
                          </>
                        ) : null}
                        {!selected.assigned_to &&
                        selected.prospect?.invited_by ? (
                          <>
                            {" · Inviter "}
                            <span className="font-semibold text-slate-900">
                              {(selected.prospect.invited_by as any)
                                .full_name ||
                                [
                                  (selected.prospect.invited_by as any)
                                    .first_name,
                                  (selected.prospect.invited_by as any)
                                    .last_name,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  )}
                </div>

                {isLowPriority ? (
                  <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Paused — low priority
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {selected.remarks
                            ? selected.remarks
                            : "Not actively following up right now. They stay on your list."}
                        </p>
                      </div>
                      <Button
                        onClick={() => void resumeCase()}
                        disabled={saving}
                        className="shrink-0"
                      >
                        Resume follow-up
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!isClosed ? (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-900">
                      Follow-up tasks
                    </h4>
                    <ul className="mb-4 space-y-2">
                      {(selected.tasks || []).length === 0 ? (
                        <li className="text-sm text-slate-500">
                          No tasks yet — add a call, visit, invite, or other
                          follow-up.
                        </li>
                      ) : (
                        (selected.tasks || []).map((task) => (
                          <li
                            key={task.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium text-slate-900">
                                {task.task_type === "OTHER" && task.custom_label
                                  ? task.custom_label
                                  : task.task_type_display || task.task_type}
                              </div>
                              <div className="text-xs text-slate-500">
                                Due {task.due_date} ·{" "}
                                {task.status_display || task.status}
                              </div>
                              {task.notes ? (
                                <div className="mt-1 text-slate-600">
                                  {task.notes}
                                </div>
                              ) : null}
                            </div>
                            {task.status === "PENDING" ||
                            task.status === "IN_PROGRESS" ? (
                              <Button
                                variant="secondary"
                                onClick={() => void completeTask(task)}
                              >
                                Complete
                              </Button>
                            ) : null}
                          </li>
                        ))
                      )}
                    </ul>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block min-w-0 text-sm">
                        <span className="mb-1 block text-slate-600">
                          Task type
                        </span>
                        <ScalableSelect
                          value={taskDraft.task_type}
                          onChange={(value) =>
                            setTaskDraft({
                              ...taskDraft,
                              task_type: value as TaskType,
                            })
                          }
                          showSearch={false}
                          options={VISITOR_FOLLOW_UP_TASK_TYPES.map((o) => ({
                            value: o.value,
                            label: o.label,
                          }))}
                        />
                      </label>
                      <label className="block min-w-0 text-sm">
                        <span className="mb-1 block text-slate-600">
                          Due date
                        </span>
                        <input
                          type="date"
                          className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                          value={taskDraft.due_date}
                          onChange={(e) =>
                            setTaskDraft({
                              ...taskDraft,
                              due_date: e.target.value,
                            })
                          }
                        />
                      </label>
                      {taskDraft.task_type === "OTHER" ? (
                        <label className="block text-sm sm:col-span-2">
                          <span className="mb-1 block text-slate-600">
                            Custom label
                          </span>
                          <input
                            className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            value={taskDraft.custom_label}
                            onChange={(e) =>
                              setTaskDraft({
                                ...taskDraft,
                                custom_label: e.target.value,
                              })
                            }
                          />
                        </label>
                      ) : null}
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-slate-600">Notes</span>
                        <input
                          className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                          value={taskDraft.notes}
                          onChange={(e) =>
                            setTaskDraft({
                              ...taskDraft,
                              notes: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button onClick={() => void addTask()} disabled={saving}>
                        Add task
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!isClosed ? (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    {!isLowPriority ? (
                      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
                        <p className="text-sm font-semibold text-amber-950">
                          Pause follow-up
                        </p>
                        <p className="mt-0.5 text-xs text-amber-900/80">
                          Soft pause when they expressed disinterest — stays on
                          Low priority, not closed.
                        </p>
                        {showPauseForm ? (
                          <div className="mt-3 space-y-2">
                            <label className="block text-sm">
                              <span className="mb-1 block text-amber-950/80">
                                Reason (optional)
                              </span>
                              <input
                                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                                value={pauseReason}
                                onChange={(e) => setPauseReason(e.target.value)}
                                placeholder={LOW_PRIORITY_REASON_PLACEHOLDER}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => void markLowPriority()}
                                disabled={saving}
                                className="!bg-amber-600 !text-white hover:!bg-amber-500 disabled:!bg-amber-200 disabled:!text-amber-700/70"
                              >
                                Confirm pause
                              </Button>
                              <Button
                                variant="tertiary"
                                onClick={() => {
                                  setShowPauseForm(false);
                                  setPauseReason("");
                                }}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <Button
                              variant="tertiary"
                              onClick={() => setShowPauseForm(true)}
                              disabled={saving}
                              className="border-amber-300 text-amber-950 hover:bg-amber-100"
                            >
                              Mark low priority
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <details className="group rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                      <summary className="cursor-pointer list-none text-sm font-medium text-stone-700 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          <span>Other outcomes</span>
                          <span className="text-xs font-normal text-stone-500 group-open:hidden">
                            (deceased only)
                          </span>
                        </span>
                      </summary>
                      <div className="mt-3 border-t border-stone-200 pt-3">
                        <p className="text-xs text-stone-600">
                          Use only if this person has passed away. Closes
                          follow-up
                          {selected.prospect?.person
                            ? " and updates their person profile to Deceased"
                            : ""}
                          {isLowPriority
                            ? "."
                            : ". For “not now,” use low priority above."}
                        </p>
                        <button
                          type="button"
                          onClick={() => void markDeceased()}
                          disabled={saving}
                          className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
                        >
                          Mark deceased
                        </button>
                      </div>
                    </details>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

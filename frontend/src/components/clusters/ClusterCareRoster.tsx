"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { fetchAllCareCases, peopleApi } from "@/src/lib/api";
import {
  MEMBER_CARE_ACTION_OPTIONS,
  MEMBER_CARE_STATUS_OPTIONS,
  memberCareActionLabel,
} from "@/src/lib/memberCare";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import type { Cluster } from "@/src/types/cluster";
import type { MemberCareCase, Person } from "@/src/types/person";
import type { ClusterRosterPerson } from "@/src/lib/clusterRoster";
import {
  CareCaseEditor,
  buildCareAssigneeOptions,
  careCaseStatusClass,
  draftFromCareCase,
  type CareCaseDraft,
} from "@/src/components/clusters/CareCaseForm";

const NO_CLUSTER_KEY = "none";

type CareGroup = { label: string; rows: MemberCareCase[] };

type CareFilters = {
  person_status: string;
  recommended_action: string;
  case_status: string;
  include_closed: boolean;
  search: string;
};

const EMPTY_FILTERS: CareFilters = {
  person_status: "",
  recommended_action: "",
  case_status: "",
  include_closed: false,
  search: "",
};

function whoLabel(row: MemberCareCase): string {
  const names = (row.assigned_to_details || []).map((a) => a.full_name).filter(Boolean);
  const extra = (row.assigned_to_label || "").trim();
  const parts = [...names];
  if (extra) parts.push(extra);
  return parts.length ? parts.join(", ") : "—";
}

function clusterGroupKey(row: MemberCareCase): string {
  const ids = row.person?.cluster_ids || [];
  if (!ids.length) return NO_CLUSTER_KEY;
  return String(ids[0]);
}

function clusterGroupLabel(row: MemberCareCase): string {
  const labels = row.person?.cluster_labels || [];
  if (labels.length) return labels.join(", ");
  return "No cluster";
}


const selectClass =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 min-h-[44px] md:min-h-0";
const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 min-h-[44px] md:min-h-0";


function rowToneClass(
  row: MemberCareCase,
  canEdit: boolean,
  selected: boolean,
): string {
  const noAction = row.case_status === "NO_ACTION";
  return `${
    selected
      ? "bg-primary/5 ring-1 ring-inset ring-primary"
      : noAction
        ? "bg-red-50/70"
        : row.needs_attention
          ? "bg-amber-50/80"
          : "bg-white"
  } ${canEdit ? "cursor-pointer hover:bg-gray-50" : ""}`;
}

function CareStatCard({
  label,
  value,
  description,
  iconClass,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  iconClass: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-lg border p-4 py-4 card-shadow text-left min-w-0 min-h-[44px] transition-colors ${
        active
          ? "border-primary ring-1 ring-primary"
          : "border-gray-200 hover:border-gray-300"
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`p-1.5 rounded-lg ${iconClass}`} aria-hidden="true">
            {icon}
          </div>
        </div>
        <div className="ml-3 min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default function ClusterCareRoster({
  clusterId,
  clusters = [],
  assigneePeople = [],
  canEdit = true,
  compact = false,
  onViewPerson,
  onOpenCase,
  selectedCaseId,
  reloadToken = 0,
}: {
  clusterId?: number | string;
  clusters?: Cluster[];
  assigneePeople?: ClusterRosterPerson[];
  canEdit?: boolean;
  compact?: boolean;
  onViewPerson?: (person: Person) => void;
  onOpenCase?: (row: MemberCareCase) => void;
  selectedCaseId?: number | null;
  reloadToken?: number;
}) {
  const [filters, setFilters] = useState<CareFilters>(EMPTY_FILTERS);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [cases, setCases] = useState([] as MemberCareCase[]);
  const [statsCases, setStatsCases] = useState([] as MemberCareCase[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);
  const [expandedId, setExpandedId] = useState(null as number | null);
  const [draft, setDraft] = useState(null as CareCaseDraft | null);
  const [savingId, setSavingId] = useState(null as number | null);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllCareCases({
        cluster_id: clusterId,
        person_status: filters.person_status || undefined,
        recommended_action: filters.recommended_action || undefined,
        case_status: filters.case_status || undefined,
        include_closed: filters.include_closed ? "1" : undefined,
      });
      setCases(data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; error?: string } } };
      setError(
        ax.response?.data?.message ||
          ax.response?.data?.error ||
          "Failed to load care cases",
      );
    } finally {
      setLoading(false);
    }
  }, [
    clusterId,
    filters.person_status,
    filters.recommended_action,
    filters.case_status,
    filters.include_closed,
    reloadToken,
  ]);

  const loadStats = useCallback(async () => {
    if (compact) return;
    try {
      const data = await fetchAllCareCases({ cluster_id: clusterId });
      setStatsCases(data);
    } catch {
      setStatsCases([]);
    }
  }, [clusterId, compact, reloadToken]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const visibleCases = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return cases.filter((row) => {
      if (attentionOnly && !row.needs_attention) return false;
      if (!q) return true;
      const haystack = [
        row.person?.full_name,
        row.person?.first_name,
        row.person?.last_name,
        row.details,
        row.remarks,
        row.assigned_to_label,
        row.recommended_action_other,
        ...(row.person?.cluster_labels || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cases, filters.search, attentionOnly]);

  const grouped = useMemo(() => {
    const map: Map<string, CareGroup> = new Map();
    for (const row of visibleCases) {
      const key = clusterId != null ? String(clusterId) : clusterGroupKey(row);
      const label =
        clusterId != null
          ? clusterGroupLabel(row)
          : key === NO_CLUSTER_KEY
            ? "No cluster"
            : clusterGroupLabel(row);
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(key, { label, rows: [row] });
      }
    }
    const entries = Array.from(map.entries());
    entries.sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey === NO_CLUSTER_KEY) return 1;
      if (bKey === NO_CLUSTER_KEY) return -1;
      return aVal.label.localeCompare(bVal.label);
    });
    return entries;
  }, [visibleCases, clusterId]);

  const assigneeOptions = useMemo(
    () => buildCareAssigneeOptions(assigneePeople, clusters, cases),
    [assigneePeople, clusters, cases],
  );

  const openEditor = (row: MemberCareCase) => {
    if (!canEdit) return;
    if (onOpenCase) {
      onOpenCase(row);
      return;
    }
    setExpandedId(row.id);
    setDraft(draftFromCareCase(row));
  };

  const closeEditor = () => {
    setExpandedId(null);
    setDraft(null);
  };

  const saveRow = async (row: MemberCareCase) => {
    if (!draft) return;
    setSavingId(row.id);
    try {
      const action = draft.recommended_action;
      const payload = {
        details: draft.details,
        recommended_action: action,
        recommended_action_other:
          action === "OTHER" ? draft.recommended_action_other.trim() : "",
        assigned_to: draft.assigned_to.map(Number).filter((id) => !Number.isNaN(id)),
        assigned_to_label: draft.assigned_to_label,
        due_date: draft.due_date ? draft.due_date : null,
        case_status:
          action === "NO_ACTION" ? "NO_ACTION" : draft.case_status,
        remarks: draft.remarks,
      };
      const { data } = await peopleApi.patchCareCase(row.id, payload);
      setCases((prev) => prev.map((c) => (c.id === row.id ? data : c)));
      if (!compact) {
        await loadStats();
      }
      toast.success("Care case updated");
      closeEditor();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || "Could not save care case");
    } finally {
      setSavingId(null);
    }
  };

  const handleNameClick = async (row: MemberCareCase) => {
    if (!onViewPerson) return;
    try {
      const { data } = await peopleApi.getById(String(row.person.id));
      onViewPerson(data);
    } catch {
      onViewPerson({
        id: String(row.person.id),
        first_name: row.person.first_name,
        last_name: row.person.last_name,
        full_name: row.person.full_name,
        username: "",
        email: "",
        role: row.person.role,
        status: row.person.status,
      });
    }
  };

  const attentionCount = visibleCases.filter((c) => c.needs_attention).length;
  const openCaseloadCount = statsCases.length;
  const needsAttentionCount = statsCases.filter((c) => c.needs_attention).length;
  const noActionCount = statsCases.filter((c) => c.case_status === "NO_ACTION").length;
  const openActive =
    !attentionOnly &&
    !filters.person_status &&
    !filters.recommended_action &&
    !filters.case_status &&
    !filters.include_closed;
  const attentionActive = attentionOnly;
  const noActionActive = !attentionOnly && filters.case_status === "NO_ACTION";

  const applyOpenCaseload = () => {
    setAttentionOnly(false);
    setFilters(EMPTY_FILTERS);
  };

  const applyAttention = () => {
    if (attentionOnly) {
      applyOpenCaseload();
      return;
    }
    setAttentionOnly(true);
    setFilters(EMPTY_FILTERS);
  };

  const applyNoAction = () => {
    if (noActionActive) {
      applyOpenCaseload();
      return;
    }
    setAttentionOnly(false);
    setFilters({ ...EMPTY_FILTERS, case_status: "NO_ACTION" });
  };

  const usePanel = Boolean(onOpenCase);

  return (
    <div className="space-y-4 min-w-0">
      {!compact && (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">Cluster Care</h2>
          <p className="text-sm text-gray-600">
            Follow up members who are semi-active, inactive, dormant, or fall
            away. Setting no action keeps them on this list.
          </p>
        </div>
      )}

      {!compact && (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          <CareStatCard
            label="Open caseload"
            value={openCaseloadCount}
            description="Open, in progress, and no action"
            iconClass="chip-primary-surface"
            active={openActive}
            onClick={applyOpenCaseload}
            icon={
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            }
          />
          <CareStatCard
            label="Needs attention"
            value={needsAttentionCount}
            description="Missing a recommended action or overdue"
            iconClass="chip-orange-surface"
            active={attentionActive}
            onClick={applyAttention}
            icon={
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
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            }
          />
          <CareStatCard
            label="No action"
            value={noActionCount}
            description="Staying on the list without follow-up"
            iconClass="chip-red-surface"
            active={noActionActive}
            onClick={applyNoAction}
            icon={
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600 sm:col-span-2 lg:col-span-1">
          Search
          <input
            type="search"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            placeholder="Name or details"
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
          Attendance
          <select
            value={filters.person_status}
            onChange={(e) => {
              setAttentionOnly(false);
              setFilters((prev) => ({ ...prev, person_status: e.target.value }));
            }}
            className={selectClass}
          >
            <option value="">All statuses</option>
            <option value="SEMIACTIVE">Semi-active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DORMANT">Dormant</option>
            <option value="FALLAWAY">Fall Away</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
          Action
          <select
            value={filters.recommended_action}
            onChange={(e) => {
              setAttentionOnly(false);
              setFilters((prev) => ({
                ...prev,
                recommended_action: e.target.value,
              }));
            }}
            className={selectClass}
          >
            <option value="">All actions</option>
            {MEMBER_CARE_ACTION_OPTIONS.filter((o) => o.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
          Case status
          <select
            value={filters.case_status}
            onChange={(e) => {
              setAttentionOnly(false);
              setFilters((prev) => ({ ...prev, case_status: e.target.value }));
            }}
            className={selectClass}
          >
            <option value="">Open caseload</option>
            {MEMBER_CARE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1 text-sm text-gray-700 sm:col-span-2 lg:col-span-4 min-h-[44px] md:min-h-0">
          <input
            type="checkbox"
            checked={filters.include_closed}
            onChange={(e) => {
              setAttentionOnly(false);
              setFilters((prev) => ({
                ...prev,
                include_closed: e.target.checked,
              }));
            }}
            className="h-4 w-4"
          />
          Show recovered / completed
        </label>
      </div>

      {compact && attentionCount > 0 && (
        <p className="text-sm text-amber-800">
          {attentionCount} {attentionCount === 1 ? "case needs" : "cases need"}{" "}
          a recommended action or is overdue.
        </p>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : visibleCases.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          {attentionOnly
            ? "No cases need attention."
            : filters.include_closed || filters.case_status
              ? "No care cases match these filters."
              : "No open care cases."}
        </p>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {grouped.map(([key, group]) => (
            <section key={key} className="space-y-2">
              {clusterId == null && (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {group.label} ({group.rows.length})
                </h3>
              )}
              {group.rows.map((row) => {
                const isOpen = !usePanel && expandedId === row.id;
                const selected = selectedCaseId === row.id;
                return (
                  <article
                    key={row.id}
                    className={`rounded-lg border border-gray-200 p-3 ${rowToneClass(row, canEdit, selected)}`}
                    onClick={() =>
                      canEdit
                        ? isOpen
                          ? closeEditor()
                          : openEditor(row)
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {onViewPerson ? (
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline break-words"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNameClick(row);
                            }}
                          >
                            {row.person.full_name}
                          </button>
                        ) : (
                          <p className="font-medium text-gray-900 break-words">
                            {row.person.full_name}
                          </p>
                        )}
                        {clusterId == null && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {clusterGroupLabel(row)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPersonStatusColor(row.person.status)}`}
                        >
                          {formatPersonStatusLabel(row.person.status)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${careCaseStatusClass(row.case_status)}`}
                        >
                          {row.case_status_display || row.case_status}
                        </span>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Details
                        </dt>
                        <dd className="break-words text-gray-800">
                          {row.details || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Recommended action
                        </dt>
                        <dd className="text-gray-800">
                          {memberCareActionLabel(
                            row.recommended_action,
                            row.recommended_action_other,
                          )}
                        </dd>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Who
                          </dt>
                          <dd className="break-words text-gray-800">
                            {whoLabel(row)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            When
                          </dt>
                          <dd className="text-gray-800">
                            {row.due_date || "—"}
                          </dd>
                        </div>
                      </div>
                      {row.remarks ? (
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Remarks
                          </dt>
                          <dd className="break-words text-gray-800">
                            {row.remarks}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {isOpen && draft ? (
                      <div
                        className="mt-3 border-t border-gray-200 pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CareCaseEditor
                          draft={draft}
                          setDraft={setDraft}
                          assigneeOptions={assigneeOptions}
                          saving={savingId === row.id}
                          onSave={() => saveRow(row)}
                          onCancel={closeEditor}
                        />
                      </div>
                    ) : canEdit && !usePanel ? (
                      <p className="mt-2 text-xs text-primary">Tap to edit</p>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                {clusterId == null && <th className="px-3 py-2">Cluster</th>}
                <th className="px-3 py-2">Attendance status</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Recommended action</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Remarks</th>
              </tr>
            </thead>
            {grouped.map(([key, group]) => (
              <tbody key={key} className="divide-y divide-gray-100">
                {clusterId == null && grouped.length > 1 && (
                  <tr className="bg-gray-50">
                    <td
                      colSpan={9}
                      className="px-3 py-2 text-xs font-semibold text-gray-700"
                    >
                      {group.label} ({group.rows.length})
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => {
                  const isOpen = !usePanel && expandedId === row.id;
                  const selected = selectedCaseId === row.id;
                  return (
                    <Fragment key={row.id}>
                    <tr
                      className={rowToneClass(row, canEdit, selected)}
                      onClick={() => (isOpen ? closeEditor() : openEditor(row))}
                    >
                      {clusterId == null && (
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                          {clusterGroupLabel(row)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPersonStatusColor(row.person.status)}`}
                        >
                          {formatPersonStatusLabel(row.person.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                        {onViewPerson ? (
                          <button
                            type="button"
                            className="text-left text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNameClick(row);
                            }}
                          >
                            {row.person.full_name}
                          </button>
                        ) : (
                          row.person.full_name
                        )}
                      </td>
                      <td className="max-w-xs px-3 py-2 text-gray-700">
                        <span className="line-clamp-2">
                          {row.details || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {memberCareActionLabel(
                          row.recommended_action,
                          row.recommended_action_other,
                        )}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 text-gray-700">
                        <span className="line-clamp-2">{whoLabel(row)}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                        {row.due_date || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${careCaseStatusClass(row.case_status)}`}
                        >
                          {row.case_status_display || row.case_status}
                        </span>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 text-gray-700">
                        <span className="line-clamp-2">
                          {row.remarks || "—"}
                        </span>
                      </td>
                    </tr>
                    {isOpen && draft ? (
                      <tr className="bg-slate-50">
                        <td
                          colSpan={clusterId == null ? 9 : 8}
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CareCaseEditor
                            draft={draft}
                            setDraft={setDraft}
                            assigneeOptions={assigneeOptions}
                            saving={savingId === row.id}
                            onSave={() => saveRow(row)}
                            onCancel={closeEditor}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        </>
      )}
    </div>
  );
}

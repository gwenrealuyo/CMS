"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/src/components/ui/Button";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import { peopleApi } from "@/src/lib/api";
import type { ClusterRosterPerson } from "@/src/lib/clusterRoster";
import {
  MEMBER_CARE_ACTION_OPTIONS,
  MEMBER_CARE_STATUS_OPTIONS,
} from "@/src/lib/memberCare";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import type { Cluster } from "@/src/types/cluster";
import type {
  MemberCareCase,
  MemberCareCaseStatus,
  MemberCareRecommendedAction,
  Person,
} from "@/src/types/person";

export type CareAssigneeOption = { value: string; label: string };

export type CareCaseDraft = {
  details: string;
  recommended_action: MemberCareRecommendedAction;
  recommended_action_other: string;
  assigned_to: string[];
  assigned_to_label: string;
  due_date: string;
  case_status: MemberCareCaseStatus;
  remarks: string;
};

export function draftFromCareCase(row: MemberCareCase): CareCaseDraft {
  return {
    details: row.details || "",
    recommended_action: row.recommended_action || "",
    recommended_action_other: row.recommended_action_other || "",
    assigned_to: (row.assigned_to || []).map(String),
    assigned_to_label: row.assigned_to_label || "",
    due_date: row.due_date || "",
    case_status: row.case_status,
    remarks: row.remarks || "",
  };
}

export function careCaseStatusClass(status: MemberCareCaseStatus): string {
  switch (status) {
    case "RECOVERED":
      return "bg-green-100 text-green-800";
    case "COMPLETED":
      return "bg-gray-100 text-gray-700";
    case "NO_ACTION":
      return "bg-red-50 text-red-800";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export function buildCareAssigneeOptions(
  assigneePeople: ClusterRosterPerson[],
  clusters: Cluster[],
  cases: MemberCareCase[],
): CareAssigneeOption[] {
  const map: Map<string, CareAssigneeOption> = new Map();
  const addPerson = (id: string | number, label: string) => {
    const key = String(id);
    if (!key || map.has(key)) return;
    map.set(key, { value: key, label: label || `Person ${key}` });
  };
  for (const person of assigneePeople) {
    if (person.role === "VISITOR" || person.role === "ADMIN") continue;
    addPerson(person.id, formatPersonName(person));
  }
  for (const cluster of clusters) {
    for (const member of cluster.members_details || []) {
      if (member.role === "VISITOR" || member.role === "ADMIN") continue;
      addPerson(
        member.id,
        formatPersonName({
          first_name: member.first_name,
          last_name: member.last_name,
          nickname: member.nickname,
          middle_name: member.middle_name,
          suffix: member.suffix,
        }),
      );
    }
    if (cluster.coordinator) {
      addPerson(
        cluster.coordinator.id,
        formatPersonName({
          first_name: cluster.coordinator.first_name,
          last_name: cluster.coordinator.last_name,
        }),
      );
    }
  }
  for (const row of cases) {
    for (const assignee of row.assigned_to_details || []) {
      addPerson(assignee.id, assignee.full_name);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const selectClass =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 min-h-[44px] md:min-h-0";
const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 min-h-[44px] md:min-h-0";

export function CareCaseEditor({
  draft,
  setDraft,
  assigneeOptions,
  saving,
  onSave,
  onCancel,
  panelLayout = false,
}: {
  draft: CareCaseDraft;
  setDraft: (updater: (prev: CareCaseDraft | null) => CareCaseDraft | null) => void;
  assigneeOptions: CareAssigneeOption[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  panelLayout?: boolean;
}) {
  return (
    <div className={panelLayout ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
      <label
        className={`flex flex-col gap-1 text-xs font-medium text-gray-600 ${
          panelLayout ? "" : "md:col-span-2"
        }`}
      >
        Details
        <textarea
          value={draft.details}
          onChange={(e) =>
            setDraft((prev) =>
              prev ? { ...prev, details: e.target.value } : prev,
            )
          }
          rows={3}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
        Recommended action
        <select
          value={draft.recommended_action}
          onChange={(e) => {
            const value = e.target.value as MemberCareRecommendedAction;
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    recommended_action: value,
                    recommended_action_other:
                      value === "OTHER" ? prev.recommended_action_other : "",
                    case_status:
                      value === "NO_ACTION"
                        ? "NO_ACTION"
                        : prev.case_status === "NO_ACTION"
                          ? "IN_PROGRESS"
                          : prev.case_status,
                  }
                : prev,
            );
          }}
          className={selectClass}
        >
          {MEMBER_CARE_ACTION_OPTIONS.map((opt) => (
            <option key={opt.value || "blank"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {draft.recommended_action === "OTHER" ? (
        <label
          className={`flex flex-col gap-1 text-xs font-medium text-gray-600 ${
            panelLayout ? "" : "md:col-span-2"
          }`}
        >
          Other action
          <input
            type="text"
            value={draft.recommended_action_other}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? { ...prev, recommended_action_other: e.target.value }
                  : prev,
              )
            }
            placeholder="Describe the action"
            className={inputClass}
            required
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
        Status
        <select
          value={draft.case_status}
          onChange={(e) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    case_status: e.target.value as MemberCareCaseStatus,
                  }
                : prev,
            )
          }
          className={selectClass}
        >
          {MEMBER_CARE_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div
        className={`flex flex-col gap-1 text-xs font-medium text-gray-600 ${
          panelLayout ? "" : "md:col-span-2"
        }`}
      >
        Who
        <ScalableSelect
          multiple
          values={draft.assigned_to}
          onValuesChange={(values) =>
            setDraft((prev) =>
              prev ? { ...prev, assigned_to: values } : prev,
            )
          }
          options={assigneeOptions}
          placeholder="Select cluster members"
          searchPlaceholder="Search people"
        />
        <input
          type="text"
          value={draft.assigned_to_label}
          onChange={(e) =>
            setDraft((prev) =>
              prev ? { ...prev, assigned_to_label: e.target.value } : prev,
            )
          }
          placeholder="Or a family / other name"
          className={`${inputClass} mt-1`}
        />
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
        When
        <input
          type="date"
          value={draft.due_date}
          onChange={(e) =>
            setDraft((prev) =>
              prev ? { ...prev, due_date: e.target.value } : prev,
            )
          }
          className={selectClass}
        />
      </label>
      <label
        className={`flex flex-col gap-1 text-xs font-medium text-gray-600 ${
          panelLayout ? "" : "md:col-span-2"
        }`}
      >
        Remarks
        <textarea
          value={draft.remarks}
          onChange={(e) =>
            setDraft((prev) =>
              prev ? { ...prev, remarks: e.target.value } : prev,
            )
          }
          rows={2}
          className={inputClass}
        />
      </label>
      <div
        className={`flex flex-wrap gap-2 ${panelLayout ? "flex-col" : "md:col-span-2"}`}
      >
        <Button
          onClick={onSave}
          disabled={
            saving ||
            (draft.recommended_action === "OTHER" &&
              !draft.recommended_action_other.trim())
          }
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="tertiary"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          {panelLayout ? "Back" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

export default function CareCaseForm({
  caseRow,
  clusters = [],
  assigneePeople = [],
  panelLayout = false,
  onCancel,
  onSaved,
  onViewPerson,
}: {
  caseRow: MemberCareCase;
  clusters?: Cluster[];
  assigneePeople?: ClusterRosterPerson[];
  panelLayout?: boolean;
  onCancel: () => void;
  onSaved?: (row: MemberCareCase) => void;
  onViewPerson?: (person: Person) => void;
}) {
  const [draft, setDraftState] = useState(() => draftFromCareCase(caseRow));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftState(draftFromCareCase(caseRow));
  }, [caseRow.id, caseRow.updated_at]);

  const assigneeOptions = useMemo(
    () => buildCareAssigneeOptions(assigneePeople, clusters, [caseRow]),
    [assigneePeople, clusters, caseRow],
  );

  const handleNameClick = async () => {
    if (!onViewPerson) return;
    try {
      const { data } = await peopleApi.getById(String(caseRow.person.id));
      onViewPerson(data);
    } catch {
      onViewPerson({
        id: String(caseRow.person.id),
        first_name: caseRow.person.first_name,
        last_name: caseRow.person.last_name,
        full_name: caseRow.person.full_name,
        username: "",
        email: "",
        role: caseRow.person.role,
        status: caseRow.person.status,
      });
    }
  };

  const save = async () => {
    setSaving(true);
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
        case_status: action === "NO_ACTION" ? "NO_ACTION" : draft.case_status,
        remarks: draft.remarks,
      };
      const { data } = await peopleApi.patchCareCase(caseRow.id, payload);
      toast.success("Care case updated");
      onSaved?.(data);
    } catch (err: unknown) {
      const ax = err as {
        response?: {
          data?: {
            message?: string;
            recommended_action_other?: string | string[];
            details?: { recommended_action_other?: string | string[] };
          };
        };
      };
      const otherError =
        ax.response?.data?.details?.recommended_action_other ||
        ax.response?.data?.recommended_action_other;
      const otherMessage = Array.isArray(otherError) ? otherError[0] : otherError;
      toast.error(
        otherMessage ||
          ax.response?.data?.message ||
          "Could not save care case",
      );
    } finally {
      setSaving(false);
    }
  };

  const clusterLabel =
    (caseRow.person?.cluster_labels || []).join(", ") || "No cluster";

  return (
    <div className={panelLayout ? "p-4 sm:p-5 space-y-4" : "space-y-4"}>
      <div className="space-y-2">
        {onViewPerson ? (
          <button
            type="button"
            className="text-left text-lg font-semibold text-primary hover:underline break-words"
            onClick={handleNameClick}
          >
            {caseRow.person.full_name}
          </button>
        ) : (
          <h3 className="text-lg font-semibold text-gray-900">
            {caseRow.person.full_name}
          </h3>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPersonStatusColor(caseRow.person.status)}`}
          >
            {formatPersonStatusLabel(caseRow.person.status)}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${careCaseStatusClass(caseRow.case_status)}`}
          >
            {caseRow.case_status_display || caseRow.case_status}
          </span>
        </div>
        <p className="text-xs text-gray-500">{clusterLabel}</p>
      </div>
      <CareCaseEditor
        draft={draft}
        setDraft={(updater) =>
          setDraftState((prev) => updater(prev) ?? prev)
        }
        assigneeOptions={assigneeOptions}
        saving={saving}
        onSave={save}
        onCancel={onCancel}
        panelLayout={panelLayout}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import CordFormModal from "@/src/components/clusters/CordFormModal";
import { clusterCordsApi } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import type {
  ClusterCord,
  ClusterCordEligibleMember,
} from "@/src/types/cluster";

const VERSE_HOOK =
  "“A cord… is not quickly broken” (Ecc 4:12)—we form small cords of five so each person is held by others.";

/** Nickname only for cord chips; falls back to first name, then full display name. */
function cordDisplayNickname(person: {
  nickname?: string | null;
  first_name?: string | null;
}): string {
  const nick = (person.nickname ?? "").trim();
  if (nick) return nick;
  const first = (person.first_name ?? "").trim();
  if (first) return first;
  return formatPersonName(person);
}

export default function ClusterCordsSection({
  clusterId,
  canManage = false,
  compact = false,
  onCareFocus,
}: {
  clusterId: number | string;
  canManage?: boolean;
  compact?: boolean;
  /** Jump to Cluster Care for this cord’s open cases. */
  onCareFocus?: (cordId: number) => void;
}) {
  const [cords, setCords] = useState<ClusterCord[]>([]);
  const [eligible, setEligible] = useState<ClusterCordEligibleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClusterCord | null>(null);
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cordsRes, eligibleRes] = await Promise.all([
        clusterCordsApi.list(clusterId),
        clusterCordsApi.eligibleMembers(clusterId),
      ]);
      setCords(cordsRes.data);
      setEligible(eligibleRes.data);
    } catch {
      toast.error("Could not load 5x5 Cords");
      setCords([]);
      setEligible([]);
    } finally {
      setLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    load();
  }, [load]);

  const unassigned = useMemo(
    () => eligible.filter((p) => p.assigned_cord_id == null),
    [eligible],
  );

  const handleSaved = (_cord: ClusterCord) => {
    setFormOpen(false);
    setEditing(null);
    void load();
  };

  const handleDeactivated = () => {
    setFormOpen(false);
    setEditing(null);
    void load();
  };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 md:text-lg">
            5x5 Cords ({cords.length})
          </h3>
          <p
            className={`mt-1 text-gray-600 ${compact ? "text-xs" : "text-sm"}`}
          >
            {VERSE_HOOK}
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            className="shrink-0"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Create cord
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          {!loading && unassigned.length > 0 && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3">
              <button
                type="button"
                className="flex w-full min-h-[44px] items-center justify-between gap-2 text-left sm:min-h-0"
                aria-expanded={unassignedExpanded}
                onClick={() => setUnassignedExpanded((v) => !v)}
              >
                <span className="text-sm font-medium text-amber-900">
                  Unassigned eligible ({unassigned.length})
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-amber-800 transition-transform ${
                    unassignedExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {unassignedExpanded && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unassigned.map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs text-gray-800 border border-amber-200"
                    >
                      {formatPersonName(person)}
                      {person.status && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 ${getPersonStatusColor(person.status)}`}
                        >
                          {formatPersonStatusLabel(person.status)}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {cords.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No 5x5 Cords yet. Group ACTIVE and SEMIACTIVE members into cords
              of five for mutual care; follow-up stays on Cluster Care.
            </p>
          ) : (
            <ul className="space-y-3">
              {cords.map((cord) => {
                const subId = cord.sub_coordinator?.id ?? null;
                const subName = cord.sub_coordinator
                  ? cordDisplayNickname(cord.sub_coordinator)
                  : null;
                const memberChips = cord.members_details.filter(
                  (m) => subId == null || m.id !== subId,
                );
                const careOpen = cord.care_summary?.open_count ?? 0;
                const careAttention =
                  cord.care_summary?.needs_attention_count ?? 0;
                return (
                  <li
                    key={cord.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 card-shadow"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {canManage ? (
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline text-left min-h-[44px] sm:min-h-0"
                            onClick={() => {
                              setEditing(cord);
                              setFormOpen(true);
                            }}
                          >
                            {cord.name}
                          </button>
                        ) : (
                          <span className="font-medium text-gray-900">
                            {cord.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {cord.member_count} members
                        </span>
                        {subName && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Sub-coordinator: {subName}
                          </span>
                        )}
                        {cord.size_warning && (
                          <span className="text-xs text-amber-700">
                            {cord.size_warning}
                          </span>
                        )}
                      </div>
                      {(memberChips.length > 0 ||
                        (cord.invited_visitors?.length ?? 0) > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {memberChips.map((m) => (
                            <span
                              key={m.id}
                              title={
                                m.status
                                  ? formatPersonStatusLabel(m.status)
                                  : undefined
                              }
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getPersonStatusColor(m.status)}`}
                            >
                              {cordDisplayNickname(m)}
                            </span>
                          ))}
                          {(cord.invited_visitors || []).map((v) => (
                            <span
                              key={`visitor-${v.id}`}
                              title={`Visitor${
                                v.status
                                  ? ` · ${formatPersonStatusLabel(v.status)}`
                                  : ""
                              }`}
                              className={`inline-flex items-center gap-1 rounded-full border border-dashed border-black/20 px-2 py-0.5 text-xs font-medium ${getPersonStatusColor(v.status)}`}
                            >
                              {cordDisplayNickname(v)}
                              <span className="rounded bg-black/10 px-1 py-px text-[10px] font-medium uppercase tracking-wide">
                                Visitor
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                      {(careOpen > 0 || careAttention > 0) && (
                        <p className="mt-2 text-xs text-amber-800">
                          Cluster Care: {careOpen} open
                          {careAttention > 0
                            ? ` · ${careAttention} need attention`
                            : ""}
                          {onCareFocus && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="font-medium text-primary underline"
                                onClick={() => onCareFocus(cord.id)}
                              >
                                View in Care
                              </button>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <CordFormModal
        clusterId={clusterId}
        cord={editing}
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        onDeactivated={handleDeactivated}
      />
    </div>
  );
}

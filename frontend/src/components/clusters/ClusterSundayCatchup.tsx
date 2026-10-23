"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { clustersApi } from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import { userCanSundayCatchup } from "@/src/lib/clusterPermissions";
import { formatLampIdDisplay } from "@/src/lib/events/checkInUtils";
import { formatPersonStatusLabel } from "@/src/lib/personStatus";
import type { Cluster } from "@/src/types/cluster";
import type { ModuleCoordinator } from "@/src/types/person";
import {
  SUNDAY_CATCHUP_REASONS,
  sundayCatchupReasonLabel,
  type SundayCatchupPayload,
  type SundayCatchupReason,
} from "@/src/types/sundayCatchup";
import { useAuth } from "@/src/contexts/AuthContext";

function formatChurchDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClusterSundayCatchup({
  cluster,
}: {
  cluster: Cluster;
}) {
  const { user, isSeniorCoordinator, isModuleCoordinator } = useAuth();
  const allowed = userCanSundayCatchup(cluster, {
    userId: user?.id,
    role: user?.role,
    isSeniorCoordinator,
    isModuleCoordinator,
    clusterCommitteeRole: user?.cluster_committee_role,
    moduleCoordinatorAssignments: user?.module_coordinator_assignments as
      | ModuleCoordinator[]
      | undefined,
  });
  const [payload, setPayload] = useState<SundayCatchupPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openPersonId, setOpenPersonId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<SundayCatchupReason>("FORGOT_CHECKIN");
  const [note, setNote] = useState("");
  const [pendingRemove, setPendingRemove] = useState<{
    attendanceId: number;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const response = await clustersApi.getSundayCatchup(cluster.id);
      setPayload(response.data);
    } catch (error) {
      setPayload(null);
      toast.error(
        formatApiErrorMessage(error, "Could not load Sunday catch-up."),
      );
    } finally {
      setLoading(false);
    }
  }, [allowed, cluster.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (
    !allowed ||
    (!loading && (!payload?.available || !payload.occurrence_date))
  ) {
    return null;
  }
  if (!payload?.occurrence_date) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-sm text-amber-900">Sunday catch-up</p>
      </section>
    );
  }

  const closes = payload.window_closes_on
    ? formatChurchDate(payload.window_closes_on)
    : "";
  const serviceDate = formatChurchDate(payload.occurrence_date);
  const uncheckedCount = payload.roster.filter((row) => !row.attendance).length;
  const isActionable = payload.writes_enabled;
  const shellClass = isActionable
    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-sm ring-1 ring-amber-200/80"
    : "border-slate-200 bg-slate-50 ring-1 ring-slate-100";

  const mark = async (personId: number) => {
    if (reason === "OTHER" && !note.trim()) {
      toast.error("Describe the reason when you choose Other.");
      return;
    }
    setBusyId(personId);
    try {
      const response = await clustersApi.markSundayCatchup(cluster.id, {
        person_id: personId,
        reason,
        note: reason === "OTHER" ? note.trim() : "",
      });
      setPayload(response.data);
      setOpenPersonId(null);
      setNote("");
      toast.success("Marked present online.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Could not mark attendance."));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (attendanceId: number) => {
    setBusyId(attendanceId);
    try {
      const response = await clustersApi.removeSundayCatchup(
        cluster.id,
        attendanceId,
      );
      setPayload(response.data);
      setPendingRemove(null);
      toast.success("Catch-up removed.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Could not remove catch-up."));
    } finally {
      setBusyId(null);
    }
  };

  const summary = payload.writes_enabled
    ? `Online catch-up is open through ${closes}.`
    : payload.read_only_reason === "onsite_only"
      ? "This service is onsite only. Online catch-up is not available."
      : `Catch-up closed${closes ? ` (it was open through ${closes})` : ""}.`;

  const removing =
    pendingRemove !== null && busyId === pendingRemove.attendanceId;

  return (
    <section className={`rounded-lg border px-3 py-2 ${shellClass}`}>
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((open) => !open);
          setOpenPersonId(null);
        }}
      >
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${
            isActionable ? "text-amber-700" : "text-gray-500"
          } ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`block text-sm font-semibold ${
                isActionable ? "text-amber-950" : "text-gray-900"
              }`}
            >
              Sunday service, {serviceDate}
            </span>
            {isActionable && uncheckedCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 ring-1 ring-sky-200/80">
                {uncheckedCount} not checked in
              </span>
            ) : null}
          </span>
          <span
            className={`block text-xs ${
              isActionable ? "text-amber-900/75" : "text-gray-500"
            }`}
          >
            {summary}
          </span>
        </span>
      </button>
      {expanded ? (
        payload.roster.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No members to mark.</p>
        ) : (
          <ul className="scrollbar-visible mt-2 max-h-72 divide-y divide-gray-100 overscroll-contain rounded-md border border-white/80 bg-white px-2 shadow-sm">
            {payload.roster.map((row) => {
              const attendance = row.attendance;
              const lamp = formatLampIdDisplay(row.member_id);
              const presentLabel = attendance
                ? attendance.attendance_mode === "ONLINE"
                  ? "Present · Online"
                  : "Present · Onsite"
                : "";
              const catchupLabel = attendance?.catchup_reason
                ? sundayCatchupReasonLabel(
                    attendance.catchup_reason,
                    attendance.catchup_note,
                  )
                : "";
              const formOpen = openPersonId === row.person_id;
              return (
                <li key={row.person_id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {row.name}
                    </span>
                    {lamp ? (
                      <span className="chip-sky-sm shrink-0">{lamp}</span>
                    ) : null}
                    {row.status ? (
                      <span className="text-xs text-gray-500">
                        {formatPersonStatusLabel(row.status)}
                      </span>
                    ) : null}
                    {attendance ? (
                      <>
                        <span className="text-xs font-medium text-gray-700">
                          {presentLabel}
                        </span>
                        {catchupLabel ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Added later · {catchupLabel}
                          </span>
                        ) : null}
                        {attendance.can_remove ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                            disabled={busyId === attendance.id}
                            onClick={() =>
                              setPendingRemove({
                                attendanceId: attendance.id,
                                name: row.name,
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </>
                    ) : payload.writes_enabled ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          setOpenPersonId(formOpen ? null : row.person_id);
                          setReason("FORGOT_CHECKIN");
                          setNote("");
                        }}
                      >
                        {formOpen ? "Cancel" : "Mark online"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Not checked in
                      </span>
                    )}
                  </div>
                  {formOpen && !attendance && payload.writes_enabled ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label
                        className={`flex flex-col gap-1 text-xs text-gray-600 ${
                          reason === "OTHER"
                            ? "sm:w-32 sm:shrink-0"
                            : "min-w-0 flex-1"
                        }`}
                      >
                        Reason
                        <select
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                          value={reason}
                          onChange={(event) =>
                            setReason(event.target.value as SundayCatchupReason)
                          }
                        >
                          {SUNDAY_CATCHUP_REASONS.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {reason === "OTHER" ? (
                        <label className="flex min-w-0 flex-[2] flex-col gap-1 text-xs text-gray-600">
                          Note
                          <input
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                            value={note}
                            maxLength={200}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="What happened"
                          />
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        disabled={busyId === row.person_id}
                        onClick={() => void mark(row.person_id)}
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
      <ConfirmationModal
        isOpen={pendingRemove !== null}
        onClose={() => {
          if (removing) return;
          setPendingRemove(null);
        }}
        onConfirm={() => {
          if (!pendingRemove || removing) return;
          void remove(pendingRemove.attendanceId);
        }}
        title="Remove catch-up?"
        message={
          pendingRemove
            ? `Remove the online catch-up for ${pendingRemove.name}? This Sunday will no longer show them as present from this mark.`
            : ""
        }
        confirmText="Remove"
        cancelText="Keep"
        variant="danger"
        loading={removing}
      />
    </section>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import ModalOverlay from "@/src/components/ui/ModalOverlay";
import {
  clusterTransferRequestsApi,
  clustersApi,
  type ClusterTransferRequest,
} from "@/src/lib/api";
import { formatApiErrorMessage } from "@/src/lib/apiErrors";
import type { Cluster } from "@/src/types/cluster";
import type { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";

const PENDING_TRANSFER_MESSAGE =
  "This person already has a pending cluster transfer request.";

interface ClusterTransferRequestModalProps {
  isOpen: boolean;
  person: Person | null;
  onClose: () => void;
  onSubmitted?: () => void;
  /** Prefill source cluster (defaults to person's primary). */
  initialFromClusterId?: number | string | null;
  /** Prefill destination cluster. */
  initialToClusterId?: number | string | null;
  zIndex?: 70 | 80;
}

function idStr(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function stubCluster(id: string): Cluster {
  return {
    id: Number(id),
    name: `Cluster ${id}`,
    code: "",
  } as Cluster;
}

function clusterOptionLabel(c: Cluster): string {
  return `${c.code ? `(${c.code}) ` : ""}${c.name || `Cluster ${c.id}`}`;
}

function pendingSummary(pending: ClusterTransferRequest): string {
  const from =
    pending.from_cluster.code ||
    pending.from_cluster.name ||
    `Cluster ${pending.from_cluster.id}`;
  const to =
    pending.to_cluster.code ||
    pending.to_cluster.name ||
    `Cluster ${pending.to_cluster.id}`;
  return `${PENDING_TRANSFER_MESSAGE} (${from} → ${to}). Primary stays on the current cluster until it is approved.`;
}

export default function ClusterTransferRequestModal({
  isOpen,
  person,
  onClose,
  onSubmitted,
  initialFromClusterId = null,
  initialToClusterId = null,
  zIndex = 80,
}: ClusterTransferRequestModalProps) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [fromClusterId, setFromClusterId] = useState("");
  const [toClusterId, setToClusterId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membershipIds = useMemo(() => {
    if (!person) return [] as string[];
    if (person.cluster_ids?.length) {
      return person.cluster_ids.map(String);
    }
    return (person.cluster_memberships ?? []).map((c) => String(c.id));
  }, [person]);

  const prefilledFrom = idStr(initialFromClusterId);
  const prefilledTo = idStr(initialToClusterId);
  const clustersLocked = Boolean(prefilledFrom && prefilledTo);

  useEffect(() => {
    if (!isOpen || !person) return;
    let cancelled = false;
    setError(null);
    setReason("");
    setPendingBlocked(false);
    setCheckingPending(true);

    const fromId =
      prefilledFrom ||
      (person.primary_cluster_id != null
        ? String(person.primary_cluster_id)
        : membershipIds[0] || "");
    const toId = prefilledTo;

    setFromClusterId(fromId);
    setToClusterId(toId);

    clustersApi
      .getAll({ include_inactive: false })
      .then((res) => {
        if (!cancelled) setClusters(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setClusters([]);
      });

    clusterTransferRequestsApi
      .list({ status: "pending", person: person.id, page: 1 })
      .then((res) => {
        if (cancelled) return;
        const results = res.data?.results || [];
        const forPerson = results.filter(
          (item) => Number(item.person?.id) === Number(person.id),
        );
        if (forPerson.length > 0) {
          setPendingBlocked(true);
          setError(pendingSummary(forPerson[0]));
        }
      })
      .catch(() => {
        // If pending check fails, allow submit — server still enforces uniqueness.
      })
      .finally(() => {
        if (!cancelled) setCheckingPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, person, membershipIds, prefilledFrom, prefilledTo]);

  const clusterById = useMemo(() => {
    const map = new Map<string, Cluster>();
    for (const c of clusters) {
      map.set(String(c.id), c);
    }
    for (const m of person?.cluster_memberships ?? []) {
      const key = String(m.id);
      if (!map.has(key)) {
        map.set(key, {
          id: m.id,
          name: m.name,
          code: m.code,
        } as Cluster);
      }
    }
    return map;
  }, [clusters, person?.cluster_memberships]);

  const fromOptions = useMemo(() => {
    const opts = clusters.filter((c) => membershipIds.includes(String(c.id)));
    if (fromClusterId && !opts.some((c) => String(c.id) === fromClusterId)) {
      opts.unshift(clusterById.get(fromClusterId) ?? stubCluster(fromClusterId));
    }
    return opts;
  }, [clusters, membershipIds, fromClusterId, clusterById]);

  const toOptions = useMemo(() => {
    const opts = clusters.filter(
      (c) => String(c.id) !== fromClusterId && c.is_active !== false,
    );
    if (toClusterId && !opts.some((c) => String(c.id) === toClusterId)) {
      opts.unshift(clusterById.get(toClusterId) ?? stubCluster(toClusterId));
    }
    return opts;
  }, [clusters, fromClusterId, toClusterId, clusterById]);

  const handleSubmit = async () => {
    if (pendingBlocked) {
      setError(PENDING_TRANSFER_MESSAGE);
      return;
    }
    if (!person || !fromClusterId || !toClusterId) {
      setError("Choose source and destination clusters.");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Reason is required.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await clusterTransferRequestsApi.create({
        person_id: Number(person.id),
        from_cluster_id: Number(fromClusterId),
        to_cluster_id: Number(toClusterId),
        reason: trimmedReason,
      });
      onSubmitted?.();
      onClose();
    } catch (err: unknown) {
      setError(
        formatApiErrorMessage(
          err,
          "Could not submit transfer request.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const formDisabled = pendingBlocked || checkingPending;

  return (
    <ModalOverlay
      isOpen={isOpen && !!person}
      onClose={onClose}
      zIndex={zIndex}
      panelClassName="relative w-full max-w-md"
    >
      <div className="rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Request cluster transfer
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Move{" "}
          <strong className="font-semibold text-gray-900">
            {person ? formatPersonName(person) : ""}
          </strong>{" "}
          to another cluster. This requires approval. Primary stays on the
          current cluster until the request is approved.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            From cluster
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-700"
              value={fromClusterId}
              disabled={clustersLocked || formDisabled}
              onChange={(e) => setFromClusterId(e.target.value)}
            >
              {!fromClusterId && <option value="">Select…</option>}
              {fromOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {clusterOptionLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            To cluster
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-700"
              value={toClusterId}
              disabled={clustersLocked || formDisabled}
              onChange={(e) => setToClusterId(e.target.value)}
            >
              {!toClusterId && <option value="">Select…</option>}
              {toOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {clusterOptionLabel(c)}
                </option>
              ))}
            </select>
          </label>
          {!pendingBlocked && (
            <label className="block text-sm font-medium text-gray-700">
              Reason
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                rows={3}
                value={reason}
                required
                disabled={formDisabled}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this transfer needed?"
              />
            </label>
          )}
          {checkingPending && (
            <p className="text-sm text-gray-500">Checking existing requests…</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="tertiary" onClick={onClose}>
            {pendingBlocked ? "Close" : "Cancel"}
          </Button>
          {!pendingBlocked && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || checkingPending || !reason.trim()}
            >
              {loading ? "Submitting…" : "Submit request"}
            </Button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

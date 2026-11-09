"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import PersonAvatar from "@/src/components/people/PersonAvatar";
import {
  clusterTransferRequestsApi,
  type ClusterTransferRequest,
  type ClusterTransferRequestStatus,
} from "@/src/lib/api";
import { formatLocaleDate } from "@/src/lib/date";
import { getPersonRoleColor } from "@/src/lib/personRole";
import {
  formatPersonStatusLabel,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import type { Person } from "@/src/types/person";

interface ClusterTransfersPanelProps {
  canReview: boolean;
  onViewPerson?: (person: Person) => void;
}

const STATUS_TABS: {
  value: ClusterTransferRequestStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const HISTORY_PAGE_SIZE = 10;

function clusterLabel(cluster: ClusterTransferRequest["from_cluster"]): {
  code: string;
  name: string | null;
} {
  const code =
    cluster.code?.trim() ||
    cluster.name?.trim() ||
    `Cluster ${cluster.id}`;
  const name =
    cluster.code?.trim() && cluster.name?.trim()
      ? cluster.name.trim()
      : null;
  return { code, name };
}

function personDisplayName(person: ClusterTransferRequest["person"]): string {
  return (
    person.full_name ||
    `${person.first_name} ${person.last_name}`.trim() ||
    person.username
  );
}

function formatRequestedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatLocaleDate(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TransferArrow() {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      aria-hidden
    >
      <svg
        className="h-3.5 w-3.5 rotate-90 sm:rotate-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7l5 5m0 0l-5 5m5-5H6"
        />
      </svg>
    </span>
  );
}

function ClusterPill({
  cluster,
  tone,
}: {
  cluster: ClusterTransferRequest["from_cluster"];
  tone: "from" | "to";
}) {
  const { code, name } = clusterLabel(cluster);
  return (
    <div
      className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${
        tone === "from"
          ? "border-gray-200 bg-gray-50"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {tone === "from" ? "From" : "To"}
      </p>
      <p className="break-words text-sm font-semibold text-gray-900">{code}</p>
      {name ? (
        <p className="break-words text-xs text-gray-600">{name}</p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: ClusterTransferRequestStatus }) {
  const styles =
    status === "pending"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : status === "approved"
        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
        : "bg-rose-50 text-rose-800 border-rose-200";
  const label =
    status === "pending"
      ? "Pending"
      : status === "approved"
        ? "Approved"
        : "Rejected";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}

export default function ClusterTransfersPanel({
  canReview,
  onViewPerson,
}: ClusterTransfersPanelProps) {
  const [statusFilter, setStatusFilter] =
    useState<ClusterTransferRequestStatus>("pending");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [items, setItems] = useState<ClusterTransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const isHistoryTab =
    statusFilter === "approved" || statusFilter === "rejected";
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / HISTORY_PAGE_SIZE) || 1,
  );
  const currentPage = Math.min(page, totalPages);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const paginateHistory =
        statusFilter === "approved" || statusFilter === "rejected";
      const res = await clusterTransferRequestsApi.list({
        status: statusFilter,
        page: paginateHistory ? page : 1,
        page_size: paginateHistory ? HISTORY_PAGE_SIZE : 100,
      });
      setItems(res.data.results ?? []);
      setTotalCount(res.data.count ?? 0);
    } catch {
      setError("Could not load transfer requests.");
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isHistoryTab && page > totalPages) {
      setPage(totalPages);
    }
  }, [isHistoryTab, page, totalPages]);

  const review = async (id: number, action: "approve" | "reject") => {
    try {
      setActingId(id);
      if (action === "approve") {
        await clusterTransferRequestsApi.approve(id);
        toast.success("Transfer approved.");
      } else {
        await clusterTransferRequestsApi.reject(id);
        toast.success("Transfer rejected.");
      }
      await load();
    } catch {
      const message = `Could not ${action} transfer request.`;
      setError(message);
      toast.error(message);
    } finally {
      setActingId(null);
    }
  };

  const emptyCopy = useMemo(() => {
    if (statusFilter === "pending") {
      return {
        title: "No pending transfers",
        body: "When someone requests a cluster move, it will show up here for review.",
      };
    }
    if (statusFilter === "approved") {
      return {
        title: "No approved transfers yet",
        body: "Approved moves will appear here after a reviewer accepts them.",
      };
    }
    return {
      title: "No rejected transfers",
      body: "Rejected requests will be listed here for reference.",
    };
  }, [statusFilter]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-border bg-gradient-to-br from-primary/[0.06] via-white to-white px-4 py-5 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
              Cluster transfers
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Review moves between clusters. Approving leaves the source cluster,
              joins the destination, and sets it as primary.
            </p>
          </div>
          <Button
            type="button"
            variant="tertiary"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 self-start"
          >
            Refresh
          </Button>
        </div>

        <div
          className="mt-4 flex w-full rounded-lg border border-border bg-white p-1 sm:inline-flex sm:w-auto"
          role="tablist"
          aria-label="Transfer status"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4 md:p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
            <LoadingSpinner />
            <p className="-mt-2">Loading transfers…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-border">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {emptyCopy.title}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              {emptyCopy.body}
            </p>
          </div>
        ) : (
          <>
            <ul className={isHistoryTab ? "space-y-2" : "space-y-3"}>
              {items.map((item) => {
                const personName = personDisplayName(item.person);
                const requestedAt = formatRequestedAt(item.created_at);
                const requestedBy = item.requested_by
                  ? personDisplayName(item.requested_by)
                  : null;
                const reviewedAt = formatRequestedAt(item.reviewed_at);
                const reviewedBy = item.reviewed_by
                  ? personDisplayName(item.reviewed_by)
                  : null;
                const busy = actingId === item.id;
                const from = clusterLabel(item.from_cluster);
                const to = clusterLabel(item.to_cluster);
                const personStub = {
                  id: String(item.person.id),
                  first_name: item.person.first_name,
                  last_name: item.person.last_name,
                  username: item.person.username,
                } as Person;

                if (isHistoryTab) {
                  return (
                    <li
                      key={item.id}
                      className="rounded-lg border border-border bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <PersonAvatar person={personStub} size="xs" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {onViewPerson ? (
                              <button
                                type="button"
                                className="truncate text-left text-sm font-semibold text-gray-900 hover:text-primary hover:underline"
                                onClick={() =>
                                  onViewPerson({
                                    id: String(item.person.id),
                                  } as Person)
                                }
                              >
                                {personName}
                              </button>
                            ) : (
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {personName}
                              </p>
                            )}
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-600">
                            <span className="font-medium text-gray-800">
                              {from.code}
                            </span>
                            <span className="mx-1 text-gray-400">→</span>
                            <span className="font-medium text-gray-800">
                              {to.code}
                            </span>
                            {item.reason ? (
                              <span className="text-gray-500">
                                {" "}
                                · {item.reason}
                              </span>
                            ) : null}
                          </p>
                          {(reviewedBy || reviewedAt || item.review_note) && (
                            <p className="mt-0.5 truncate text-[11px] text-gray-500">
                              {[
                                reviewedBy
                                  ? `${item.status === "approved" ? "Approved" : "Rejected"} by ${reviewedBy}`
                                  : null,
                                reviewedAt,
                                item.review_note
                                  ? `Note: ${item.review_note}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <PersonAvatar person={personStub} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {onViewPerson ? (
                                <button
                                  type="button"
                                  className="break-words text-left text-base font-semibold text-gray-900 hover:text-primary hover:underline"
                                  onClick={() =>
                                    onViewPerson({
                                      id: String(item.person.id),
                                    } as Person)
                                  }
                                >
                                  {personName}
                                </button>
                              ) : (
                                <p className="break-words text-base font-semibold text-gray-900">
                                  {personName}
                                </p>
                              )}
                              <StatusBadge status={item.status} />
                              {item.person.role ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonRoleColor(item.person.role)}`}
                                >
                                  {item.person.role}
                                </span>
                              ) : null}
                              {item.person.status ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getPersonStatusColor(item.person.status)}`}
                                >
                                  {formatPersonStatusLabel(item.person.status)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 break-words text-xs text-gray-500">
                              {[
                                requestedBy
                                  ? `Requested by ${requestedBy}`
                                  : null,
                                requestedAt,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-stretch min-[420px]:gap-3">
                          <ClusterPill cluster={item.from_cluster} tone="from" />
                          <div className="flex items-center justify-center">
                            <TransferArrow />
                          </div>
                          <ClusterPill cluster={item.to_cluster} tone="to" />
                        </div>

                        {item.reason ? (
                          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              Reason
                            </p>
                            <p className="mt-0.5 text-sm text-gray-700 whitespace-pre-wrap break-words">
                              {item.reason}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {canReview && (
                        <div className="flex w-full shrink-0 flex-row gap-2 xl:w-auto xl:min-w-[9.5rem] xl:flex-col xl:self-start">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={busy}
                            onClick={() => void review(item.id, "approve")}
                            className="w-full flex-1 xl:flex-none"
                          >
                            {busy ? "Working…" : "Approve"}
                          </Button>
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={busy}
                            onClick={() => void review(item.id, "reject")}
                            className="w-full flex-1 xl:flex-none"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {isHistoryTab && totalCount > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                itemsPerPage={HISTORY_PAGE_SIZE}
                onPageChange={setPage}
                className="pt-2"
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

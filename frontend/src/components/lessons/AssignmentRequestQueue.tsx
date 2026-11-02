"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import {
  LessonAssignmentRequest,
  LessonPersonSummary,
} from "@/src/types/lesson";
import { formatPersonName } from "@/src/lib/name";
import {
  formatPersonClusterLabel,
  formatPersonStatusLabel,
  getPersonClusterChipClass,
  getPersonStatusColor,
} from "@/src/lib/personStatus";

const REQUESTS_PER_PAGE = 5;

interface AssignmentRequestQueueProps {
  title: string;
  description: string;
  requests: LessonAssignmentRequest[];
  loading?: boolean;
  error?: string | null;
  canReview?: boolean;
  reviewingId?: number | null;
  onApprove?: (id: number) => void;
  onReject?: (id: number, note: string) => void;
}

type AffiliationMatch = {
  clusters: string[];
  groups: string[];
};

function affiliationValues(person: LessonPersonSummary | null | undefined) {
  return {
    clusters: (person?.cluster_codes ?? []).filter(Boolean),
    groups: (person?.evangelism_group_names ?? []).filter(Boolean),
  };
}

function findAffiliationMatch(
  student: LessonPersonSummary,
  teacher: LessonPersonSummary | null,
): AffiliationMatch {
  if (!teacher) {
    return { clusters: [], groups: [] };
  }
  const studentValues = affiliationValues(student);
  const teacherValues = affiliationValues(teacher);
  const teacherClusters = new Set(teacherValues.clusters);
  const teacherGroups = new Set(teacherValues.groups);
  return {
    clusters: studentValues.clusters.filter((code) => teacherClusters.has(code)),
    groups: studentValues.groups.filter((name) => teacherGroups.has(name)),
  };
}

function PersonAffiliationChips({
  person,
  matchedClusters,
  matchedGroups,
}: {
  person: LessonPersonSummary;
  matchedClusters?: Set<string>;
  matchedGroups?: Set<string>;
}) {
  const clusterCodes = person.cluster_codes?.filter(Boolean) ?? [];
  const groupNames = person.evangelism_group_names?.filter(Boolean) ?? [];
  const hasCluster = clusterCodes.length > 0;
  const hasGroups = groupNames.length > 0;
  const matchedClusterSet = matchedClusters ?? new Set<string>();
  const matchedGroupSet = matchedGroups ?? new Set<string>();

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPersonStatusColor(person.status)}`}
      >
        {formatPersonStatusLabel(person.status)}
      </span>
      {(hasCluster || !hasGroups) && (
        <span
          className={
            clusterCodes.some((code) => matchedClusterSet.has(code))
              ? "inline-flex items-center rounded-full border border-teal-500 bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900 ring-2 ring-teal-200"
              : getPersonClusterChipClass(hasCluster)
          }
        >
          {formatPersonClusterLabel(clusterCodes)}
        </span>
      )}
      {hasGroups &&
        groupNames.map((name) => (
          <span
            key={name}
            className={
              matchedGroupSet.has(name)
                ? "inline-flex items-center rounded-full border border-teal-500 bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900 ring-2 ring-teal-200"
                : "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
            }
          >
            {name}
          </span>
        ))}
    </span>
  );
}

function MatchBanner({ match }: { match: AffiliationMatch }) {
  const hasClusterMatch = match.clusters.length > 0;
  const hasGroupMatch = match.groups.length > 0;
  if (!hasClusterMatch && !hasGroupMatch) {
    return null;
  }

  const parts: string[] = [];
  if (hasClusterMatch) {
    parts.push(
      match.clusters.length === 1
        ? `same cluster ${match.clusters[0]}`
        : `same clusters ${match.clusters.join(", ")}`,
    );
  }
  if (hasGroupMatch) {
    parts.push(
      match.groups.length === 1
        ? `same evangelism group ${match.groups[0]}`
        : `same evangelism groups ${match.groups.join(", ")}`,
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-teal-300 bg-gradient-to-r from-teal-50 to-emerald-50 px-3 py-2 text-xs text-teal-950">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white"
      >
        ✓
      </span>
      <p>
        <span className="font-semibold">Shared affiliation</span>
        <span className="text-teal-800"> — student and teacher are in the {parts.join(" and ")}.</span>
      </p>
    </div>
  );
}

export default function AssignmentRequestQueue({
  title,
  description,
  requests,
  loading = false,
  error = null,
  canReview = false,
  reviewingId = null,
  onApprove,
  onReject,
}: AssignmentRequestQueueProps) {
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(requests.length / REQUESTS_PER_PAGE) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(
    () =>
      requests.slice(
        (page - 1) * REQUESTS_PER_PAGE,
        page * REQUESTS_PER_PAGE,
      ),
    [page, requests],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      setRejectingId(null);
      setRejectNote("");
    }
  }, [currentPage, totalPages]);

  return (
    <Card title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{description}</p>
        {error && <ErrorMessage message={error} />}
        {loading ? (
          <LoadingSpinner />
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">No requests waiting for approval.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {paginatedRequests.map((request) => {
                const isReviewing = reviewingId === request.id;
                const isRejecting = rejectingId === request.id;
                const match = findAffiliationMatch(
                  request.student,
                  request.teacher,
                );
                const hasMatch =
                  match.clusters.length > 0 || match.groups.length > 0;
                const matchedClusters = new Set(match.clusters);
                const matchedGroups = new Set(match.groups);

                return (
                  <li
                    key={request.id}
                    className={
                      hasMatch
                        ? "space-y-3 rounded-lg border-2 border-teal-400 bg-teal-50/40 px-4 py-3 shadow-sm shadow-teal-100"
                        : "space-y-3 rounded-lg border border-gray-200 px-4 py-3"
                    }
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                          <p className="font-medium text-foreground">
                            {formatPersonName(request.student)}
                          </p>
                          <PersonAffiliationChips
                            person={request.student}
                            matchedClusters={matchedClusters}
                            matchedGroups={matchedGroups}
                          />
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                          <p className="text-sm text-gray-600">
                            Teacher:{" "}
                            {request.teacher
                              ? formatPersonName(request.teacher)
                              : "Unknown teacher"}
                          </p>
                          {request.teacher ? (
                            <PersonAffiliationChips
                              person={request.teacher}
                              matchedClusters={matchedClusters}
                              matchedGroups={matchedGroups}
                            />
                          ) : null}
                        </div>
                        <MatchBanner match={match} />
                      </div>
                      {canReview && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            onClick={() => onApprove?.(request.id)}
                            disabled={isReviewing}
                          >
                            {isReviewing ? "Saving..." : "Approve"}
                          </Button>
                          <Button
                            variant="tertiary"
                            onClick={() => {
                              setRejectingId(isRejecting ? null : request.id);
                              setRejectNote("");
                            }}
                            disabled={isReviewing}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    {canReview && isRejecting && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Note (optional)
                        </label>
                        <textarea
                          value={rejectNote}
                          onChange={(event) => setRejectNote(event.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="flex justify-end">
                          <Button
                            variant="secondary"
                            disabled={isReviewing}
                            onClick={() => {
                              onReject?.(request.id, rejectNote.trim());
                              setRejectingId(null);
                              setRejectNote("");
                            }}
                          >
                            Confirm reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={requests.length}
              itemsPerPage={REQUESTS_PER_PAGE}
              onPageChange={(nextPage) => {
                setCurrentPage(nextPage);
                setRejectingId(null);
                setRejectNote("");
              }}
            />
          </>
        )}
      </div>
    </Card>
  );
}

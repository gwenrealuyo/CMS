"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { LessonAssignmentRequest } from "@/src/types/lesson";
import { formatPersonName } from "@/src/lib/name";

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

function lessonLabel(request: LessonAssignmentRequest): string {
  if (!request.lessons?.length) {
    return "Teacher assignment only";
  }
  return [...request.lessons]
    .sort((first, second) => first.order - second.order)
    .map((lesson) => lesson.title)
    .join(", ");
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
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {requests.map((request) => {
              const isReviewing = reviewingId === request.id;
              const isRejecting = rejectingId === request.id;
              return (
                <li key={request.id} className="space-y-3 px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">
                        {formatPersonName(request.student)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Teacher:{" "}
                        {request.teacher
                          ? formatPersonName(request.teacher)
                          : "Unknown teacher"}
                      </p>
                      <p className="text-sm text-gray-600">
                        Lessons: {lessonLabel(request)}
                      </p>
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
        )}
      </div>
    </Card>
  );
}

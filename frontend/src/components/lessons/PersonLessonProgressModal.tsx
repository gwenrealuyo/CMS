"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  Lesson,
  LessonPersonSummary,
  LessonStudentEnrollment,
  LessonTeacherTransfer,
  PersonLessonProgress,
} from "@/src/types/lesson";
import { lessonsApi } from "@/src/lib/api";
import { formatPersonName } from "@/src/lib/name";
import { formatDisplayDate } from "@/src/lib/date";
import { extractErrorMessage, LessonPersonLike } from "@/src/lib/lessonsUtils";

interface PersonLessonProgressModalProps {
  isOpen: boolean;
  person: LessonPersonSummary | null;
  allProgress: PersonLessonProgress[];
  allLessons: Lesson[];
  enrollment: LessonStudentEnrollment | null;
  teacherChoices: LessonPersonLike[];
  canTransferTeacher: boolean;
  onTransferTeacher: (
    enrollmentId: number,
    teacherId: number,
    note?: string
  ) => Promise<void>;
  onRequestCommitmentToggle: (
    enrollment: LessonStudentEnrollment,
    person: LessonPersonSummary | null
  ) => void;
  isProgressUpdating: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-gray-100 text-gray-700",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

export default function PersonLessonProgressModal({
  isOpen,
  person,
  allProgress,
  allLessons,
  enrollment,
  teacherChoices,
  canTransferTeacher,
  onTransferTeacher,
  onRequestCommitmentToggle,
  isProgressUpdating,
  onClose,
}: PersonLessonProgressModalProps) {
  const [isTransferOpen, setTransferOpen] = useState(false);
  const [transferTeacherId, setTransferTeacherId] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<LessonTeacherTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [showTransferHistory, setShowTransferHistory] = useState(false);

  const teacher = enrollment?.teacher ?? null;

  const teacherSelectOptions = useMemo(
    () =>
      teacherChoices
        .filter((choice) => choice.id?.toString() !== teacher?.id?.toString())
        .map((choice) => ({
          value: choice.id?.toString() ?? "",
          label: formatPersonName(choice),
        })),
    [teacher?.id, teacherChoices]
  );

  useEffect(() => {
    if (!isOpen) {
      setTransferOpen(false);
      setTransferTeacherId("");
      setTransferNote("");
      setTransferError(null);
      setShowTransferHistory(false);
      setTransfers([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !enrollment?.id) {
      setTransfers([]);
      return;
    }

    let cancelled = false;
    setTransfersLoading(true);
    lessonsApi
      .listEnrollmentTransfers(enrollment.id)
      .then((response) => {
        if (!cancelled) {
          setTransfers(response.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTransfers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTransfersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enrollment?.id, isOpen, enrollment?.teacher?.id]);

  const personProgress = useMemo(() => {
    if (!person) return [];
    return allProgress
      .filter((p) => p.person?.id === person.id)
      .sort((a, b) => a.lesson.order - b.lesson.order);
  }, [person, allProgress]);

  const allLessonsWithProgress = useMemo(() => {
    const progressMap = new Map<number, PersonLessonProgress>();
    personProgress.forEach((p) => {
      progressMap.set(p.lesson.id, p);
    });

    return allLessons
      .filter((lesson) => lesson.is_latest && lesson.is_active)
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({
        lesson,
        progress: progressMap.get(lesson.id) || null,
      }));
  }, [allLessons, personProgress]);

  const canMarkCommitmentSigned = useMemo(() => {
    if (allLessonsWithProgress.length === 0) {
      return false;
    }
    return allLessonsWithProgress.every(
      ({ progress }) => progress?.status === "COMPLETED"
    );
  }, [allLessonsWithProgress]);

  const handleTransferSubmit = async () => {
    if (!enrollment || !transferTeacherId) {
      return;
    }
    try {
      setTransferSubmitting(true);
      setTransferError(null);
      await onTransferTeacher(
        enrollment.id,
        Number(transferTeacherId),
        transferNote.trim() || undefined
      );
      setTransferOpen(false);
      setTransferTeacherId("");
      setTransferNote("");
    } catch (error: unknown) {
      setTransferError(
        extractErrorMessage(error, "Failed to transfer teacher.")
      );
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (!person) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${formatPersonName(person)} - Lesson Progress`}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Teacher:</span>{" "}
                {teacher ? (
                  <span className="font-semibold text-primary">
                    {formatPersonName(teacher)}
                  </span>
                ) : (
                  <span className="text-gray-500">No teacher</span>
                )}
              </p>
              {canTransferTeacher && enrollment && (
                <Button
                  variant="tertiary"
                  className="w-full sm:w-auto min-h-[40px] text-sm"
                  onClick={() => setTransferOpen(true)}
                >
                  Change teacher
                </Button>
              )}
            </div>
            {person.member_id?.trim() && (
              <p className="text-xs text-gray-500">
                Member ID: {person.member_id}
              </p>
            )}
            {enrollment && (
              <div className="pt-1 border-t border-gray-200">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setShowTransferHistory((open) => !open)}
                >
                  {showTransferHistory ? "Hide" : "Show"} transfer history
                </button>
                {showTransferHistory && (
                  <div className="mt-2 space-y-2">
                    {transfersLoading ? (
                      <p className="text-sm text-gray-500">Loading history…</p>
                    ) : transfers.length === 0 ? (
                      <p className="text-sm text-gray-500">No transfers yet.</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {transfers.map((transfer) => (
                          <li
                            key={transfer.id}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2"
                          >
                            <p className="font-medium text-gray-900">
                              {formatDisplayDate(transfer.created_at)}
                            </p>
                            <p>
                              {transfer.from_teacher
                                ? formatPersonName(transfer.from_teacher)
                                : "—"}{" "}
                              → {formatPersonName(transfer.to_teacher)}
                            </p>
                            {transfer.transferred_by && (
                              <p className="text-xs text-gray-500">
                                By {formatPersonName(transfer.transferred_by)}
                              </p>
                            )}
                            {transfer.note?.trim() && (
                              <p className="text-xs text-gray-600 mt-1">
                                {transfer.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            {allLessonsWithProgress.map(({ lesson, progress }) => (
              <div
                key={lesson.id}
                className="border border-gray-200 rounded-lg p-4 space-y-2"
              >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          Lesson {lesson.order}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {lesson.title}
                        </h3>
                      </div>
                      {lesson.version_label && (
                        <span className="chip-primary-sm mt-1">
                          {lesson.version_label}
                        </span>
                      )}
                    </div>
                    {progress && (
                      <span
                        className={
                          progress.status === "IN_PROGRESS"
                            ? "chip-in-progress"
                            : `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                STATUS_COLORS[progress.status] ||
                                STATUS_COLORS.ASSIGNED
                              }`
                        }
                      >
                        {STATUS_LABELS[progress.status] || progress.status}
                      </span>
                    )}
                    {!progress && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-500">
                        Not Assigned
                      </span>
                    )}
                  </div>

                  {progress && (
                    <div className="mt-3 space-y-2 text-sm text-gray-600">
                      {progress.assigned_at && (
                        <div>
                          <span className="font-medium">Assigned:</span>{" "}
                          {formatDisplayDate(progress.assigned_at)}
                        </div>
                      )}
                      {progress.started_at && (
                        <div>
                          <span className="font-medium">Started:</span>{" "}
                          {formatDisplayDate(progress.started_at)}
                        </div>
                      )}
                      {progress.completed_at && (
                        <div>
                          <span className="font-medium">Completed:</span>{" "}
                          {formatDisplayDate(progress.completed_at)}
                        </div>
                      )}
                      {progress.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="font-medium">Notes:</span>
                          <p className="mt-1 text-gray-700 whitespace-pre-wrap">
                            {progress.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
          {enrollment && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Commitment Form Signature
                  </p>
                  {enrollment.commitment_signed ? (
                    <p className="text-sm text-green-700">
                      ✓ Signed
                      {enrollment.commitment_signed_at
                        ? ` (${formatDisplayDate(enrollment.commitment_signed_at)})`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">Not signed</p>
                  )}
                </div>
                <Button
                  variant="tertiary"
                  className="min-h-[36px] text-xs px-3 py-1.5"
                  disabled={
                    isProgressUpdating ||
                    (!enrollment.commitment_signed && !canMarkCommitmentSigned)
                  }
                  onClick={() => onRequestCommitmentToggle(enrollment, person)}
                >
                  {enrollment.commitment_signed
                    ? "Remove commitment signature"
                    : "Mark commitment signed"}
                </Button>
              </div>
              {!enrollment.commitment_signed && !canMarkCommitmentSigned && (
                <p className="mt-1 text-xs text-gray-500">
                  Available after all lessons are completed.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isTransferOpen}
        onClose={() => {
          if (transferSubmitting) return;
          setTransferOpen(false);
          setTransferError(null);
        }}
        title="Transfer teacher"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign a new lessons teacher for {formatPersonName(person)}. Session
            logs keep their own teacher and do not change this assignment.
          </p>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              New teacher
            </label>
            <ScalableSelect
              options={teacherSelectOptions}
              value={transferTeacherId}
              onChange={setTransferTeacherId}
              placeholder="Select teacher..."
              searchPlaceholder="Search teacher..."
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="transfer-note"
              className="block text-sm font-medium text-gray-700"
            >
              Note (optional)
            </label>
            <textarea
              id="transfer-note"
              value={transferNote}
              onChange={(event) => setTransferNote(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Reason for transfer..."
            />
          </div>
          {transferError && <ErrorMessage message={transferError} />}
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
            <Button
              variant="tertiary"
              className="min-h-[44px]"
              disabled={transferSubmitting}
              onClick={() => setTransferOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={transferSubmitting || !transferTeacherId}
              onClick={handleTransferSubmit}
            >
              {transferSubmitting ? "Saving..." : "Transfer teacher"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

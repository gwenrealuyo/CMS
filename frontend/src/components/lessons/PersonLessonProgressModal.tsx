"use client";

import { useMemo } from "react";
import Modal from "@/src/components/ui/Modal";
import { LessonPersonSummary, PersonLessonProgress, Lesson } from "@/src/types/lesson";
import { formatPersonName } from "@/src/lib/name";

interface PersonLessonProgressModalProps {
  isOpen: boolean;
  person: LessonPersonSummary | null;
  allProgress: PersonLessonProgress[];
  allLessons: Lesson[];
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
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

export default function PersonLessonProgressModal({
  isOpen,
  person,
  allProgress,
  allLessons,
  onClose,
}: PersonLessonProgressModalProps) {
  const personProgress = useMemo(() => {
    if (!person) return [];
    return allProgress
      .filter(p => p.person?.id === person.id)
      .sort((a, b) => a.lesson.order - b.lesson.order);
  }, [person, allProgress]);

  const allLessonsWithProgress = useMemo(() => {
    const progressMap = new Map<number, PersonLessonProgress>();
    personProgress.forEach(p => {
      progressMap.set(p.lesson.id, p);
    });

    return allLessons
      .filter(lesson => lesson.is_latest && lesson.is_active)
      .sort((a, b) => a.order - b.order)
      .map(lesson => ({
        lesson,
        progress: progressMap.get(lesson.id) || null,
      }));
  }, [allLessons, personProgress]);

  if (!person) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${formatPersonName(person)} - Lesson Progress`}>
      <div className="space-y-4">
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
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
                      <p className="text-xs text-gray-500 mt-1">
                        {lesson.version_label}
                      </p>
                    )}
                  </div>
                  {progress && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_COLORS[progress.status] || STATUS_COLORS.ASSIGNED
                      }`}
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
                        {new Date(progress.assigned_at).toLocaleDateString()}
                      </div>
                    )}
                    {progress.started_at && (
                      <div>
                        <span className="font-medium">Started:</span>{" "}
                        {new Date(progress.started_at).toLocaleDateString()}
                      </div>
                    )}
                    {progress.completed_at && (
                      <div>
                        <span className="font-medium">Completed:</span>{" "}
                        {new Date(progress.completed_at).toLocaleDateString()}
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
                    {progress.commitment_signed && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="font-medium text-green-700">
                          ✓ Commitment Form Signed
                        </span>
                        {progress.commitment_signed_at && (
                          <span className="text-gray-500 ml-2">
                            ({new Date(progress.commitment_signed_at).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}




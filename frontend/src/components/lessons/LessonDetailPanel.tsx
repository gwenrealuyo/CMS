import { useEffect, useState } from "react";

import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { Lesson } from "@/src/types/lesson";

interface LessonDetailPanelProps {
  lesson: Lesson | null;
  onEdit?: (lesson: Lesson) => void;
}

export default function LessonDetailPanel({
  lesson,
  onEdit,
}: LessonDetailPanelProps) {
  const [showJourney, setShowJourney] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  useEffect(() => {
    setShowJourney(false);
    setShowMetadata(false);
  }, [lesson?.id]);

  if (!lesson) {
    return (
      <Card title="Lesson Details">
        <div className="text-center text-gray-500 py-16 border border-dashed border-gray-200 rounded-lg">
          Select a lesson from the list to view its details and participant
          progress.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Lesson Details"
      headerAction={
        onEdit ? (
          <Button
            variant="tertiary"
            className="w-full sm:w-auto min-h-[44px] text-sm"
            onClick={() => onEdit(lesson)}
          >
            Edit Lesson
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {lesson.version_label}
            </span>
            {lesson.is_latest ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                Latest version
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                Superseded version
              </span>
            )}
            {!lesson.is_active && (
              <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-[#2D3748] mt-3">
            {lesson.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wide">
            Order: Step {lesson.order} · Code: {lesson.code}
          </p>
        </div>

        {lesson.summary && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Summary
            </h3>
            <p className="mt-2 text-gray-700 whitespace-pre-line">
              {lesson.summary}
            </p>
          </div>
        )}

        {lesson.outline && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Outline
            </h3>
            <p className="mt-2 text-gray-700 whitespace-pre-line">
              {lesson.outline}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Journey Settings
              </h4>
              <button
                type="button"
                onClick={() => setShowJourney((prev) => !prev)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showJourney ? "Hide" : "Show"}
              </button>
            </div>
            {showJourney && (
              <>
                <p className="mt-2 text-sm text-gray-600">
                  Type:{" "}
                  <span className="font-medium text-gray-800">
                    {lesson.journey_config?.journey_type ?? "NOTE"}
                  </span>
                </p>
                {lesson.journey_config?.title_template && (
                  <p className="mt-2 text-sm text-gray-600">
                    Title template:
                    <span className="block font-medium text-gray-800">
                      {lesson.journey_config.title_template}
                    </span>
                  </p>
                )}
                {lesson.journey_config?.note_template && (
                  <p className="mt-2 text-sm text-gray-600">
                    Note template:
                    <span className="block font-medium text-gray-800 whitespace-pre-line">
                      {lesson.journey_config.note_template}
                    </span>
                  </p>
                )}
                {!lesson.journey_config && (
                  <p className="mt-2 text-sm text-gray-500">
                    No journey settings configured yet.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Metadata
              </h4>
              <button
                type="button"
                onClick={() => setShowMetadata((prev) => !prev)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showMetadata ? "Hide" : "Show"}
              </button>
            </div>
            {showMetadata && (
              <dl className="mt-2 text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <dt>Created</dt>
                  <dd className="font-medium text-gray-800">
                    {lesson.created_at
                      ? new Date(lesson.created_at).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Updated</dt>
                  <dd className="font-medium text-gray-800">
                    {lesson.updated_at
                      ? new Date(lesson.updated_at).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}


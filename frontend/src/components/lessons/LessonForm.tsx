import { FormEvent, useEffect, useState } from "react";
import Button from "@/src/components/ui/Button";
import { Lesson, LessonJourneyConfig } from "@/src/types/lesson";
import { JourneyType } from "@/src/types/person";

const JOURNEY_TYPE_OPTIONS: JourneyType[] = [
  "NOTE",
  "LESSON",
  "BAPTISM",
  "SPIRIT",
  "CLUSTER",
  "EVENT_ATTENDANCE",
];

export interface LessonFormValues {
  code: string;
  version_label: string;
  title: string;
  summary: string;
  outline: string;
  order: number;
  is_latest: boolean;
  is_active: boolean;
  journey_config: LessonJourneyConfig;
}

interface LessonFormProps {
  lesson?: Lesson | null;
  submitting?: boolean;
  deleteDisabled?: boolean;
  onSubmit: (values: LessonFormValues) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function LessonForm({
  lesson,
  submitting = false,
  deleteDisabled = false,
  onSubmit,
  onCancel,
  onDelete,
}: LessonFormProps) {
  const [code, setCode] = useState(lesson?.code ?? "");
  const [versionLabel, setVersionLabel] = useState(
    lesson?.version_label ?? "v1"
  );
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [summary, setSummary] = useState(lesson?.summary ?? "");
  const [outline, setOutline] = useState(lesson?.outline ?? "");
  const [order, setOrder] = useState<string>(
    lesson?.order ? String(lesson.order) : "1"
  );
  const [isLatest, setIsLatest] = useState<boolean>(lesson?.is_latest ?? true);
  const [isActive, setIsActive] = useState<boolean>(lesson?.is_active ?? true);
  const [journeyType, setJourneyType] = useState<JourneyType>(
    lesson?.journey_config?.journey_type ?? "NOTE"
  );
  const [journeyTitle, setJourneyTitle] = useState<string>(
    lesson?.journey_config?.title_template ?? ""
  );
  const [journeyNote, setJourneyNote] = useState<string>(
    lesson?.journey_config?.note_template ?? ""
  );
  const isEditing = Boolean(lesson);
  const [showJourneyFields, setShowJourneyFields] = useState<boolean>(
    !isEditing
  );

  useEffect(() => {
    if (!lesson) {
      setShowJourneyFields(true);
      return;
    }
    setCode(lesson.code);
    setVersionLabel(lesson.version_label);
    setTitle(lesson.title);
    setSummary(lesson.summary ?? "");
    setOutline(lesson.outline ?? "");
    setOrder(String(lesson.order));
    setIsLatest(lesson.is_latest);
    setIsActive(lesson.is_active);
    setJourneyType(lesson.journey_config?.journey_type ?? "NOTE");
    setJourneyTitle(lesson.journey_config?.title_template ?? "");
    setJourneyNote(lesson.journey_config?.note_template ?? "");
    setShowJourneyFields(false);
  }, [lesson]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const numericOrder = Number(order);
    if (Number.isNaN(numericOrder) || numericOrder <= 0) {
      alert("Order must be a positive number.");
      return;
    }

    onSubmit({
      code: code.trim(),
      version_label: versionLabel.trim() || "v1",
      title: title.trim(),
      summary: summary.trim(),
      outline: outline.trim(),
      order: numericOrder,
      is_latest: isLatest,
      is_active: isActive,
      journey_config: {
        journey_type: journeyType,
        title_template: journeyTitle.trim(),
        note_template: journeyNote.trim(),
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lesson Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="conversion-journey-01"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            A stable identifier reused across versions (e.g.,
            conversion-journey-01).
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version Label
          </label>
          <input
            type="text"
            value={versionLabel}
            onChange={(event) => setVersionLabel(event.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="v1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Order
          </label>
          <input
            type="number"
            min={1}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isLatest}
              onChange={(event) => setIsLatest(event.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Mark as latest version
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Active
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Living on Mission Every Day"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Short overview of the lesson focus..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Outline / Notes
        </label>
        <textarea
          value={outline}
          onChange={(event) => setOutline(event.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Key points or sections..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Journey Settings
            </p>
            <p className="text-xs text-gray-500">
              Configure how this lesson appears on participant timelines.
            </p>
          </div>
          <Button
            type="button"
            variant="tertiary"
            className="text-sm !py-2 !px-4"
            onClick={() => setShowJourneyFields((previous) => !previous)}
          >
            {showJourneyFields ? "Hide Journey Fields" : "Show Journey Fields"}
          </Button>
        </div>

        {showJourneyFields && (
          <div className="space-y-4 rounded-lg border border-dashed border-gray-300 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Journey Type
                </label>
                <select
                  value={journeyType}
                  onChange={(event) =>
                    setJourneyType(event.target.value as JourneyType)
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {JOURNEY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Journey Title Template
                </label>
                <input
                  type="text"
                  value={journeyTitle}
                  onChange={(event) => setJourneyTitle(event.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Completed Lesson X: ..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Journey Note Template
              </label>
              <textarea
                value={journeyNote}
                onChange={(event) => setJourneyNote(event.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comment that appears when the journey note is created..."
              />
            </div>
          </div>
        )}
      </div>

      {onDelete && isEditing && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="tertiary"
            onClick={onDelete}
            disabled={submitting || deleteDisabled}
            className="text-xs text-red-600 hover:text-red-700 !py-0 !px-0 border-none bg-transparent hover:bg-transparent hover:underline shadow-none"
          >
            Delete Lesson
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="tertiary"
          onClick={onCancel}
          disabled={submitting}
          className="w-full text-sm !py-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full text-sm !py-2"
        >
          {submitting ? "Saving..." : "Save Lesson"}
        </Button>
      </div>
    </form>
  );
}

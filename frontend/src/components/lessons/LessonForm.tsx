import { FormEvent, useEffect, useState } from "react";
import Button from "@/src/components/ui/Button";
import { Lesson, LessonMilestoneConfig } from "@/src/types/lesson";
import { MilestoneType } from "@/src/types/person";

const MILESTONE_TYPE_OPTIONS: MilestoneType[] = [
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
  milestone_config: LessonMilestoneConfig;
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
  const [milestoneType, setMilestoneType] = useState<MilestoneType>(
    lesson?.milestone_config?.milestone_type ?? "NOTE"
  );
  const [milestoneTitle, setMilestoneTitle] = useState<string>(
    lesson?.milestone_config?.title_template ?? ""
  );
  const [milestoneNote, setMilestoneNote] = useState<string>(
    lesson?.milestone_config?.note_template ?? ""
  );
  const isEditing = Boolean(lesson);
  const [showMilestoneFields, setShowMilestoneFields] = useState<boolean>(
    !isEditing
  );

  useEffect(() => {
    if (!lesson) {
      setShowMilestoneFields(true);
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
    setMilestoneType(lesson.milestone_config?.milestone_type ?? "NOTE");
    setMilestoneTitle(lesson.milestone_config?.title_template ?? "");
    setMilestoneNote(lesson.milestone_config?.note_template ?? "");
    setShowMilestoneFields(false);
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
      milestone_config: {
        milestone_type: milestoneType,
        title_template: milestoneTitle.trim(),
        note_template: milestoneNote.trim(),
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
              Milestone Settings
            </p>
            <p className="text-xs text-gray-500">
              Configure how this lesson appears on participant timelines.
            </p>
          </div>
          <Button
            type="button"
            variant="tertiary"
            className="text-sm !py-2 !px-4"
            onClick={() => setShowMilestoneFields((previous) => !previous)}
          >
            {showMilestoneFields
              ? "Hide Milestone Fields"
              : "Show Milestone Fields"}
          </Button>
        </div>

        {showMilestoneFields && (
          <div className="space-y-4 rounded-lg border border-dashed border-gray-300 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Milestone Type
                </label>
                <select
                  value={milestoneType}
                  onChange={(event) =>
                    setMilestoneType(event.target.value as MilestoneType)
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MILESTONE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Milestone Title Template
                </label>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(event) => setMilestoneTitle(event.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Completed Lesson X: ..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Milestone Note Template
              </label>
              <textarea
                value={milestoneNote}
                onChange={(event) => setMilestoneNote(event.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comment that appears when the milestone note is created..."
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

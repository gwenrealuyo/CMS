import { Lesson } from "@/src/types/lesson";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";

interface LessonListProps {
  lessons: Lesson[];
  selectedLessonId: number | null;
  onSelect: (lesson: Lesson) => void;
  onEdit?: (lesson: Lesson) => void;
  onCreateNew?: () => void;
}

export default function LessonList({
  lessons,
  selectedLessonId,
  onSelect,
  onEdit: _onEdit,
  onCreateNew,
}: LessonListProps) {
  return (
    <Card
      title="Lesson Catalog"
      headerAction={
        onCreateNew ? (
          <Button
            onClick={onCreateNew}
            className="w-full sm:w-auto min-h-[44px] text-sm"
          >
            Add Lesson
          </Button>
        ) : undefined
      }
    >
      {lessons.length === 0 ? (
        <div className="text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg">
          No lessons available yet. Create the first one to get started.
        </div>
      ) : (
        <div className="w-full space-y-3">
          {lessons.map((lesson) => {
            const isSelected = lesson.id === selectedLessonId;

            return (
              <button
                key={`${lesson.code}-${lesson.version_label}-${lesson.id}`}
                type="button"
                onClick={() => onSelect(lesson)}
                className={`card-list-row box-border w-full px-4 py-3 text-left ${
                  isSelected ? "card-list-row--selected" : ""
                }`}
              >
                <div className="flex w-full min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-500">
                        Step {lesson.order}
                      </span>
                      <span className="chip-primary-sm">
                        {lesson.version_label}
                      </span>
                      {lesson.is_latest ? (
                        <span className="chip-green-sm text-[11px]">
                          Latest
                        </span>
                      ) : (
                        <span className="chip-yellow-sm text-[11px]">
                          Superseded
                        </span>
                      )}
                      {!lesson.is_active && (
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 break-words text-lg font-semibold text-foreground">
                      {lesson.title}
                    </h4>
                    {lesson.short_title?.trim() ? (
                      <p className="mt-0.5 break-words text-sm text-gray-600">
                        Short title: {lesson.short_title.trim()}
                      </p>
                    ) : null}
                    {lesson.summary && (
                      <p className="mt-1 break-words text-sm text-gray-500">
                        {lesson.summary}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

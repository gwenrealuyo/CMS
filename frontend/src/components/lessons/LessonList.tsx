import { Lesson } from "@/src/types/lesson";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";

interface LessonListProps {
  lessons: Lesson[];
  selectedLessonId: number | null;
  onSelect: (lesson: Lesson) => void;
  onEdit: (lesson: Lesson) => void;
  onCreateNew: () => void;
}

export default function LessonList({
  lessons,
  selectedLessonId,
  onSelect,
  onEdit,
  onCreateNew,
}: LessonListProps) {
  return (
    <Card
      title="Lesson Catalog"
      headerAction={
        <Button onClick={onCreateNew} className="text-sm">
          Add Lesson
        </Button>
      }
    >
      {lessons.length === 0 ? (
        <div className="text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg">
          No lessons available yet. Create the first one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const isSelected = lesson.id === selectedLessonId;

            return (
              <button
                key={`${lesson.code}-${lesson.version_label}-${lesson.id}`}
                type="button"
                onClick={() => onSelect(lesson)}
                className={`w-full text-left border rounded-lg px-4 py-3 transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-500">
                        Step {lesson.order}
                      </span>
                      {/* <span className="text-sm font-medium text-[#2563EB]">
                        {lesson.version_label}
                      </span>
                      {lesson.is_latest ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          Latest
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                          Superseded
                        </span>
                      )} */}
                      {!lesson.is_active && (
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-[#2D3748] mt-1">
                      {lesson.title}
                    </h4>
                    {lesson.summary && (
                      <p className="text-sm text-gray-500 mt-1">
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

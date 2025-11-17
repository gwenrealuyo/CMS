import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LessonProgressTable from "./LessonProgressTable";
import AssignLessonsDropdown from "./AssignLessonsDropdown";
import { Lesson, PersonProgressSummary } from "@/src/types/lesson";
import { Person } from "@/src/types/person";

interface MemberProgressSectionProps {
  allLessons: Lesson[];
  groupedProgress: PersonProgressSummary[];
  progressLoading: boolean;
  progressError: string | null;
  progressActionError: string | null;
  progressFilterLessonId: number | null;
  onProgressFilterChange: (lessonId: number | null) => void;
  people: Person[];
  peopleLoading: boolean;
  peopleError: string | null;
  assigning: boolean;
  assignError: string | null;
  onAssignLessons: (personIds: string[], lessonIds: number[]) => void;
  onPersonClick: (person: {
    id: number;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    suffix?: string;
    username: string;
    member_id?: string;
  }) => void;
}

export default function MemberProgressSection({
  allLessons,
  groupedProgress,
  progressLoading,
  progressError,
  progressActionError,
  progressFilterLessonId,
  onProgressFilterChange,
  people,
  peopleLoading,
  peopleError,
  assigning,
  assignError,
  onAssignLessons,
  onPersonClick,
}: MemberProgressSectionProps) {
  const activeLatestLessons = allLessons.filter(
    (lesson) => lesson.is_latest && lesson.is_active
  );

  return (
    <Card title="Participant Progress">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 sm:max-w-md">
            View all participants taking lessons and their overall progress.
          </p>
          <div className="flex gap-3">
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={progressFilterLessonId || ""}
              onChange={(e) =>
                onProgressFilterChange(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">All Participants</option>
              {activeLatestLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
            <AssignLessonsDropdown
              allLessons={activeLatestLessons}
              people={people}
              peopleLoading={peopleLoading}
              peopleError={peopleError}
              assigning={assigning}
              assignError={assignError}
              onAssignLessons={onAssignLessons}
            />
          </div>
        </div>

        {progressActionError && <ErrorMessage message={progressActionError} />}
        {assignError && <ErrorMessage message={assignError} />}

        <div className="-mx-6 overflow-x-auto">
          <div className="min-w-[720px] px-6">
            <LessonProgressTable
              groupedProgress={groupedProgress}
              loading={progressLoading}
              error={progressError}
              onPersonClick={onPersonClick}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

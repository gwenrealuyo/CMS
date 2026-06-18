"use client";

import { useState } from "react";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import LessonProgressTable from "./LessonProgressTable";
import AssignLessonsDropdown from "./AssignLessonsDropdown";
import {
  Lesson,
  LessonPersonSummary,
  LessonProgressStatus,
  LessonStudentEnrollment,
  PersonProgressSummary,
} from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { LessonPersonLike } from "@/src/lib/lessonsUtils";
import {
  effectiveListViewMode,
  getInitialListViewMode,
  useIsMdUp,
  useIsTabletUp,
} from "@/src/lib/listViewMode";
import {
  TOOLBAR_CARD_CLASS,
} from "@/src/lib/toolbarStyles";

type ProgressSortField =
  | "person"
  | "teacher"
  | "previousLesson"
  | "progress"
  | "nextLesson"
  | "status";
type ProgressStatusFilter = "ALL" | LessonProgressStatus;

interface MemberProgressSectionProps {
  allLessons: Lesson[];
  groupedProgress: PersonProgressSummary[];
  studentTeacherById: Map<number, LessonPersonSummary>;
  progressLoading: boolean;
  progressError: string | null;
  progressActionError: string | null;
  progressFilterLessonId: number | null;
  onProgressFilterChange: (lessonId: number | null) => void;
  progressSearchQuery: string;
  onProgressSearchQueryChange: (value: string) => void;
  progressStatusFilter: ProgressStatusFilter;
  onProgressStatusFilterChange: (value: ProgressStatusFilter) => void;
  progressSortField: ProgressSortField;
  progressSortDirection: "asc" | "desc";
  onProgressSortChange: (field: ProgressSortField) => void;
  people: Person[];
  peopleLoading: boolean;
  peopleError: string | null;
  assigning: boolean;
  assignError: string | null;
  onAssignLessons: (
    personIds: string[],
    lessonIds: number[],
    teacherId: string,
  ) => void;
  enrollmentByStudent: Map<number, LessonStudentEnrollment>;
  assignedStudentIds: Set<number>;
  defaultTeacherId: string | null;
  teacherChoices: LessonPersonLike[];
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
  studentTeacherById,
  progressLoading,
  progressError,
  progressActionError,
  progressFilterLessonId,
  onProgressFilterChange,
  progressSearchQuery,
  onProgressSearchQueryChange,
  progressStatusFilter,
  onProgressStatusFilterChange,
  progressSortField,
  progressSortDirection,
  onProgressSortChange,
  people,
  peopleLoading,
  peopleError,
  assigning,
  assignError,
  onAssignLessons,
  enrollmentByStudent,
  assignedStudentIds,
  defaultTeacherId,
  teacherChoices,
  onPersonClick,
}: MemberProgressSectionProps) {
  const activeLatestLessons = allLessons.filter(
    (lesson) => lesson.is_latest && lesson.is_active,
  );
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("table"),
  );
  const isTabletUp = useIsTabletUp();
  const isMdUp = useIsMdUp();
  const effectiveViewMode = effectiveListViewMode(viewMode, isTabletUp);

  return (
    <Card title="Student Progress">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          View all students taking lessons and their overall progress.
        </p>

        <div className={TOOLBAR_CARD_CLASS}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
            <ToolbarSearch
              fullWidth
              className="md:min-w-0 md:max-w-none md:flex-[2]"
              value={progressSearchQuery}
              onChange={onProgressSearchQueryChange}
              placeholder="Search student..."
              ariaLabel="Search student"
            />

            <ViewModeToggle
              className="w-full md:w-auto md:shrink-0"
              compact={isMdUp}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            <select
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:min-w-0 md:max-w-[9rem] md:flex-1 md:truncate"
              value={progressFilterLessonId || ""}
              onChange={(e) =>
                onProgressFilterChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              aria-label="Filter by lesson"
            >
              <option value="">All lessons</option>
              {activeLatestLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>

            <select
              value={progressStatusFilter}
              onChange={(e) =>
                onProgressStatusFilterChange(
                  e.target.value as ProgressStatusFilter,
                )
              }
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:min-w-0 md:max-w-[8rem] md:flex-1 md:truncate"
              aria-label="Filter by status"
            >
              <option value="ALL">All status</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="SKIPPED">Skipped</option>
            </select>

            <div className="w-full md:w-auto md:shrink-0">
              <AssignLessonsDropdown
                allLessons={activeLatestLessons}
                people={people}
                peopleLoading={peopleLoading}
                peopleError={peopleError}
                assigning={assigning}
                assignError={assignError}
                onAssignLessons={onAssignLessons}
                enrollmentByStudent={enrollmentByStudent}
                assignedStudentIds={assignedStudentIds}
                defaultTeacherId={defaultTeacherId}
                teacherChoices={teacherChoices}
              />
            </div>
          </div>
        </div>

        {progressActionError && <ErrorMessage message={progressActionError} />}
        {assignError && <ErrorMessage message={assignError} />}

        <LessonProgressTable
          groupedProgress={groupedProgress}
          studentTeacherById={studentTeacherById}
          loading={progressLoading}
          error={progressError}
          sortField={progressSortField}
          sortDirection={progressSortDirection}
          onSortChange={onProgressSortChange}
          onPersonClick={onPersonClick}
          displayMode={effectiveViewMode}
        />
      </div>
    </Card>
  );
}

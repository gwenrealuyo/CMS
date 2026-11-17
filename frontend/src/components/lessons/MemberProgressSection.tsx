"use client";

import { useMemo } from "react";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
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
  ProgressSortField,
} from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { LessonPersonLike } from "@/src/lib/lessonsUtils";
import { formatPersonName } from "@/src/lib/name";
import { useIsMdUp, useListViewMode } from "@/src/lib/listViewMode";
import { TOOLBAR_CARD_CLASS } from "@/src/lib/toolbarStyles";

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
  progressTeacherFilterKey: string;
  onProgressTeacherFilterChange: (value: string) => void;
  progressStatusFilter: ProgressStatusFilter;
  onProgressStatusFilterChange: (value: ProgressStatusFilter) => void;
  includeHistoricalFinished: boolean;
  onIncludeHistoricalFinishedChange: (value: boolean) => void;
  progressSortField: ProgressSortField;
  progressSortDirection: "asc" | "desc";
  onProgressSortChange: (field: ProgressSortField) => void;
  people: Person[];
  peopleLoading: boolean;
  peopleError: string | null;
  assigning: boolean;
  assignError: string | null;
  canAssignLessons: boolean;
  onAssignLessons: (
    personIds: string[],
    lessonIds: number[],
    teacherId: string,
  ) => void;
  enrollmentByStudent: Map<number, LessonStudentEnrollment>;
  defaultTeacherId: string | null;
  teacherChoices: LessonPersonLike[];
  currentUserId?: string | number | null;
  lockTeacherToSelf?: boolean;
  pendingStudentIds?: Set<number>;
  onPersonClick: (person: LessonPersonSummary) => void;
  focusTeacherKey?: string | null;
  progressTotalCount?: number;
  progressPage?: number;
  progressPageSize?: number;
  onProgressPageChange?: (page: number) => void;
  onProgressPageSizeChange?: (size: number) => void;
  onPeopleSearchChange?: (query: string) => void;
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
  progressTeacherFilterKey,
  onProgressTeacherFilterChange,
  progressStatusFilter,
  onProgressStatusFilterChange,
  includeHistoricalFinished,
  onIncludeHistoricalFinishedChange,
  progressSortField,
  progressSortDirection,
  onProgressSortChange,
  people,
  peopleLoading,
  peopleError,
  assigning,
  assignError,
  canAssignLessons,
  onAssignLessons,
  enrollmentByStudent,
  defaultTeacherId,
  teacherChoices,
  currentUserId,
  lockTeacherToSelf = false,
  pendingStudentIds,
  onPersonClick,
  focusTeacherKey = null,
  progressTotalCount,
  progressPage,
  progressPageSize,
  onProgressPageChange,
  onProgressPageSizeChange,
  onPeopleSearchChange,
}: MemberProgressSectionProps) {
  const activeLatestLessons = allLessons.filter(
    (lesson) => lesson.is_latest && lesson.is_active,
  );
  const [viewMode, setViewMode] = useListViewMode("table");
  const isMdUp = useIsMdUp();

  const teacherFilterOptions = useMemo(
    () => [
      ...teacherChoices.map((teacher) => ({
        value: String(teacher.id),
        label: `Tr. ${formatPersonName(teacher)}`,
      })),
      { value: "no-teacher", label: "No teacher" },
    ],
    [teacherChoices],
  );

  return (
    <Card title="Student Progress" className="min-w-0">
      <div className="min-w-0 space-y-5">
        <p className="text-sm text-gray-500">
          View all students taking lessons and their overall progress.
        </p>

        <div className={`${TOOLBAR_CARD_CLASS} min-w-0`}>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-3 tablet:flex-row tablet:items-center tablet:gap-2">
              <ToolbarSearch
                fullWidth
                className="min-w-0 w-full tablet:flex-1"
                value={progressSearchQuery}
                onChange={onProgressSearchQueryChange}
                placeholder="Search student..."
                ariaLabel="Search student"
              />

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-2 tablet:shrink-0">
                <ViewModeToggle
                  className={isMdUp ? "w-fit shrink-0" : "w-full sm:w-fit"}
                  compact={isMdUp}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
                {canAssignLessons ? (
                  <div className="min-w-0 w-full shrink-0 sm:w-auto [&>div]:sm:w-auto [&_button]:sm:w-auto">
                    <AssignLessonsDropdown
                      allLessons={activeLatestLessons}
                      people={people}
                      peopleLoading={peopleLoading}
                      peopleError={peopleError}
                      assigning={assigning}
                      assignError={assignError}
                      onAssignLessons={onAssignLessons}
                      enrollmentByStudent={enrollmentByStudent}
                      defaultTeacherId={defaultTeacherId}
                      teacherChoices={teacherChoices}
                      currentUserId={currentUserId}
                      lockTeacherToSelf={lockTeacherToSelf}
                      pendingStudentIds={pendingStudentIds}
                      onPeopleSearchChange={onPeopleSearchChange}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <ScalableSelect
                  options={teacherFilterOptions}
                  value={progressTeacherFilterKey}
                  onChange={onProgressTeacherFilterChange}
                  placeholder="All teachers"
                  searchPlaceholder="Search teacher..."
                  emptyMessage="No teachers found"
                  triggerClassName="!h-auto py-2"
                  pinnedOption={{ value: "", label: "All teachers" }}
                />
              </div>

              <select
                className="box-border h-auto w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
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
                    {lesson.short_title?.trim() || lesson.title}
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
                className="box-border h-auto w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
                aria-label="Filter by status"
              >
                <option value="ALL">All status</option>
                <option value="ASSIGNED">Not started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SKIPPED">Skipped</option>
              </select>

              <label className="inline-flex w-full min-w-0 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={includeHistoricalFinished}
                  onChange={(e) =>
                    onIncludeHistoricalFinishedChange(e.target.checked)
                  }
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-ring"
                />
                Include past years
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Completed means finished this year unless past years are included.
              Teachers overview uses the same setting.
            </p>
          </div>
        </div>

        {progressActionError && <ErrorMessage message={progressActionError} />}
        {assignError && <ErrorMessage message={assignError} />}

        <div className="min-w-0">
          <LessonProgressTable
            groupedProgress={groupedProgress}
            studentTeacherById={studentTeacherById}
            loading={progressLoading}
            error={progressError}
            sortField={progressSortField}
            sortDirection={progressSortDirection}
            onSortChange={onProgressSortChange}
            onPersonClick={onPersonClick}
            displayMode={viewMode}
            searchQuery={progressSearchQuery}
            focusTeacherKey={focusTeacherKey}
            serverPagination={
              progressTotalCount != null &&
              progressPage != null &&
              progressPageSize != null &&
              onProgressPageChange &&
              onProgressPageSizeChange
                ? {
                    totalCount: progressTotalCount,
                    currentPage: progressPage,
                    pageSize: progressPageSize,
                    onPageChange: onProgressPageChange,
                    onPageSizeChange: onProgressPageSizeChange,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </Card>
  );
}

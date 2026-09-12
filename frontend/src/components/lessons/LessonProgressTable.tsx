import { Fragment, useState, useMemo, useEffect } from "react";
import {
  PersonProgressSummary,
  LessonPersonSummary,
  ProgressSortField,
} from "@/src/types/lesson";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import Pagination from "@/src/components/ui/Pagination";
import { formatPersonName } from "@/src/lib/name";
import { formatDisplayDate } from "@/src/lib/date";
import {
  formatPersonClusterLabel,
  formatPersonStatusLabel,
  getPersonClusterChipClass,
  getPersonStatusColor,
} from "@/src/lib/personStatus";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import {
  formatTeacherGroupHeader,
  getPersonLessonLifecycleStatus,
  groupStudentsByTeacher,
  lessonProgressStatusLabel,
  type TeacherProgressGroup,
} from "@/src/lib/lessonsUtils";
import {
  LessonCountChip,
  LessonStatusBadge,
} from "@/src/components/lessons/LessonCountChip";

interface LessonProgressTableProps {
  groupedProgress: PersonProgressSummary[];
  studentTeacherById?: Map<number, LessonPersonSummary>;
  loading: boolean;
  error?: string | null;
  sortField: ProgressSortField;
  sortDirection: "asc" | "desc";
  onSortChange: (field: ProgressSortField) => void;
  onPersonClick: (person: LessonPersonSummary) => void;
  displayMode?: "table" | "cards";
  searchQuery?: string;
  focusTeacherKey?: string | null;
}

const DEFAULT_ITEMS_PER_PAGE = 25;
const TABLE_COLUMN_COUNT = 7;

function getProgressBarColor(progressPercentage: number): string {
  if (progressPercentage >= 100) {
    return "#15803d"; // green-700
  }
  if (progressPercentage >= 75) {
    return "#22c55e"; // green-500
  }
  if (progressPercentage >= 50) {
    return "#3b82f6"; // blue-500
  }
  if (progressPercentage >= 25) {
    return "#f59e0b"; // amber-500
  }
  return "#ef4444"; // red-500
}

function TeacherGroupHeader({
  group,
  isExpanded,
  onToggle,
}: {
  group: TeacherProgressGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const teacherName = group.teacher
    ? formatPersonName(group.teacher)
    : "No teacher";
  const title =
    group.number != null ? `${group.number}. ${teacherName}` : teacherName;

  return (
    <button
      type="button"
      className="inline-flex w-full items-start gap-2 text-left"
      onClick={onToggle}
      aria-expanded={isExpanded}
      aria-label={formatTeacherGroupHeader(group)}
    >
      {isExpanded ? (
        <ChevronUpIcon className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
      ) : (
        <ChevronDownIcon className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground break-words">
          {title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <LessonCountChip
            label="assigned"
            count={group.total}
            tone="assigned"
            countFirst
          />
          <LessonCountChip
            label={lessonProgressStatusLabel("IN_PROGRESS")}
            count={group.inProgress}
            tone="IN_PROGRESS"
          />
          <LessonCountChip
            label={lessonProgressStatusLabel("COMPLETED")}
            count={group.completed}
            tone="COMPLETED"
          />
          <LessonCountChip
            label={lessonProgressStatusLabel("ASSIGNED")}
            count={group.notStarted}
            tone="ASSIGNED"
          />
        </span>
      </span>
    </button>
  );
}

function StudentMetaChips({ person }: { person: LessonPersonSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPersonStatusColor(person.status)}`}
      >
        {formatPersonStatusLabel(person.status)}
      </span>
      <span
        className={getPersonClusterChipClass(
          (person.cluster_codes?.length ?? 0) > 0,
        )}
      >
        {formatPersonClusterLabel(person.cluster_codes)}
      </span>
    </div>
  );
}

function ProgressMeter({
  summary,
  compact,
}: {
  summary: PersonProgressSummary;
  compact?: boolean;
}) {
  const progressText = `Completed ${summary.completedCount} of ${summary.totalLessons}`;
  return (
    <div className={compact ? "max-w-[7.5rem] space-y-1.5" : "space-y-1.5"}>
      <div className="text-xs font-medium leading-snug text-gray-700">
        {progressText}
      </div>
      <div
        className={`h-2.5 w-full rounded-full bg-gray-200 ${compact ? "max-w-[6.5rem]" : "max-w-xs"}`}
      >
        <div
          className="h-2.5 rounded-full transition-all"
          style={{
            width: `${summary.progressPercentage}%`,
            backgroundColor: getProgressBarColor(summary.progressPercentage),
          }}
        />
      </div>
    </div>
  );
}

function LessonCell({
  lesson,
  emptyLabel,
}: {
  lesson: PersonProgressSummary["previousLesson"];
  emptyLabel: string;
}) {
  if (!lesson) {
    return <span className="text-gray-400">{emptyLabel}</span>;
  }
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="font-medium break-words">{lesson.title}</div>
      <div className="text-xs text-gray-500">Lesson {lesson.order}</div>
    </div>
  );
}

export default function LessonProgressTable({
  groupedProgress,
  studentTeacherById = new Map(),
  loading,
  error,
  sortField,
  sortDirection,
  onSortChange,
  onPersonClick,
  displayMode = "table",
  searchQuery = "",
  focusTeacherKey = null,
}: LessonProgressTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);

  const teacherGroups = useMemo(
    () =>
      groupStudentsByTeacher(
        groupedProgress,
        studentTeacherById,
        sortField === "teacher" ? sortDirection : "asc",
      ),
    [groupedProgress, studentTeacherById, sortField, sortDirection],
  );

  const groupKeySignature = teacherGroups.map((group) => group.key).join("|");
  const searchActive = Boolean(searchQuery.trim());

  useEffect(() => {
    const keys = groupKeySignature ? groupKeySignature.split("|") : [];
    if (focusTeacherKey && keys.includes(focusTeacherKey)) {
      return;
    }
    if (keys.length <= 1 || searchActive) {
      setExpandedGroupKeys(keys);
    } else {
      setExpandedGroupKeys([]);
    }
  }, [groupKeySignature, searchActive, focusTeacherKey]);

  useEffect(() => {
    if (!focusTeacherKey) {
      return;
    }
    const groupIndex = teacherGroups.findIndex(
      (group) => group.key === focusTeacherKey,
    );
    if (groupIndex < 0) {
      return;
    }
    setCurrentPage(Math.floor(groupIndex / itemsPerPage) + 1);
    setExpandedGroupKeys([focusTeacherKey]);
  }, [focusTeacherKey, teacherGroups, itemsPerPage]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return teacherGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [teacherGroups, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(teacherGroups.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroupKeys((previous) =>
      previous.includes(groupKey)
        ? previous.filter((key) => key !== groupKey)
        : [...previous, groupKey],
    );
  };

  const renderSortIcon = (field: ProgressSortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const pagination =
    totalPages > 1 ? (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={teacherGroups.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        showItemsPerPage={true}
      />
    ) : null;

  const renderStudentCard = (summary: PersonProgressSummary) => {
    const personName = formatPersonName(summary.person);
    const summaryStatus = getPersonLessonLifecycleStatus(summary);

    return (
      <article
        key={summary.person.id}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="space-y-3">
          <div>
            <button
              type="button"
              onClick={() => onPersonClick(summary.person)}
              className={`${TABLE_ENTITY_LINK_CLASS} cursor-pointer text-left text-base font-semibold break-words`}
            >
              {personName}
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StudentMetaChips person={summary.person} />
              <LessonStatusBadge status={summaryStatus} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Progress
              </div>
              <div className="mt-1">
                <ProgressMeter summary={summary} />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Previous Lesson
              </div>
              <div className="mt-1 text-gray-900">
                <LessonCell
                  lesson={summary.previousLesson}
                  emptyLabel="—"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Next Lesson
              </div>
              <div className="mt-1 text-gray-900">
                <LessonCell
                  lesson={summary.nextLesson}
                  emptyLabel="All lessons completed"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Last activity
              </div>
              <div className="mt-1 text-gray-900">
                {formatDisplayDate(summary.lastActivityAt) ?? (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderStudentRow = (summary: PersonProgressSummary) => {
    const personName = formatPersonName(summary.person);
    const summaryStatus = getPersonLessonLifecycleStatus(summary);

    return (
      <tr key={summary.person.id} className="hover:bg-gray-50">
        <td className="px-4 py-4 text-sm text-gray-700">
          <div className="flex flex-col min-w-0 space-y-1.5">
            <button
              type="button"
              onClick={() => onPersonClick(summary.person)}
              className={`${TABLE_ENTITY_LINK_CLASS} cursor-pointer break-words`}
            >
              {personName}
            </button>
            <StudentMetaChips person={summary.person} />
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-gray-400" aria-hidden="true" />
        <td className="px-4 py-4 text-sm text-gray-600">
          <LessonCell lesson={summary.previousLesson} emptyLabel="—" />
        </td>
        <td className="px-4 py-4 text-sm text-gray-600">
          <ProgressMeter summary={summary} compact />
        </td>
        <td className="px-4 py-4 text-sm text-gray-600">
          <LessonCell
            lesson={summary.nextLesson}
            emptyLabel="All lessons completed"
          />
        </td>
        <td className="px-4 py-4 text-sm text-gray-600">
          <LessonStatusBadge status={summaryStatus} />
        </td>
        <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
          {formatDisplayDate(summary.lastActivityAt) ?? (
            <span className="text-gray-400">—</span>
          )}
        </td>
      </tr>
    );
  };

  const renderGroupToggle = (group: TeacherProgressGroup) => (
    <TeacherGroupHeader
      group={group}
      isExpanded={expandedGroupKeys.includes(group.key)}
      onToggle={() => toggleGroup(group.key)}
    />
  );

  if (loading) {
    return (
      <div className="border rounded-lg">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (groupedProgress.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-4 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
        No students have been assigned here yet.
      </div>
    );
  }

  if (displayMode === "cards") {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          {paginatedGroups.map((group) => {
            const isExpanded = expandedGroupKeys.includes(group.key);
            return (
              <section
                key={group.key}
                className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5"
              >
                {renderGroupToggle(group)}
                {isExpanded ? (
                  <div className="space-y-3">
                    {group.students.map(renderStudentCard)}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
        {pagination}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full min-w-[1120px] divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[16%] hover:bg-gray-100"
                onClick={() => onSortChange("person")}
              >
                <div className="flex items-center gap-1">
                  <span>Person</span>
                  {renderSortIcon("person")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%] hover:bg-gray-100"
                onClick={() => onSortChange("teacher")}
              >
                <div className="flex items-center gap-1">
                  <span>Teacher</span>
                  {renderSortIcon("teacher")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%] hover:bg-gray-100"
                onClick={() => onSortChange("previousLesson")}
              >
                <div className="flex items-center gap-1">
                  <span>Previous Lesson</span>
                  {renderSortIcon("previousLesson")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%] hover:bg-gray-100"
                onClick={() => onSortChange("progress")}
              >
                <div className="flex items-center gap-1">
                  <span>Progress</span>
                  {renderSortIcon("progress")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%] hover:bg-gray-100"
                onClick={() => onSortChange("nextLesson")}
              >
                <div className="flex items-center gap-1">
                  <span>Next Lesson</span>
                  {renderSortIcon("nextLesson")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[10%] hover:bg-gray-100"
                onClick={() => onSortChange("status")}
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[10%] hover:bg-gray-100"
                onClick={() => onSortChange("recentActivity")}
              >
                <div className="flex items-center gap-1">
                  <span>Last activity</span>
                  {renderSortIcon("recentActivity")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedGroups.map((group) => {
              const isExpanded = expandedGroupKeys.includes(group.key);
              return (
                <Fragment key={group.key}>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td
                      className="px-4 py-3.5"
                      colSpan={TABLE_COLUMN_COUNT}
                    >
                      {renderGroupToggle(group)}
                    </td>
                  </tr>
                  {isExpanded ? group.students.map(renderStudentRow) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}

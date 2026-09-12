"use client";

import { useMemo, useState } from "react";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Pagination from "@/src/components/ui/Pagination";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { LessonCountChip } from "@/src/components/lessons/LessonCountChip";
import {
  TeacherProgressGroup,
  lessonProgressStatusLabel,
} from "@/src/lib/lessonsUtils";
import { formatPersonName } from "@/src/lib/name";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import {
  effectiveListViewMode,
  getInitialListViewMode,
  useIsMdUp,
  useIsTabletUp,
} from "@/src/lib/listViewMode";
import { TOOLBAR_CARD_CLASS } from "@/src/lib/toolbarStyles";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

type TeacherOverviewSortField =
  | "teacher"
  | "assigned"
  | "inProgress"
  | "completed"
  | "notStarted";

interface TeacherOverviewSectionProps {
  rows: TeacherProgressGroup[];
  loading: boolean;
  error?: string | null;
  onTeacherClick: (group: TeacherProgressGroup) => void;
}

const DEFAULT_ITEMS_PER_PAGE = 25;

export default function TeacherOverviewSection({
  rows,
  loading,
  error,
  onTeacherClick,
}: TeacherOverviewSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] =
    useState<TeacherOverviewSortField>("assigned");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("table"),
  );
  const isTabletUp = useIsTabletUp();
  const isMdUp = useIsMdUp();
  const effectiveViewMode = effectiveListViewMode(viewMode, isTabletUp);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => {
          const name = row.teacher
            ? formatPersonName(row.teacher).toLowerCase()
            : "no teacher";
          return name.includes(query);
        })
      : [...rows];

    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((first, second) => {
      switch (sortField) {
        case "assigned":
          return (first.total - second.total) * direction;
        case "inProgress":
          return (first.inProgress - second.inProgress) * direction;
        case "completed":
          return (first.completed - second.completed) * direction;
        case "notStarted":
          return (first.notStarted - second.notStarted) * direction;
        case "teacher":
        default: {
          const firstName = first.teacher
            ? formatPersonName(first.teacher)
            : "No teacher";
          const secondName = second.teacher
            ? formatPersonName(second.teacher)
            : "No teacher";
          if (!first.teacher && second.teacher) return 1;
          if (first.teacher && !second.teacher) return -1;
          return firstName.localeCompare(secondName) * direction;
        }
      }
    });
  }, [rows, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const handleSort = (field: TeacherOverviewSortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "teacher" ? "asc" : "desc");
  };

  const renderSortIcon = (field: TeacherOverviewSortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const countChips = (row: TeacherProgressGroup) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <LessonCountChip
        label="assigned"
        count={row.total}
        tone="assigned"
        countFirst
      />
      <LessonCountChip
        label={lessonProgressStatusLabel("IN_PROGRESS")}
        count={row.inProgress}
        tone="IN_PROGRESS"
      />
      <LessonCountChip
        label={lessonProgressStatusLabel("COMPLETED")}
        count={row.completed}
        tone="COMPLETED"
      />
      <LessonCountChip
        label={lessonProgressStatusLabel("ASSIGNED")}
        count={row.notStarted}
        tone="ASSIGNED"
      />
    </span>
  );

  const teacherTitle = (row: TeacherProgressGroup) => {
    const name = row.teacher ? formatPersonName(row.teacher) : "No teacher";
    return row.number != null ? `${row.number}. ${name}` : name;
  };

  if (loading) {
    return (
      <Card title="Teachers">
        <LoadingSpinner />
      </Card>
    );
  }

  return (
    <Card title="Teachers">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Assigned student counts by teacher. Includes NCC roster teachers with
          no students yet. Open a teacher to see their students on Student
          Progress.
        </p>

        <div className={TOOLBAR_CARD_CLASS}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
            <ToolbarSearch
              fullWidth
              className="md:min-w-0 md:max-w-none md:flex-[2]"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
              placeholder="Search teacher..."
              ariaLabel="Search teacher"
            />
            <ViewModeToggle
              className="w-full md:w-auto md:shrink-0"
              compact={isMdUp}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 sm:p-6">
            No teachers found for this branch.
          </div>
        ) : effectiveViewMode === "cards" ? (
          <div className="space-y-3">
            {paginatedRows.map((row) => (
              <article
                key={row.key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onTeacherClick(row)}
                  className={`${TABLE_ENTITY_LINK_CLASS} cursor-pointer text-left text-base`}
                >
                  {teacherTitle(row)}
                </button>
                {row.isActive === false ? (
                  <p className="mt-1 text-xs text-gray-500">Inactive on roster</p>
                ) : null}
                <div className="mt-3">{countChips(row)}</div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {(
                    [
                      ["teacher", "Teacher"],
                      ["assigned", "Assigned"],
                      ["inProgress", "In progress"],
                      ["completed", "Completed"],
                      ["notStarted", "Not started"],
                    ] as Array<[TeacherOverviewSortField, string]>
                  ).map(([field, label]) => (
                    <th
                      key={field}
                      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                      onClick={() => handleSort(field)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{label}</span>
                        {renderSortIcon(field)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedRows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onTeacherClick(row)}
                        className={`${TABLE_ENTITY_LINK_CLASS} cursor-pointer break-words`}
                      >
                        {teacherTitle(row)}
                      </button>
                      {row.isActive === false ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Inactive on roster
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <LessonCountChip
                        label="assigned"
                        count={row.total}
                        tone="assigned"
                        countFirst
                      />
                    </td>
                    <td className="px-4 py-4">
                      <LessonCountChip
                        label={lessonProgressStatusLabel("IN_PROGRESS")}
                        count={row.inProgress}
                        tone="IN_PROGRESS"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <LessonCountChip
                        label={lessonProgressStatusLabel("COMPLETED")}
                        count={row.completed}
                        tone="COMPLETED"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <LessonCountChip
                        label={lessonProgressStatusLabel("ASSIGNED")}
                        count={row.notStarted}
                        tone="ASSIGNED"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredRows.length > itemsPerPage ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredRows.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
            showItemsPerPage
          />
        ) : null}
      </div>
    </Card>
  );
}

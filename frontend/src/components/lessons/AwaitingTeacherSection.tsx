"use client";

import { useMemo, useState } from "react";
import PersonProfile from "@/src/components/people/PersonProfile";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ModalOverlay from "@/src/components/ui/ModalOverlay";
import Pagination from "@/src/components/ui/Pagination";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { peopleApi } from "@/src/lib/api";
import {
  effectiveListViewMode,
  getInitialListViewMode,
  useIsMdUp,
  useIsTabletUp,
} from "@/src/lib/listViewMode";
import {
  extractErrorMessage,
  LessonPersonLike,
  NCC_TEACHER_ROSTER_EMPTY_MESSAGE,
  personBranchId,
} from "@/src/lib/lessonsUtils";
import { formatPersonName } from "@/src/lib/name";
import { TABLE_ENTITY_LINK_CLASS } from "@/src/lib/tableEntityLink";
import { TOOLBAR_CARD_CLASS } from "@/src/lib/toolbarStyles";
import { VisitorAwaitingTeacher } from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface AwaitingTeacherSectionProps {
  rows: VisitorAwaitingTeacher[];
  loading: boolean;
  error?: string | null;
  assigning: boolean;
  assignError?: string | null;
  teacherChoices: LessonPersonLike[];
  hasActiveLessons: boolean;
  showBranchColumn: boolean;
  formatDateOnly: (value?: string | null) => string;
  onAssign: (
    personId: string,
    teacherId: string,
    enrollmentId: number | null,
  ) => void;
}

const DEFAULT_ITEMS_PER_PAGE = 10;

type AwaitingTeacherSortField = "name" | "branch" | "cluster" | "visitorSince";

function compareText(first: string, second: string, direction: number): number {
  const firstEmpty = !first.trim();
  const secondEmpty = !second.trim();
  if (firstEmpty && secondEmpty) return 0;
  if (firstEmpty) return 1;
  if (secondEmpty) return -1;
  return (
    first.localeCompare(second, undefined, { sensitivity: "base" }) * direction
  );
}

function displayList(values: string[]): string {
  const labels = values.map((value) => value.trim()).filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "—";
}

export default function AwaitingTeacherSection({
  rows,
  loading,
  error,
  assigning,
  assignError,
  teacherChoices,
  hasActiveLessons,
  showBranchColumn,
  formatDateOnly,
  onAssign,
}: AwaitingTeacherSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] =
    useState<AwaitingTeacherSortField>("visitorSince");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [viewMode, setViewMode] = useState<"table" | "cards">(() =>
    getInitialListViewMode("table"),
  );
  const isTabletUp = useIsTabletUp();
  const isMdUp = useIsMdUp();
  const effectiveViewMode = effectiveListViewMode(viewMode, isTabletUp);
  const [profilePerson, setProfilePerson] = useState<Person | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const closeProfile = () => {
    setProfileOpen(false);
    setProfilePerson(null);
    setProfileLoading(false);
  };

  const openPersonProfile = async (personId: number | string) => {
    setProfileError(null);
    setProfileLoading(true);
    setProfileOpen(true);
    try {
      const response = await peopleApi.getById(String(personId));
      setProfilePerson(response.data);
    } catch (error) {
      setProfileOpen(false);
      setProfilePerson(null);
      setProfileError(
        extractErrorMessage(error, "Failed to load this person's profile."),
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => {
          const haystack = [row.name, row.branch_code, ...row.cluster_codes]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : [...rows];
    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((first, second) => {
      switch (sortField) {
        case "branch":
          return compareText(first.branch_code, second.branch_code, direction);
        case "cluster":
          return compareText(
            first.cluster_codes.join(", "),
            second.cluster_codes.join(", "),
            direction,
          );
        case "visitorSince":
          return compareText(
            first.visitor_since ?? "",
            second.visitor_since ?? "",
            direction,
          );
        case "name":
        default: {
          const byLast = compareText(
            first.last_name ?? "",
            second.last_name ?? "",
            direction,
          );
          if (byLast !== 0) return byLast;
          const byFirst = compareText(
            first.first_name ?? "",
            second.first_name ?? "",
            direction,
          );
          if (byFirst !== 0) return byFirst;
          return (first.id - second.id) * direction;
        }
      }
    });
  }, [rows, searchQuery, sortDirection, sortField]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const handleSort = (field: AwaitingTeacherSortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const renderSortIcon = (field: AwaitingTeacherSortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
    );
  };

  const columns: Array<{
    id: AwaitingTeacherSortField | "teacher";
    label: string;
  }> = [
    { id: "name", label: "Name" },
    ...(showBranchColumn
      ? [{ id: "branch" as const, label: "Branch" }]
      : []),
    { id: "cluster", label: "Cluster" },
    { id: "visitorSince", label: "Visitor since" },
    { id: "teacher", label: "Teacher" },
  ];

  if (loading && rows.length === 0) {
    return (
      <Card title="Awaiting Teacher">
        <LoadingSpinner />
      </Card>
    );
  }

  return (
    <>
    <Card title="Awaiting Teacher">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Visitors who do not have a lessons teacher yet. Assigning a teacher
          also enrolls them in the current lessons.
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
              placeholder="Search visitors..."
              ariaLabel="Search visitors awaiting a teacher"
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
        {assignError ? <ErrorMessage message={assignError} /> : null}
        {profileError ? <ErrorMessage message={profileError} /> : null}
        {!hasActiveLessons ? (
          <p className="text-sm text-gray-500">
            No active lessons are available to assign.
          </p>
        ) : null}

        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 sm:p-6">
            No visitors are waiting for a lessons teacher.
          </div>
        ) : effectiveViewMode === "cards" ? (
          <div className="space-y-3">
            {paginatedRows.map((row) => (
              <article
                key={row.id}
                className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <button
                    type="button"
                    className={`${TABLE_ENTITY_LINK_CLASS} text-base`}
                    onClick={() => void openPersonProfile(row.id)}
                  >
                    {row.name}
                  </button>
                  {showBranchColumn ? (
                    <p className="mt-1 text-sm text-gray-600">
                      {row.branch_code || "—"}
                    </p>
                  ) : null}
                </div>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Cluster</dt>
                    <dd className="text-gray-900">
                      {displayList(row.cluster_codes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Visitor since</dt>
                    <dd className="text-gray-900">
                      {formatDateOnly(row.visitor_since)}
                    </dd>
                  </div>
                </dl>
                <AssignTeacherControls
                  row={row}
                  teacherChoices={teacherChoices}
                  assigning={assigning}
                  hasActiveLessons={hasActiveLessons}
                  onAssign={onAssign}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column) => {
                    if (column.id === "teacher") {
                      return (
                        <th
                          key={column.id}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                        >
                          {column.label}
                        </th>
                      );
                    }
                    const sortId = column.id;
                    return (
                      <th
                        key={sortId}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                        onClick={() => handleSort(sortId)}
                      >
                        <div className="flex items-center gap-1">
                          <span>{column.label}</span>
                          {renderSortIcon(sortId)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedRows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className={TABLE_ENTITY_LINK_CLASS}
                        onClick={() => void openPersonProfile(row.id)}
                      >
                        {row.name}
                      </button>
                    </td>
                    {showBranchColumn ? (
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {row.branch_code || "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {displayList(row.cluster_codes)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {formatDateOnly(row.visitor_since)}
                    </td>
                    <td className="px-4 py-4">
                      <AssignTeacherControls
                        row={row}
                        teacherChoices={teacherChoices}
                        assigning={assigning}
                        hasActiveLessons={hasActiveLessons}
                        onAssign={onAssign}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredRows.length > 0 ? (
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
    <ModalOverlay
      isOpen={profileOpen}
      onClose={closeProfile}
      zIndex={80}
      className="p-0 sm:p-4"
      panelClassName="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col sm:h-[95vh] sm:max-h-[95vh]"
    >
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white shadow-xl sm:rounded-lg">
        {profileLoading || !profilePerson ? (
          <div className="p-8">
            <LoadingSpinner />
          </div>
        ) : (
          <PersonProfile
            person={profilePerson}
            onEdit={() => {}}
            onDelete={() => {}}
            onAddTimeline={() => {}}
            onClose={closeProfile}
            hideEditButton
            hideDeleteButton
            onViewPerson={(personId) => {
              void openPersonProfile(personId);
            }}
          />
        )}
      </div>
    </ModalOverlay>
    </>
  );
}

function AssignTeacherControls({
  row,
  teacherChoices,
  assigning,
  hasActiveLessons,
  onAssign,
}: {
  row: VisitorAwaitingTeacher;
  teacherChoices: LessonPersonLike[];
  assigning: boolean;
  hasActiveLessons: boolean;
  onAssign: AwaitingTeacherSectionProps["onAssign"];
}) {
  const [teacherId, setTeacherId] = useState("");
  const options = useMemo(
    () =>
      teacherChoices
        .filter((person) => {
          if (String(person.id) === String(row.id)) {
            return false;
          }
          if (row.branch_id == null) {
            return false;
          }
          const choiceBranch = personBranchId(person);
          if (choiceBranch == null) {
            return true;
          }
          return choiceBranch === String(row.branch_id);
        })
        .map((person) => ({
          value: person.id?.toString() ?? "",
          label: formatPersonName(person),
          nickname: person.nickname?.trim() || null,
          firstName: person.first_name?.trim() || null,
        })),
    [row.branch_id, row.id, teacherChoices],
  );

  return (
    <div className="flex min-w-[220px] flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <ScalableSelect
          options={options}
          value={teacherId}
          onChange={setTeacherId}
          placeholder="Select teacher"
          searchPlaceholder="Search teachers..."
          emptyMessage={NCC_TEACHER_ROSTER_EMPTY_MESSAGE}
          disabled={assigning || options.length === 0}
        />
      </div>
      <Button
        variant="primary"
        className="shrink-0 px-3"
        disabled={assigning || !teacherId || !hasActiveLessons}
        onClick={() => onAssign(String(row.id), teacherId, row.enrollment_id)}
      >
        {assigning ? "Assigning..." : "Assign"}
      </Button>
    </div>
  );
}

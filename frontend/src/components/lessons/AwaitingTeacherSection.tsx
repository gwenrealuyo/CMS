"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PersonProfile from "@/src/components/people/PersonProfile";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ModalOverlay from "@/src/components/ui/ModalOverlay";
import Pagination from "@/src/components/ui/Pagination";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import ViewModeToggle from "@/src/components/ui/ViewModeToggle";
import { peopleApi } from "@/src/lib/api";
import { useIsMdUp, useListViewMode } from "@/src/lib/listViewMode";
import {
  escapeCsvValue,
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
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
  serverPagination?: {
    totalCount: number;
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  onServerSearchChange?: (query: string) => void;
  onServerStatusChange?: (status: AwaitingTeacherStatusFilter) => void;
  onServerSortChange?: (
    field: AwaitingTeacherSortField,
    direction: "asc" | "desc",
  ) => void;
  onExportAll?: () => Promise<VisitorAwaitingTeacher[]>;
}

const DEFAULT_ITEMS_PER_PAGE = 10;

type AwaitingTeacherStatusFilter = "ONGOING" | "NO_RESPONSE" | "ALL";

type AwaitingTeacherSortField =
  | "name"
  | "branch"
  | "cluster"
  | "visitorSince"
  | "inviter";

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
  serverPagination,
  onServerSearchChange,
  onServerStatusChange,
  onServerSortChange,
  onExportAll,
}: AwaitingTeacherSectionProps) {
  const serverDriven = Boolean(serverPagination);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AwaitingTeacherStatusFilter>("ONGOING");
  const [sortField, setSortField] =
    useState<AwaitingTeacherSortField>("visitorSince");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [viewMode, setViewMode] = useListViewMode("table");
  const isMdUp = useIsMdUp();
  const [profilePerson, setProfilePerson] = useState<Person | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
    if (serverDriven) {
      return rows;
    }
    const query = searchQuery.trim().toLowerCase();
    const byStatus =
      statusFilter === "ALL"
        ? rows
        : rows.filter((row) => row.status === statusFilter);
    const filtered = query
      ? byStatus.filter((row) => {
          const haystack = [
            row.name,
            row.inviter_name,
            row.branch_code,
            ...row.cluster_codes,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : [...byStatus];
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
        case "inviter":
          return compareText(
            first.inviter_name ?? "",
            second.inviter_name ?? "",
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
  }, [rows, searchQuery, sortDirection, sortField, statusFilter, serverDriven]);

  const totalItems = serverDriven
    ? (serverPagination?.totalCount ?? filteredRows.length)
    : filteredRows.length;
  const activePageSize = serverDriven
    ? (serverPagination?.pageSize ?? itemsPerPage)
    : itemsPerPage;
  const activePage = serverDriven
    ? (serverPagination?.currentPage ?? currentPage)
    : currentPage;
  const totalPages = Math.ceil(totalItems / activePageSize) || 1;
  const page = Math.min(activePage, totalPages);
  const paginatedRows = serverDriven
    ? filteredRows
    : filteredRows.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSort = (field: AwaitingTeacherSortField) => {
    const nextDirection =
      sortField === field
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : "asc";
    setSortField(field);
    setSortDirection(nextDirection);
    if (serverDriven) {
      onServerSortChange?.(field, nextDirection);
    } else {
      setCurrentPage(1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showExportDropdown &&
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  const exportHeaders = useMemo(
    () => [
      "#",
      "Name",
      ...(showBranchColumn ? ["Branch"] : []),
      "Cluster",
      "Inviter",
      "Visitor since",
      "Status",
      "Phone",
      "Pending teacher",
    ],
    [showBranchColumn],
  );

  const buildExportCells = (
    row: VisitorAwaitingTeacher,
    rowNumber: number,
  ): string[] => [
    String(rowNumber),
    row.name,
    ...(showBranchColumn ? [row.branch_code] : []),
    row.cluster_codes.join(", "),
    row.inviter_name,
    formatDateOnly(row.visitor_since),
    row.status,
    row.phone,
    (row.pending_teachers ?? []).map((teacher) => teacher.name).join(", "),
  ];

  const runExport = (exportRows: VisitorAwaitingTeacher[]) => {
    const csvContent = [
      exportHeaders.map(escapeCsvValue).join(","),
      ...exportRows.map((row, index) =>
        buildExportCells(row, index + 1).map(escapeCsvValue).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "awaiting-teacher.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: "excel" | "pdf" | "csv") => {
    let exportRows = filteredRows;
    if (onExportAll) {
      exportRows = await onExportAll();
    }
    if (exportRows.length === 0) {
      return;
    }
    switch (format) {
      case "excel": {
        const worksheet = XLSX.utils.json_to_sheet(
          exportRows.map((row, index) => {
            const cells = buildExportCells(row, index + 1);
            return Object.fromEntries(
              exportHeaders.map((header, headerIndex) => [
                header,
                cells[headerIndex] ?? "",
              ]),
            );
          }),
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Awaiting Teacher");
        XLSX.writeFile(workbook, "awaiting-teacher.xlsx");
        break;
      }
      case "pdf": {
        const doc = new jsPDF({ orientation: "landscape" });
        autoTable(doc, {
          head: [exportHeaders],
          body: exportRows.map((row, index) => buildExportCells(row, index + 1)),
          startY: 20,
          theme: "grid",
          styles: { fontSize: 8 },
        });
        doc.save("awaiting-teacher.pdf");
        break;
      }
      case "csv":
        runExport(exportRows);
        break;
    }
    setShowExportDropdown(false);
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
    { id: "inviter", label: "Inviter" },
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
    <Card title="Awaiting Teacher" className="min-w-0">
      <div className="min-w-0 space-y-5">
        <p className="text-sm text-gray-500">
          Visitors who do not have a lessons teacher yet. Assigning a teacher
          also enrolls them in the current lessons.
        </p>

        <div className={`${TOOLBAR_CARD_CLASS} min-w-0`}>
          <div className="flex min-w-0 flex-col gap-3 tablet:flex-row tablet:items-center tablet:gap-2">
            <ToolbarSearch
              fullWidth
              className="min-w-0 w-full tablet:min-w-0 tablet:flex-1"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                if (serverDriven) {
                  onServerSearchChange?.(value);
                } else {
                  setCurrentPage(1);
                }
              }}
              placeholder="Search visitors..."
              ariaLabel="Search visitors awaiting a teacher"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                const next = event.target.value as AwaitingTeacherStatusFilter;
                setStatusFilter(next);
                if (serverDriven) {
                  onServerStatusChange?.(next);
                } else {
                  setCurrentPage(1);
                }
              }}
              className="box-border h-auto w-full min-w-0 shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm tablet:w-28 lg:w-44"
              aria-label="Filter by visitor status"
            >
              <option value="ONGOING">Ongoing</option>
              <option value="NO_RESPONSE">No Response</option>
              <option value="ALL">All</option>
            </select>
            <ViewModeToggle
              className={isMdUp ? "w-fit shrink-0" : "w-full"}
              compact={isMdUp}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <div
              ref={exportMenuRef}
              className="relative w-full min-w-0 shrink-0 tablet:w-auto"
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowExportDropdown((previous) => !previous)}
                disabled={loading || filteredRows.length === 0}
                className="w-full gap-2 min-h-[44px] text-sm tablet:w-auto"
                aria-expanded={showExportDropdown}
                aria-haspopup="menu"
              >
                <DocumentArrowDownIcon className="h-4 w-4 shrink-0" />
                Export
              </Button>
              {showExportDropdown ? (
                <div
                  role="menu"
                  className="absolute left-0 right-0 z-10 mt-2 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 tablet:left-auto tablet:right-0 tablet:w-48"
                >
                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport("excel")}
                      className="flex min-h-[44px] w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="mr-2 h-4 w-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export to Excel
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport("pdf")}
                      className="flex min-h-[44px] w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="mr-2 h-4 w-4 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      Export to PDF
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport("csv")}
                      className="flex min-h-[44px] w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <svg
                        className="mr-2 h-4 w-4 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export to CSV
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
        ) : viewMode === "cards" ? (
          <div className="min-w-0 space-y-3">
            {paginatedRows.map((row) => (
              <article
                key={row.id}
                className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
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
                    <dt className="text-gray-500">Inviter</dt>
                    <dd className="text-gray-900">{row.inviter_name || "—"}</dd>
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
          <div className="min-w-0 overflow-x-auto rounded-lg border">
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
                      {row.inviter_name || "—"}
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

        {filteredRows.length > 0 || serverDriven ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={activePageSize}
            onPageChange={
              serverDriven && serverPagination
                ? serverPagination.onPageChange
                : setCurrentPage
            }
            onItemsPerPageChange={(value) => {
              if (serverDriven && serverPagination) {
                serverPagination.onPageSizeChange(value);
              } else {
                setItemsPerPage(value);
                setCurrentPage(1);
              }
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
  const [teacherUnavailableAlertOpen, setTeacherUnavailableAlertOpen] =
    useState(false);
  const pendingTeachers = row.pending_teachers ?? [];
  const hasPendingTeacher = pendingTeachers.length > 0;
  const pendingTeacherLabel = pendingTeachers
    .map((teacher) => teacher.name.trim())
    .filter(Boolean)
    .join(", ");
  const missingBranch = row.branch_id == null;
  const teacherUnavailableMessage = missingBranch
    ? "This student doesn't have a branch on their profile. Add a branch before assigning a teacher."
    : NCC_TEACHER_ROSTER_EMPTY_MESSAGE;
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
  const noTeachersAvailable = options.length === 0;

  const closeTeacherUnavailableAlert = () =>
    setTeacherUnavailableAlertOpen(false);

  if (hasPendingTeacher) {
    return (
      <div className="flex w-full min-w-[18rem] flex-col gap-2 sm:w-[24rem] sm:shrink-0 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {pendingTeacherLabel || "Pending teacher"}
          </p>
          <Link
            href="/lessons?tab=teachers&approval=pending"
            className="text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline"
          >
            Pending approval
          </Link>
        </div>
        <Button
          variant="primary"
          className="shrink-0 px-3"
          disabled
          title="Review this request on the Teachers tab"
        >
          Assign
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full min-w-[18rem] flex-col gap-2 sm:w-[24rem] sm:shrink-0 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <ScalableSelect
            options={options}
            value={teacherId}
            onChange={setTeacherId}
            placeholder="Select teacher"
            searchPlaceholder="Search teachers..."
            emptyMessage={teacherUnavailableMessage}
            disabled={assigning || noTeachersAvailable}
            menuMinWidth={384}
          />
          {noTeachersAvailable ? (
            <button
              type="button"
              className="absolute inset-0 z-10 cursor-not-allowed"
              aria-label={teacherUnavailableMessage}
              onClick={() => setTeacherUnavailableAlertOpen(true)}
            />
          ) : null}
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
      <ConfirmationModal
        isOpen={teacherUnavailableAlertOpen}
        onClose={closeTeacherUnavailableAlert}
        onConfirm={closeTeacherUnavailableAlert}
        title="Cannot select teacher"
        message={teacherUnavailableMessage}
        confirmText="OK"
        variant="info"
      />
    </>
  );
}


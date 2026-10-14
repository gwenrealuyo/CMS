"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import Modal from "@/src/components/ui/Modal";
import Pagination from "@/src/components/ui/Pagination";
import SegmentedControl from "@/src/components/ui/SegmentedControl";
import ToolbarSearch from "@/src/components/ui/ToolbarSearch";
import { extractErrorMessage } from "@/src/lib/lessonsUtils";
import {
  buildTimelineMarks,
  formatLessonGapLabel,
  lessonGapTone,
} from "@/src/lib/lessonTimeline";
import { formatPersonName } from "@/src/lib/name";
import {
  TOOLBAR_CARD_CLASS,
  TOOLBAR_STACKED_ACTION_BUTTON_CLASS,
} from "@/src/lib/toolbarStyles";
import {
  LessonFollowUpInput,
  LessonFollowUpStatus,
  LessonTimelinePayload,
  LessonTimelineStudent,
} from "@/src/types/lesson";

type TimelineFilter = "all" | "follow-up" | "dropped";
type TimelineSortField = "days" | "name" | "teacher";
type SortDirection = "asc" | "desc";

const DEFAULT_ITEMS_PER_PAGE = 10;

const SORT_OPTIONS: Array<{
  key: TimelineSortField;
  label: string;
  shortLabel: string;
}> = [
  { key: "days", label: "Days since session", shortLabel: "Days" },
  { key: "name", label: "Name", shortLabel: "Name" },
  { key: "teacher", label: "Teacher", shortLabel: "Teacher" },
];

interface LessonTimelineSectionProps {
  timeline: LessonTimelinePayload | null;
  loading: boolean;
  error?: string | null;
  saving: boolean;
  formatDateOnly: (value?: string | null) => string;
  onSaveFollowUp: (input: LessonFollowUpInput) => Promise<void>;
}

const fieldClass =
  "w-full max-w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 min-h-[44px]";

function followUpErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === "string" && record.detail.trim()) {
        return record.detail;
      }
      for (const value of Object.values(record)) {
        if (typeof value === "string" && value.trim()) {
          return value;
        }
        if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
          return value[0];
        }
      }
    }
  }
  return extractErrorMessage(error, "Could not save the follow-up.");
}

function matchesFilter(row: LessonTimelineStudent, filter: TimelineFilter): boolean {
  const status = row.follow_up?.status;
  if (filter === "follow-up") {
    return status !== "DROPPED";
  }
  if (filter === "dropped") {
    return status === "DROPPED";
  }
  return true;
}

function compareText(left: string, right: string, direction: number): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" }) * direction;
}

function compareDays(
  left: number | null,
  right: number | null,
  direction: number,
): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return (left - right) * direction;
}

export default function LessonTimelineSection({
  timeline,
  loading,
  error,
  saving,
  formatDateOnly,
  onSaveFollowUp,
}: LessonTimelineSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [sortField, setSortField] = useState<TimelineSortField>("days");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [selected, setSelected] = useState<LessonTimelineStudent | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortOpen]);

  const rows = useMemo(() => {
    const students = timeline?.students ?? [];
    const query = searchQuery.trim().toLowerCase();
    const filtered = students.filter((row) => {
      if (!matchesFilter(row, filter)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const name = formatPersonName(row.person).toLowerCase();
      const teacher = (row.teacher_name || "").toLowerCase();
      return name.includes(query) || teacher.includes(query);
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      let result = 0;
      if (sortField === "days") {
        result = compareDays(
          left.days_since_last_session,
          right.days_since_last_session,
          direction,
        );
      } else if (sortField === "teacher") {
        result = compareText(
          left.teacher_name || "",
          right.teacher_name || "",
          direction,
        );
      } else {
        result = compareText(
          left.person.last_name || "",
          right.person.last_name || "",
          direction,
        );
        if (result === 0) {
          result = compareText(
            left.person.first_name || "",
            right.person.first_name || "",
            direction,
          );
        }
      }
      if (result !== 0) {
        return result;
      }
      return left.person.id - right.person.id;
    });
  }, [timeline, searchQuery, filter, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const activeSort = SORT_OPTIONS.find((option) => option.key === sortField);
  const sortLabel = activeSort?.shortLabel ?? "Sort";

  const chooseSort = (field: TimelineSortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    setCurrentPage(1);
    setSortOpen(false);
  };

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-gray-500">
        Lesson dates for each student, including those who already finished.
        Baptism, Holy Ghost, and cluster code sit on the same line when those
        exist. The day count is how long it has been since the last session.
      </p>

      <div className={`${TOOLBAR_CARD_CLASS} min-w-0`}>
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <ToolbarSearch
            fullWidth
            className="lg:min-w-0 lg:flex-1"
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            placeholder="Search student or teacher..."
            ariaLabel="Search timeline"
          />
          <div className="flex min-w-0 flex-col gap-3 tablet:flex-row tablet:items-center lg:shrink-0">
            <div className="w-full min-w-0 overflow-x-auto tablet:w-auto tablet:flex-1 lg:flex-none">
              <SegmentedControl
                fullWidthOnMobile
                className="w-full tablet:w-auto"
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setCurrentPage(1);
                }}
                options={[
                  { id: "all", label: "All" },
                  { id: "follow-up", label: "Needs follow-up" },
                  { id: "dropped", label: "Dropped" },
                ]}
              />
            </div>
            <div ref={sortMenuRef} className="relative w-full shrink-0 tablet:w-auto">
              <button
                type="button"
                aria-expanded={sortOpen}
                aria-haspopup="menu"
                onClick={() => setSortOpen((open) => !open)}
                className={`${TOOLBAR_STACKED_ACTION_BUTTON_CLASS} tablet:w-auto tablet:px-3`}
              >
                <svg
                  className="mr-1 h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  />
                </svg>
                <span className="truncate">
                  {sortLabel} {sortDirection === "asc" ? "↑" : "↓"}
                </span>
              </button>
              {sortOpen ? (
                <div
                  role="menu"
                  className="absolute inset-x-0 top-full z-50 mt-1.5 w-full rounded-lg border border-gray-200 bg-white py-2 shadow-lg tablet:left-auto tablet:right-0 tablet:w-72"
                >
                  <div className="border-b border-gray-100 px-3 py-2">
                    <h3 className="text-sm font-medium text-gray-900">Sort by</h3>
                  </div>
                  {SORT_OPTIONS.map((option) => (
                    <div
                      key={option.key}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-gray-700">
                        {option.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => chooseSort(option.key, "asc")}
                          className={`min-h-[44px] min-w-[44px] rounded px-2 text-sm sm:min-h-0 sm:min-w-0 sm:py-1 sm:text-xs ${
                            sortField === option.key && sortDirection === "asc"
                              ? "chip-primary"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => chooseSort(option.key, "desc")}
                          className={`min-h-[44px] min-w-[44px] rounded px-2 text-sm sm:min-h-0 sm:min-w-0 sm:py-1 sm:text-xs ${
                            sortField === option.key && sortDirection === "desc"
                              ? "chip-primary"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 sm:p-6">
          No students match this timeline.
        </div>
      ) : (
        <div className="min-w-0 space-y-3">
          {pageRows.map((row) => (
            <TimelineRow
              key={row.person.id}
              row={row}
              catalog={timeline?.lessons ?? []}
              formatDateOnly={formatDateOnly}
              onOpen={() => setSelected(row)}
            />
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={rows.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(value) => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
          showItemsPerPage
        />
      ) : null}

      <FollowUpModal
        student={selected}
        saving={saving}
        formatDateOnly={formatDateOnly}
        onClose={() => setSelected(null)}
        onSave={async (input) => {
          await onSaveFollowUp(input);
          setSelected(null);
        }}
      />
    </div>
  );
}

function TimelineRow({
  row,
  catalog,
  formatDateOnly,
  onOpen,
}: {
  row: LessonTimelineStudent;
  catalog: LessonTimelinePayload["lessons"];
  formatDateOnly: (value?: string | null) => string;
  onOpen: () => void;
}) {
  const marks = buildTimelineMarks(catalog, row);
  const plan =
    row.follow_up?.status === "ACTION_PLANNED"
      ? row.follow_up.action_text
      : row.follow_up?.status === "DROPPED"
        ? row.follow_up.excuse_text || "Stopped the remaining lessons."
        : "";

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="w-full min-w-0 px-4 pt-4 text-left"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="break-words text-base font-medium text-gray-900">
              {formatPersonName(row.person)}
            </p>
            <p className="break-words text-sm text-gray-500">
              {row.teacher_name ? `Tr. ${row.teacher_name}` : "No teacher"}
              {row.has_finished_lessons ? " · Finished lessons" : ""}
            </p>
          </div>
          <span
            className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-left text-xs font-semibold ${lessonGapTone(row)}`}
          >
            {formatLessonGapLabel(row)}
          </span>
        </div>
        {row.follow_up ? (
          <p className="mt-2 break-words text-sm text-gray-700">
            <span className="font-medium">
              {row.follow_up.status === "DROPPED" ? "Dropped" : "Action plan"}
            </span>
            {plan ? `: ${plan}` : ""}
          </p>
        ) : null}
        {row.next_session_date ? (
          <p className="mt-1 text-xs text-gray-500">
            Next session {formatDateOnly(row.next_session_date)}
          </p>
        ) : null}
      </button>
      <div className="mt-3 flex min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain px-4 pb-4">
          {marks.map((mark) => {
            if (mark.kind === "cluster") {
              return (
                <div
                  key={mark.key}
                  className="w-28 shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-2 py-2"
                >
                  <p className="text-xs font-semibold text-sky-800">Cluster</p>
                  <p className="break-words text-xs text-sky-700">{mark.code}</p>
                </div>
              );
            }
            if (mark.kind === "baptism" || mark.kind === "spirit") {
              return (
                <div
                  key={mark.key}
                  className="w-28 shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2"
                >
                  <p className="text-xs font-semibold text-indigo-800">
                    {mark.kind === "baptism" ? "Baptized" : "Holy Ghost"}
                  </p>
                  <p className="text-xs text-indigo-700">
                    {formatDateOnly(mark.date)}
                  </p>
                </div>
              );
            }
            const stopped = mark.status === "SKIPPED";
            const done = Boolean(mark.completedOn) && !stopped;
            return (
              <div
                key={mark.key}
                className={`w-28 shrink-0 rounded-lg border px-2 py-2 ${
                  stopped
                    ? "border-gray-300 bg-gray-100"
                    : done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-gray-200 bg-gray-50"
                }`}
              >
                <p className="line-clamp-2 text-xs font-medium text-gray-800">
                  {mark.title}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {stopped
                    ? "Stopped"
                    : done
                      ? formatDateOnly(mark.completedOn)
                      : "Not yet"}
                </p>
              </div>
            );
          })}
      </div>
    </article>
  );
}

function FollowUpModal({
  student,
  saving,
  formatDateOnly,
  onClose,
  onSave,
}: {
  student: LessonTimelineStudent | null;
  saving: boolean;
  formatDateOnly: (value?: string | null) => string;
  onClose: () => void;
  onSave: (input: LessonFollowUpInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<LessonFollowUpStatus>("ACTION_PLANNED");
  const [actionText, setActionText] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [who, setWho] = useState("");
  const [when, setWhen] = useState("");
  const [remarks, setRemarks] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!student) {
      return;
    }
    const existing = student.follow_up;
    setMode(existing?.status === "DROPPED" ? "DROPPED" : "ACTION_PLANNED");
    setActionText(existing?.action_text ?? "");
    setExcuseText(existing?.excuse_text ?? "");
    setWho(existing?.who ?? "");
    setWhen(existing?.when ?? "");
    setRemarks(existing?.remarks ?? "");
    setFormError(null);
  }, [student]);

  const submit = async () => {
    if (!student) {
      return;
    }
    if (mode === "ACTION_PLANNED" && !actionText.trim()) {
      setFormError("Describe the action plan.");
      return;
    }
    setFormError(null);
    try {
      await onSave({
        student_id: student.person.id,
        status: mode,
        action_text: actionText.trim(),
        excuse_text: excuseText.trim(),
        who: who.trim(),
        when: when || null,
        remarks: remarks.trim(),
      });
    } catch (error) {
      setFormError(followUpErrorMessage(error));
    }
  };

  return (
    <Modal
      isOpen={student != null}
      onClose={onClose}
      title={student ? formatPersonName(student.person) : "Follow-up"}
      closeOnOutsideClick={false}
    >
      {student ? (
        <div className="space-y-4">
          <p className="break-words text-sm text-gray-600">
            {formatLessonGapLabel(student)}
            {student.teacher_name ? ` · Tr. ${student.teacher_name}` : ""}
            {student.next_session_date
              ? ` · Next session ${formatDateOnly(student.next_session_date)}`
              : ""}
          </p>
          <p className="text-sm text-gray-500">
            Record an action plan, or drop this student when they will not
            continue the remaining lessons. Completed lessons stay. A note on a
            drop is optional. Either decision is written on their journey.
          </p>
          {formError ? <ErrorMessage message={formError} /> : null}
          <SegmentedControl
            fullWidthOnMobile
            value={mode}
            onChange={setMode}
            options={[
              { id: "ACTION_PLANNED", label: "Action plan" },
              { id: "DROPPED", label: "Drop" },
            ]}
          />
          {mode === "ACTION_PLANNED" ? (
            <label className="block text-sm text-gray-700">
              What to do
              <textarea
                className={`${fieldClass} mt-1 min-h-[88px]`}
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
              />
            </label>
          ) : (
            <label className="block text-sm text-gray-700">
              Note
              <span className="ml-1 font-normal text-gray-500">optional</span>
              <textarea
                className={`${fieldClass} mt-1 min-h-[88px]`}
                value={excuseText}
                onChange={(event) => setExcuseText(event.target.value)}
                placeholder="Why they stopped, if you want it on the journey"
              />
            </label>
          )}
          <label className="block text-sm text-gray-700">
            Who
            <input
              className={`${fieldClass} mt-1`}
              value={who}
              onChange={(event) => setWho(event.target.value)}
            />
          </label>
          <label className="block text-sm text-gray-700">
            When
            <input
              type="date"
              className={`${fieldClass} mt-1`}
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </label>
          <label className="block text-sm text-gray-700">
            Remarks
            <textarea
              className={`${fieldClass} mt-1 min-h-[72px]`}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={submit}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

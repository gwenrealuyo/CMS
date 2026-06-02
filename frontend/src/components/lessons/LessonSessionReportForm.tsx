import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import ScalableSelect from "@/src/components/ui/ScalableSelect";
import {
  Lesson,
  LessonSessionReport,
  LessonSessionReportInput,
} from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import { isLessonTeacherCandidate } from "@/src/lib/lessonsUtils";
import { isSelectablePerson } from "@/src/lib/peopleSelectors";
import {
  formatPersonClusterLabel,
  formatPersonStatusLabel,
  getPersonClusterChipClass,
  getPersonStatusColor,
} from "@/src/lib/personStatus";

export interface LessonSessionReportFormProps {
  report?: LessonSessionReport | null;
  submitting?: boolean;
  onSubmit: (values: LessonSessionReportInput) => void;
  onCancel: () => void;
  people: Person[];
  lessons: Lesson[];
  defaultLessonId?: number | string | null;
  defaultTeacherId?: number | string | null;
  loggedInTeacherId?: number | string | null;
  defaultStudentId?: number | string | null;
  enrollmentTeacherByStudentId?: Map<number, number>;
  error?: string | null;
}

interface FormState {
  teacherId: string;
  studentId: string;
  lessonId: string;
  sessionDate: string;
  sessionStart: string;
  score: string;
  nextSessionDate: string;
  remarks: string;
}

function toLocalDateValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

const NO_TEACHER_ASSIGNED_LABEL = "No teacher assigned";

function StudentOptionBadges({ person }: { person: Person }) {
  const clusterCodes = person.cluster_codes?.filter(Boolean) ?? [];
  const hasCluster = clusterCodes.length > 0;

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getPersonStatusColor(
          person.status
        )}`}
      >
        {formatPersonStatusLabel(person.status)}
      </span>
      <span className={getPersonClusterChipClass(hasCluster)}>
        {formatPersonClusterLabel(clusterCodes)}
      </span>
    </span>
  );
}

function toLocalDateTimeValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (input: number) => input.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LessonSessionReportForm({
  report,
  submitting = false,
  onSubmit,
  onCancel,
  people,
  lessons,
  defaultLessonId,
  defaultTeacherId,
  loggedInTeacherId: loggedInTeacherIdProp,
  defaultStudentId,
  enrollmentTeacherByStudentId,
  error,
}: LessonSessionReportFormProps) {
  const teacherOptions = useMemo(
    () => people.filter((person) => isLessonTeacherCandidate(person)),
    [people]
  );

  const studentOptions = useMemo(() => {
    return [...people]
      .filter(isSelectablePerson)
      .sort((first, second) => {
        const nameA = formatPersonName(first);
        const nameB = formatPersonName(second);
        return nameA.localeCompare(nameB);
      });
  }, [people]);

  const loggedInTeacherId = loggedInTeacherIdProp?.toString() ?? "";

  const defaultState = useMemo(
    (): FormState => ({
      teacherId:
        report?.teacher?.id?.toString() ??
        (defaultStudentId
          ? defaultTeacherId?.toString() ?? ""
          : loggedInTeacherId),
      studentId:
        report?.student?.id?.toString() ?? defaultStudentId?.toString() ?? "",
      lessonId:
        report?.lesson?.id?.toString() ?? defaultLessonId?.toString() ?? "",
      sessionDate:
        report?.session_date ?? new Date().toISOString().slice(0, 10),
      sessionStart:
        toLocalDateTimeValue(report?.session_start) ||
        new Date().toISOString().slice(0, 16),
      score: report?.score ?? "",
      nextSessionDate: report?.next_session_date ?? "",
      remarks: report?.remarks ?? "",
    }),
    [report, loggedInTeacherId, defaultTeacherId, defaultStudentId, defaultLessonId]
  );

  const [formState, setFormState] = useState<FormState>(defaultState);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [studentQuery, setStudentQuery] = useState("");
  const [isStudentDropdownOpen, setStudentDropdownOpen] = useState(false);

  const isTeacherLocked = Boolean(formState.studentId.trim()) && !report;

  useEffect(() => {
    setFormState(defaultState);
    const studentMatch = studentOptions.find(
      (person) => person.id?.toString() === defaultState.studentId
    );
    setStudentQuery(studentMatch ? formatPersonName(studentMatch) : "");
  }, [defaultState, studentOptions]);

  useEffect(() => {
    if (report) {
      return;
    }

    const studentId = formState.studentId.trim();
    if (!studentId) {
      const nextTeacherId = loggedInTeacherId;
      setFormState((previous) =>
        previous.teacherId === nextTeacherId
          ? previous
          : { ...previous, teacherId: nextTeacherId }
      );
      return;
    }

    const numericStudentId = Number(studentId);
    if (Number.isNaN(numericStudentId)) {
      return;
    }

    const enrollmentTeacherId =
      enrollmentTeacherByStudentId?.get(numericStudentId) ?? null;
    const nextTeacherId = enrollmentTeacherId?.toString() ?? "";

    setFormState((previous) =>
      previous.teacherId === nextTeacherId
        ? previous
        : { ...previous, teacherId: nextTeacherId }
    );
  }, [
    formState.studentId,
    report,
    loggedInTeacherId,
    enrollmentTeacherByStudentId,
  ]);

  const teacherHelperText = useMemo(() => {
    if (report) {
      return null;
    }
    if (isTeacherLocked) {
      if (!formState.teacherId) {
        return "This student has no lessons teacher. Assign one in Student Progress first.";
      }
      return "Assigned lessons teacher for this student (cannot be changed here).";
    }
    return loggedInTeacherId
      ? "Defaults to you. Select a student to use their assigned lessons teacher."
      : "Select who led this session. Choosing a student locks the teacher to their assigned lessons teacher.";
  }, [formState.teacherId, isTeacherLocked, loggedInTeacherId, report]);

  const clearStudentSelection = () => {
    handleChange("studentId", "");
    setStudentQuery("");
    setStudentDropdownOpen(false);
  };

  const lessonOptions = useMemo(() => {
    if (!lessons.length) {
      return [];
    }
    return [...lessons].sort((first, second) => {
      if (first.order !== second.order) {
        return first.order - second.order;
      }
      return first.title.localeCompare(second.title);
    });
  }, [lessons]);

  const teacherSelectOptions = useMemo(
    () =>
      teacherOptions
        .map((person) => ({
          value: person.id?.toString() ?? "",
          label: formatPersonName(person),
        }))
        .filter((option) => option.value),
    [teacherOptions]
  );

  const lockedTeacherLabel = useMemo(() => {
    if (!formState.teacherId) {
      return NO_TEACHER_ASSIGNED_LABEL;
    }
    const teacherMatch = teacherOptions.find(
      (person) => person.id?.toString() === formState.teacherId
    );
    return teacherMatch ? formatPersonName(teacherMatch) : NO_TEACHER_ASSIGNED_LABEL;
  }, [formState.teacherId, teacherOptions]);

  const filteredStudentOptions = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) {
      return studentOptions;
    }
    return studentOptions.filter((person) => {
      const name = formatPersonName(person).toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      const memberId = person.member_id?.toLowerCase() ?? "";
      return (
        name.includes(query) ||
        username.includes(query) ||
        memberId.includes(query)
      );
    });
  }, [studentOptions, studentQuery]);

  const handleChange = (field: keyof FormState, value: string) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((previous) => {
        const updated = { ...previous };
        delete updated[field];
        return updated;
      });
    }
    // Clear general form error
    if (formError) {
      setFormError(null);
    }
  };

  const studentDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        studentDropdownRef.current &&
        !studentDropdownRef.current.contains(event.target as Node)
      ) {
        setStudentDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const {
      teacherId,
      studentId,
      lessonId,
      sessionDate,
      sessionStart,
      nextSessionDate,
    } = formState;

    const errors: Partial<Record<keyof FormState, string>> = {};

    if (!studentId) {
      errors.studentId = "Select a student for this session.";
    }

    if (!report && studentId && !teacherId) {
      errors.teacherId =
        "This student has no lessons teacher assigned. Assign one in Student Progress first.";
    } else if (!report && !teacherId) {
      errors.teacherId = "Select who led this session.";
    }

    if (!lessonId) {
      errors.lessonId = "Select the lesson covered in this session.";
    }

    if (!sessionDate) {
      errors.sessionDate = "Provide the scheduled session date.";
    }

    if (!sessionStart) {
      errors.sessionStart = "Provide the actual session date.";
    } else {
      const sessionStartDate = new Date(sessionStart);
      if (Number.isNaN(sessionStartDate.getTime())) {
        errors.sessionStart = "The actual session date is invalid.";
      }
    }

    // Validate next_session_date is after session_date
    if (nextSessionDate && sessionDate) {
      const nextDate = new Date(nextSessionDate);
      const sessionDateObj = new Date(sessionDate);
      if (
        !Number.isNaN(nextDate.getTime()) &&
        !Number.isNaN(sessionDateObj.getTime())
      ) {
        if (nextDate <= sessionDateObj) {
          errors.nextSessionDate =
            "Next session date must be after the scheduled session date.";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Please fix the errors below.");
      return;
    }

    setFieldErrors({});

    const sessionStartDate = new Date(sessionStart);
    const payload: LessonSessionReportInput = {
      teacher_id: teacherId ? Number(teacherId) : undefined,
      student_id: Number(studentId),
      lesson_id: Number(lessonId),
      session_date: sessionDate,
      session_start: sessionStartDate.toISOString(),
      score: formState.score.trim() || undefined,
      next_session_date: formState.nextSessionDate || null,
      remarks: formState.remarks.trim() || undefined,
    };

    if (report?.progress) {
      payload.progress_id = report.progress;
    }

    setFormError(null);
    onSubmit(payload);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor={isTeacherLocked ? "teacher-display" : "teacher-select"}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Teacher
          </label>
          {isTeacherLocked ? (
            <input
              id="teacher-display"
              type="text"
              readOnly
              disabled
              value={lockedTeacherLabel}
              className="w-full min-h-[44px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 cursor-not-allowed"
              aria-invalid={!!fieldErrors.teacherId}
              aria-describedby={
                fieldErrors.teacherId ? "teacher-error" : undefined
              }
            />
          ) : (
            <ScalableSelect
              options={teacherSelectOptions}
              value={formState.teacherId}
              onChange={(value) => handleChange("teacherId", value)}
              placeholder="Select teacher..."
              searchPlaceholder="Search by name..."
              emptyMessage="No teachers found"
            />
          )}
          {fieldErrors.teacherId && (
            <p
              id="teacher-error"
              className="text-xs text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors.teacherId}
            </p>
          )}
          {teacherHelperText && (
            <p className="text-xs text-gray-500">{teacherHelperText}</p>
          )}
        </div>

        <div className="space-y-2" ref={studentDropdownRef}>
          <label
            htmlFor="student-search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Student{" "}
            <span className="text-red-500" aria-label="required">
              *
            </span>
          </label>
          <div className="relative">
            <input
              id="student-search"
              type="text"
              value={studentQuery}
              onChange={(event) => {
                setStudentQuery(event.target.value);
                setStudentDropdownOpen(true);
              }}
              onFocus={() => setStudentDropdownOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setStudentDropdownOpen(false);
                }
              }}
              placeholder="Search student by name, username, or member ID..."
              className={`w-full min-h-[44px] rounded-md border py-2 text-sm focus:outline-none focus:ring-1 ${
                formState.studentId ? "pl-3 pr-16" : "px-3"
              } ${
                fieldErrors.studentId
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-primary focus:ring-ring"
              }`}
              required
              aria-invalid={!!fieldErrors.studentId}
              aria-describedby={
                fieldErrors.studentId ? "student-error" : undefined
              }
              aria-label="Search for student"
              aria-expanded={isStudentDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="student-options"
            />
            {formState.studentId && (
              <button
                type="button"
                onClick={clearStudentSelection}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Clear student"
              >
                Clear
              </button>
            )}
            {isStudentDropdownOpen && (
              <div
                id="student-options"
                role="listbox"
                className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto"
                aria-label="Student options"
              >
                {filteredStudentOptions.length === 0 ? (
                  <div
                    className="px-3 py-2 text-sm text-gray-500"
                    role="option"
                  >
                    No students match your search.
                  </div>
                ) : (
                  filteredStudentOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      role="option"
                      aria-selected={
                        formState.studentId === person.id?.toString()
                      }
                      onClick={() => {
                        handleChange("studentId", person.id.toString());
                        setStudentQuery(formatPersonName(person));
                        setStudentDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {formatPersonName(person)}
                        </span>
                        <StudentOptionBadges person={person} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {fieldErrors.studentId && (
            <p
              id="student-error"
              className="text-xs text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors.studentId}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="lesson-select"
          className="block text-sm font-medium text-gray-700"
        >
          Lesson{" "}
          <span className="text-red-500" aria-label="required">
            *
          </span>
        </label>
        <select
          id="lesson-select"
          className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            fieldErrors.lessonId
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-primary focus:ring-ring"
          }`}
          value={formState.lessonId}
          onChange={(event) => handleChange("lessonId", event.target.value)}
          required
          aria-invalid={!!fieldErrors.lessonId}
          aria-describedby={fieldErrors.lessonId ? "lesson-error" : undefined}
        >
          <option value="">Select lesson</option>
          {lessonOptions.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
        {fieldErrors.lessonId && (
          <p
            id="lesson-error"
            className="text-xs text-red-600 mt-1"
            role="alert"
          >
            {fieldErrors.lessonId}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="session-date"
            className="block text-sm font-medium text-gray-700"
          >
            Scheduled Session Date{" "}
            <span className="text-red-500" aria-label="required">
              *
            </span>
          </label>
          <input
            id="session-date"
            type="date"
            className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.sessionDate
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-primary focus:ring-ring"
            }`}
            value={formState.sessionDate}
            onChange={(event) =>
              handleChange("sessionDate", event.target.value)
            }
            required
            aria-invalid={!!fieldErrors.sessionDate}
            aria-describedby={
              fieldErrors.sessionDate ? "session-date-error" : undefined
            }
          />
          {fieldErrors.sessionDate && (
            <p
              id="session-date-error"
              className="text-xs text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors.sessionDate}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="session-start"
            className="block text-sm font-medium text-gray-700"
          >
            Actual Session Date{" "}
            <span className="text-red-500" aria-label="required">
              *
            </span>
          </label>
          <input
            id="session-start"
            type="datetime-local"
            className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.sessionStart
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-primary focus:ring-ring"
            }`}
            value={formState.sessionStart}
            onChange={(event) =>
              handleChange("sessionStart", event.target.value)
            }
            required
            aria-invalid={!!fieldErrors.sessionStart}
            aria-describedby={
              fieldErrors.sessionStart ? "session-start-error" : undefined
            }
          />
          {fieldErrors.sessionStart && (
            <p
              id="session-start-error"
              className="text-xs text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors.sessionStart}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Score / Rating (optional)
          </label>
          <input
            type="text"
            className="w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            value={formState.score}
            onChange={(event) => handleChange("score", event.target.value)}
            placeholder="e.g. 10/10 or Passed"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="next-session-date"
            className="block text-sm font-medium text-gray-700"
          >
            Next Scheduled Session Date (optional)
          </label>
          <input
            id="next-session-date"
            type="date"
            className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.nextSessionDate
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-primary focus:ring-ring"
            }`}
            value={formState.nextSessionDate}
            onChange={(event) =>
              handleChange("nextSessionDate", event.target.value)
            }
            min={formState.sessionDate || undefined}
            aria-invalid={!!fieldErrors.nextSessionDate}
            aria-describedby={
              fieldErrors.nextSessionDate ? "next-session-error" : undefined
            }
          />
          {fieldErrors.nextSessionDate && (
            <p
              id="next-session-error"
              className="text-xs text-red-600 mt-1"
              role="alert"
            >
              {fieldErrors.nextSessionDate}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Remarks
        </label>
        <textarea
          className="w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          rows={4}
          value={formState.remarks}
          onChange={(event) => handleChange("remarks", event.target.value)}
          placeholder="Notes, observations, or reminders"
        />
      </div>

      {formError && <ErrorMessage message={formError} />}
      {error && <ErrorMessage message={error} />}

      <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
        <Button
          type="button"
          variant="tertiary"
          onClick={onCancel}
          className="w-full sm:flex-1 min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full sm:flex-1 min-h-[44px]"
        >
          {submitting ? "Saving..." : report ? "Update Report" : "Save Report"}
        </Button>
      </div>
    </form>
  );
}

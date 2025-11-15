import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import {
  Lesson,
  LessonSessionReport,
  LessonSessionReportInput,
} from "@/src/types/lesson";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";

export interface LessonSessionReportFormProps {
  report?: LessonSessionReport | null;
  submitting?: boolean;
  onSubmit: (values: LessonSessionReportInput) => void;
  onCancel: () => void;
  people: Person[];
  lessons: Lesson[];
  defaultLessonId?: number | string | null;
  defaultTeacherId?: number | string | null;
  defaultStudentId?: number | string | null;
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
  defaultStudentId,
  error,
}: LessonSessionReportFormProps) {
  const teacherOptions = useMemo(
    () => people.filter((person) => person.role !== "VISITOR"),
    [people]
  );

  const studentOptions = useMemo(() => {
    return [...people].sort((first, second) => {
      const nameA = formatPersonName(first);
      const nameB = formatPersonName(second);
      return nameA.localeCompare(nameB);
    });
  }, [people]);

  const defaultState = useMemo(
    (): FormState => ({
      teacherId:
        report?.teacher?.id?.toString() ?? defaultTeacherId?.toString() ?? "",
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
    [report, defaultTeacherId, defaultStudentId, defaultLessonId]
  );

  const [formState, setFormState] = useState<FormState>(defaultState);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [teacherQuery, setTeacherQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [isTeacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const [isStudentDropdownOpen, setStudentDropdownOpen] = useState(false);

  useEffect(() => {
    setFormState(defaultState);
    const teacherMatch = teacherOptions.find(
      (person) => person.id?.toString() === defaultState.teacherId
    );
    setTeacherQuery(teacherMatch ? formatPersonName(teacherMatch) : "");

    const studentMatch = studentOptions.find(
      (person) => person.id?.toString() === defaultState.studentId
    );
    setStudentQuery(studentMatch ? formatPersonName(studentMatch) : "");
  }, [defaultState, teacherOptions, studentOptions]);

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

  const filteredTeacherOptions = useMemo(() => {
    const query = teacherQuery.trim().toLowerCase();
    if (!query) {
      return teacherOptions;
    }
    return teacherOptions.filter((person) => {
      const name = formatPersonName(person).toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      return name.includes(query) || username.includes(query);
    });
  }, [teacherOptions, teacherQuery]);

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

  const teacherDropdownRef = useRef<HTMLDivElement | null>(null);
  const studentDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target as Node)
      ) {
        setTeacherDropdownOpen(false);
      }
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

    if (!lessonId) {
      errors.lessonId = "Select the lesson covered in this session.";
    }

    if (!sessionDate) {
      errors.sessionDate = "Provide the date when the session happened.";
    }

    if (!sessionStart) {
      errors.sessionStart = "Provide the start time for the session.";
    } else {
      const sessionStartDate = new Date(sessionStart);
      if (Number.isNaN(sessionStartDate.getTime())) {
        errors.sessionStart = "The session start time is invalid.";
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
            "Next session date must be after the session date.";
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
        <div className="space-y-2" ref={teacherDropdownRef}>
          <label
            htmlFor="teacher-search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Teacher
          </label>
          <div className="relative">
            <input
              id="teacher-search"
              type="text"
              value={teacherQuery}
              onChange={(event) => {
                setTeacherQuery(event.target.value);
                setTeacherDropdownOpen(true);
              }}
              onFocus={() => setTeacherDropdownOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTeacherDropdownOpen(false);
                }
              }}
              placeholder="Search teacher by name or username..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search for teacher"
              aria-expanded={isTeacherDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="teacher-options"
            />
            {isTeacherDropdownOpen && (
              <div
                id="teacher-options"
                role="listbox"
                className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto"
                aria-label="Teacher options"
              >
                {filteredTeacherOptions.length === 0 ? (
                  <div
                    className="px-3 py-2 text-sm text-gray-500"
                    role="option"
                  >
                    No teachers match your search.
                  </div>
                ) : (
                  filteredTeacherOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      role="option"
                      aria-selected={
                        formState.teacherId === person.id?.toString()
                      }
                      onClick={() => {
                        handleChange("teacherId", person.id.toString());
                        setTeacherQuery(formatPersonName(person));
                        setTeacherDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {formatPersonName(person)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {person.username}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Defaults to the currently logged in user when available.
          </p>
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
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                fieldErrors.studentId
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {formatPersonName(person)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {person.member_id || person.username}
                        </span>
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
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            fieldErrors.lessonId
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
              {lesson.title} ({lesson.version_label})
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
            Session Date{" "}
            <span className="text-red-500" aria-label="required">
              *
            </span>
          </label>
          <input
            id="session-date"
            type="date"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.sessionDate
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
            Session Start{" "}
            <span className="text-red-500" aria-label="required">
              *
            </span>
          </label>
          <input
            id="session-start"
            type="datetime-local"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.sessionStart
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            Next Session Date (optional)
          </label>
          <input
            id="next-session-date"
            type="date"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              fieldErrors.nextSessionDate
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          value={formState.remarks}
          onChange={(event) => handleChange("remarks", event.target.value)}
          placeholder="Notes, observations, or reminders"
        />
      </div>

      {formError && <ErrorMessage message={formError} />}
      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : report ? "Update Report" : "Save Report"}
        </Button>
      </div>
    </form>
  );
}

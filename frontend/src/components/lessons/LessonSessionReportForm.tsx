import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { Lesson, LessonSessionReport, LessonSessionReportInput } from "@/src/types/lesson";
import { Person } from "@/src/types/person";

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

  const defaultState: FormState = {
    teacherId:
      report?.teacher?.id?.toString() ?? defaultTeacherId?.toString() ?? "",
    studentId:
      report?.student?.id?.toString() ?? defaultStudentId?.toString() ?? "",
    lessonId:
      report?.lesson?.id?.toString() ?? defaultLessonId?.toString() ?? "",
    sessionDate: report?.session_date ?? new Date().toISOString().slice(0, 10),
    sessionStart:
      toLocalDateTimeValue(report?.session_start) ||
      new Date().toISOString().slice(0, 16),
    score: report?.score ?? "",
    nextSessionDate: report?.next_session_date ?? "",
    remarks: report?.remarks ?? "",
  };

  const [formState, setFormState] = useState<FormState>(defaultState);
  const [formError, setFormError] = useState<string | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [isTeacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const [isStudentDropdownOpen, setStudentDropdownOpen] = useState(false);

  useEffect(() => {
    setFormState(defaultState);
    const teacherMatch = teacherOptions.find(
      (person) => person.id?.toString() === defaultState.teacherId
    );
    setTeacherQuery(teacherMatch ? buildPersonName(teacherMatch) : "");

    const studentMatch = studentOptions.find(
      (person) => person.id?.toString() === defaultState.studentId
    );
    setStudentQuery(studentMatch ? buildPersonName(studentMatch) : "");
  }, [
    report,
    defaultLessonId,
    defaultTeacherId,
    defaultStudentId,
    teacherOptions,
    studentOptions,
  ]);

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
      const name = buildPersonName(person).toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      return name.includes(query) || username.includes(query);
    });
  }, [teacherOptions, teacherQuery]);

  const studentOptions = useMemo(() => {
    return [...people].sort((first, second) => {
      const nameA = buildPersonName(first);
      const nameB = buildPersonName(second);
      return nameA.localeCompare(nameB);
    });
  }, [people]);

  const filteredStudentOptions = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) {
      return studentOptions;
    }
    return studentOptions.filter((person) => {
      const name = buildPersonName(person).toLowerCase();
      const username = person.username?.toLowerCase() ?? "";
      const memberId = person.member_id?.toLowerCase() ?? "";
      return (
        name.includes(query) || username.includes(query) || memberId.includes(query)
      );
    });
  }, [studentOptions, studentQuery]);

  const handleChange = (field: keyof FormState, value: string) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
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

    const { teacherId, studentId, lessonId, sessionDate, sessionStart } =
      formState;

    if (!studentId) {
      setFormError("Select a student for this session.");
      return;
    }

    if (!lessonId) {
      setFormError("Select the lesson covered in this session.");
      return;
    }

    if (!sessionDate) {
      setFormError("Provide the date when the session happened.");
      return;
    }

    if (!sessionStart) {
      setFormError("Provide the start time for the session.");
      return;
    }

    const sessionStartDate = new Date(sessionStart);
    if (Number.isNaN(sessionStartDate.getTime())) {
      setFormError("The session start time is invalid.");
      return;
    }

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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teacher
          </label>
          <div className="relative">
            <input
              type="text"
              value={teacherQuery}
              onChange={(event) => {
                setTeacherQuery(event.target.value);
                setTeacherDropdownOpen(true);
              }}
              onFocus={() => setTeacherDropdownOpen(true)}
              placeholder="Search teacher by name or username..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {isTeacherDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {filteredTeacherOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No teachers match your search.
                  </div>
                ) : (
                  filteredTeacherOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        handleChange("teacherId", person.id.toString());
                        setTeacherQuery(buildPersonName(person));
                        setTeacherDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {buildPersonName(person)}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Student
          </label>
          <div className="relative">
            <input
              type="text"
              value={studentQuery}
              onChange={(event) => {
                setStudentQuery(event.target.value);
                setStudentDropdownOpen(true);
              }}
              onFocus={() => setStudentDropdownOpen(true)}
              placeholder="Search student by name, username, or member ID..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            {isStudentDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {filteredStudentOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No students match your search.
                  </div>
                ) : (
                  filteredStudentOptions.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        handleChange("studentId", person.id.toString());
                        setStudentQuery(buildPersonName(person));
                        setStudentDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {buildPersonName(person)}
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
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Lesson
        </label>
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={formState.lessonId}
          onChange={(event) => handleChange("lessonId", event.target.value)}
          required
        >
          <option value="">Select lesson</option>
          {lessonOptions.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title} ({lesson.version_label})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Session Date
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={formState.sessionDate}
            onChange={(event) => handleChange("sessionDate", event.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Session Start
          </label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={formState.sessionStart}
            onChange={(event) => handleChange("sessionStart", event.target.value)}
            required
          />
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
          <label className="block text-sm font-medium text-gray-700">
            Next Session Date (optional)
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={formState.nextSessionDate}
            onChange={(event) =>
              handleChange("nextSessionDate", event.target.value)
            }
          />
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

function buildPersonName(person: Person): string {
  const pieces: string[] = [];

  if (person.first_name) {
    pieces.push(person.first_name.trim());
  }

  if (person.middle_name) {
    const initial = person.middle_name.trim().charAt(0);
    if (initial) {
      pieces.push(`${initial.toUpperCase()}.`);
    }
  }

  if (person.last_name) {
    pieces.push(person.last_name.trim());
  }

  if (person.suffix) {
    pieces.push(person.suffix.trim());
  }

  const name = pieces.join(" ").trim();

  if (name) {
    return name;
  }

  if (person.username) {
    return person.username;
  }

  return `Person #${person.id}`;
}

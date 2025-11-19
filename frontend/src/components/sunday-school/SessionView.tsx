"use client";

import Button from "@/src/components/ui/Button";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { SundaySchoolSession, AttendanceReport } from "@/src/types/sundaySchool";

interface SessionViewProps {
  session: SundaySchoolSession;
  attendanceReport: AttendanceReport | null;
  attendanceLoading: boolean;
  attendanceError: string | null;
  onEdit: () => void;
  onViewAttendance: () => void;
  onClose: () => void;
}

export default function SessionView({
  session,
  attendanceReport,
  attendanceLoading,
  attendanceError,
  onEdit,
  onViewAttendance,
  onClose,
}: SessionViewProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "—";
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-medium text-gray-900">Session Details</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {(session as any).sunday_school_class_name || 
             (typeof session.sunday_school_class === 'object' ? session.sunday_school_class?.name : null) || 
             "Sunday School Session"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-5 overflow-y-auto flex-1">
        <div className="space-y-5">
          {/* Session Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-[#2D3748] mb-4">Session Information</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <div className="text-sm font-medium text-gray-900">Date</div>
                  <div className="text-sm text-gray-500">{formatDate(session.session_date)}</div>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <div className="text-sm font-medium text-gray-900">Time</div>
                  <div className="text-sm text-gray-500">{formatTime(session.session_time)}</div>
                </div>
              </div>

              {session.lesson_title && (
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Lesson Title</div>
                    <div className="text-sm text-gray-500">{session.lesson_title}</div>
                  </div>
                </div>
              )}

              {session.notes && (
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Notes</div>
                    <div className="text-sm text-gray-500 whitespace-pre-wrap">{session.notes}</div>
                  </div>
                </div>
              )}

              {session.event_id && (
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-gray-400 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Event</div>
                    <a
                      href={`/events?event=${session.event_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      View Event on Calendar
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Attendance Summary
            </h3>
            {attendanceLoading ? (
              <div className="py-8 text-center">
                <LoadingSpinner />
                <p className="text-sm text-gray-500 mt-2">Loading attendance data...</p>
              </div>
            ) : attendanceError ? (
              <div className="py-4 text-center text-red-600 text-sm">
                {attendanceError}
              </div>
            ) : attendanceReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-600 font-medium uppercase">Total Enrolled</p>
                    <p className="text-xl font-bold text-blue-900">{attendanceReport.total_enrolled}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-600 font-medium uppercase">Present</p>
                    <p className="text-xl font-bold text-green-900">{attendanceReport.present_count}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-600 font-medium uppercase">Absent</p>
                    <p className="text-xl font-bold text-red-900">{attendanceReport.absent_count}</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 font-medium uppercase">Excused</p>
                    <p className="text-xl font-bold text-yellow-900">{attendanceReport.excused_count}</p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Attendance Rate</p>
                    <p className="text-xl font-bold text-gray-900">
                      {attendanceReport.attendance_rate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, attendanceReport.attendance_rate)}%` }}
                    />
                  </div>
                </div>

                {session.event_id && (
                  <div className="pt-2">
                    <Button
                      onClick={onViewAttendance}
                      variant="secondary"
                      className="w-full"
                    >
                      View Full Attendance Report
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500 text-sm">
                {session.event_id
                  ? "No attendance data available for this session."
                  : "No event linked to this session. Attendance cannot be tracked."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
        <Button
          onClick={onClose}
          variant="secondary"
          className="!text-black py-4 px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span>Close</span>
        </Button>
        <div className="flex gap-3">
          {session.event_id && (
            <Button
              onClick={onViewAttendance}
              variant="secondary"
              className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Attendance</span>
            </Button>
          )}
          <Button
            onClick={onEdit}
            variant="secondary"
            className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span>Edit</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


"use client";

import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { AttendanceReport as AttendanceReportType } from "@/src/types/sundaySchool";

interface AttendanceReportProps {
  report: AttendanceReportType | null;
  loading: boolean;
  error: string | null;
}

export default function AttendanceReport({ report, loading, error }: AttendanceReportProps) {
  if (loading) {
    return (
      <Card title="Attendance Report">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Attendance Report">
        <ErrorMessage message={error} />
      </Card>
    );
  }

  if (!report) {
    return (
      <Card title="Attendance Report">
        <p className="text-sm text-gray-500 py-4">No attendance data available.</p>
      </Card>
    );
  }

  const attendancePercentage = report.attendance_rate.toFixed(1);

  return (
    <Card title="Attendance Report">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-600 font-medium uppercase">Total Enrolled</p>
            <p className="text-2xl font-bold text-blue-900">{report.total_enrolled}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-xs text-green-600 font-medium uppercase">Present</p>
            <p className="text-2xl font-bold text-green-900">{report.present_count}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-600 font-medium uppercase">Absent</p>
            <p className="text-2xl font-bold text-red-900">{report.absent_count}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-600 font-medium uppercase">Excused</p>
            <p className="text-2xl font-bold text-yellow-900">{report.excused_count}</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Attendance Rate</p>
            <p className="text-2xl font-bold text-gray-900">{attendancePercentage}%</p>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, report.attendance_rate)}%` }}
            />
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            <span className="font-medium">Session Date:</span>{" "}
            {new Date(report.session_date).toLocaleDateString()}
          </p>
          {report.lesson_title && (
            <p className="mt-1">
              <span className="font-medium">Lesson:</span> {report.lesson_title}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}


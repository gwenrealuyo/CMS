"use client";

import Card from "@/src/components/ui/Card";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import { SundaySchoolSummary as SundaySchoolSummaryType } from "@/src/types/sundaySchool";

interface SundaySchoolSummaryProps {
  summary: SundaySchoolSummaryType | null;
  loading: boolean;
  error: string | null;
}

export default function SundaySchoolSummary({
  summary,
  loading,
  error,
}: SundaySchoolSummaryProps) {
  if (loading) {
    return (
      <Card title="Summary">
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Summary">
        <ErrorMessage message={error} />
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card title="Summary">
        <p className="text-sm text-gray-500 py-4">No summary data available.</p>
      </Card>
    );
  }

  return (
    <Card title="Summary">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Total Classes</p>
          <p className="text-3xl font-semibold text-[#2D3748]">{summary.total_classes}</p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.active_classes} active, {summary.inactive_classes} inactive
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-3xl font-semibold text-green-600">{summary.total_students}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Teachers</p>
          <p className="text-3xl font-semibold text-blue-600">{summary.total_teachers}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Avg Attendance</p>
          <p className="text-3xl font-semibold text-orange-500">
            {summary.average_attendance_rate !== null && summary.average_attendance_rate !== undefined
              ? `${summary.average_attendance_rate.toFixed(1)}%`
              : "—"}
          </p>
        </div>
      </div>

      {summary.most_attended_classes && summary.most_attended_classes.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Most Attended Classes</p>
          <div className="space-y-2">
            {summary.most_attended_classes.map((classItem) => (
              <div
                key={classItem.class_id}
                className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded"
              >
                <span className="text-sm text-gray-900">{classItem.class_name}</span>
                <span className="text-sm font-medium text-green-700">
                  {classItem.attendance_rate.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}


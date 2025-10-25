import React from "react";
import { ClusterWeeklyReport } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface ViewWeeklyReportModalProps {
  report: ClusterWeeklyReport;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export default function ViewWeeklyReportModal({
  report,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onCancel,
}: ViewWeeklyReportModalProps) {
  if (!isOpen) return null;

  // Ensure offerings is a number
  const offerings =
    typeof report.offerings === "string"
      ? parseFloat(report.offerings)
      : report.offerings;

  const getGatheringTypeColor = (type: string) => {
    switch (type) {
      case "PHYSICAL":
        return "bg-green-100 text-green-800";
      case "ONLINE":
        return "bg-blue-100 text-blue-800";
      case "HYBRID":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Weekly Report Details
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {report.cluster_name} - {report.year} Week {report.week_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-red-600 hover:text-red-700 text-2xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cluster</p>
                  <p className="font-medium text-gray-900">
                    {report.cluster_name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Year</p>
                  <p className="font-medium text-gray-900">{report.year}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Week Number</p>
                  <p className="font-medium text-gray-900">
                    Week {report.week_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Meeting Date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(report.meeting_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance and Gathering Type */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Attendance & Gathering
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Members Present</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {report.members_present}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Visitors Present</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {report.visitors_present}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Attendance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {report.members_present + report.visitors_present}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Gathering Type</p>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGatheringTypeColor(
                    report.gathering_type
                  )}`}
                >
                  {report.gathering_type}
                </span>
              </div>
            </div>

            {/* Offerings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Financial
              </h3>
              <div>
                <p className="text-sm text-gray-600">Offerings</p>
                <p className="text-3xl font-bold text-green-600">
                  ₱{offerings.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Activities Held
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {report.activities_held || "No activities recorded"}
              </p>
            </div>

            {/* Prayer Requests */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Prayer Requests
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {report.prayer_requests || "No prayer requests recorded"}
              </p>
            </div>

            {/* Testimonies */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Testimonies
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {report.testimonies || "No testimonies recorded"}
              </p>
            </div>

            {/* Highlights and Lowlights */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl border border-green-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-green-900 mb-3">
                  Highlights
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {report.highlights || "No highlights recorded"}
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl border border-orange-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-orange-900 mb-3">
                  Lowlights
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {report.lowlights || "No lowlights recorded"}
                </p>
              </div>
            </div>

            {/* Submission Information */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Submission Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Submitted By</p>
                  <p className="font-medium text-gray-900">
                    {report.submitted_by_details
                      ? `${report.submitted_by_details.first_name} ${report.submitted_by_details.last_name}`
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted At</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(report.submitted_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onDelete}
            variant="secondary"
            className="!text-red-600 py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="secondary"
              className="!text-black py-4 px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Cancel</span>
            </Button>
            <Button
              onClick={onEdit}
              variant="secondary"
              className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-4 h-4"
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
              <span>Edit</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

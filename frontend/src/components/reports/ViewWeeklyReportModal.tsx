import React, { useState, useEffect } from "react";
import {
  ClusterWeeklyReport,
  PersonUI,
  Person,
  Family,
} from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";
import PersonProfile from "@/src/components/people/PersonProfile";
import { familiesApi } from "@/src/lib/api";

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
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [visitorsExpanded, setVisitorsExpanded] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonUI | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);

  // Show 6 items initially (2 rows on lg screens with 3 columns)
  const INITIAL_DISPLAY_COUNT = 6;

  // Fetch families when modal opens
  useEffect(() => {
    if (isOpen) {
      familiesApi
        .getAll()
        .then((response) => {
          setFamilies(response.data || []);
        })
        .catch((error) => {
          console.error("Error fetching families:", error);
          setFamilies([]);
        });
    }
  }, [isOpen]);

  const handlePersonClick = (person: PersonUI) => {
    setSelectedPerson(person);
    setShowPersonModal(true);
  };

  const handlePersonModalCancel = () => {
    setShowPersonModal(false);
    setSelectedPerson(null);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SEMIACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "DECEASED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "PASTOR":
        return "bg-purple-100 text-purple-800";
      case "COORDINATOR":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VISITOR":
        return "bg-orange-100 text-orange-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-medium text-gray-900">
              Weekly Report Details
            </h2>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {report.cluster_code} {report.cluster_name} - {report.year} Week{" "}
              {report.week_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-red-600 hover:text-red-700 text-xl font-bold p-1 rounded-md hover:bg-red-50 transition-colors"
          >
            <svg
              className="w-5 h-5"
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
        <div className="p-5 overflow-y-auto flex-1">
          <div className="space-y-5">
            {/* Basic Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {report.cluster_code}{" "}
                  {report.cluster_name || "Untitled Cluster"}
                </h2>
                <div className="flex flex-col items-end text-sm text-gray-700">
                  <span className="font-medium">Year {report.year}</span>
                  <span className="font-medium">Week {report.week_number}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{formatDate(report.meeting_date)}</span>
                </div>
              </div>
            </div>

            {/* Attendance and Gathering Type */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Attendance & Gathering
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Members Present</p>
                  <p className="text-xl font-bold text-gray-900">
                    {report.members_present}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Visitors Present</p>
                  <p
                    className={`text-xl font-bold ${
                      report.visitors_present === 0
                        ? "text-red-600"
                        : "text-gray-900"
                    }`}
                  >
                    {report.visitors_present}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Attendance</p>
                  <p className="text-xl font-bold text-blue-600">
                    {report.members_present + report.visitors_present}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Gathering Type</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGatheringTypeColor(
                      report.gathering_type
                    )}`}
                  >
                    {report.gathering_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Offerings</p>
                  <span className="inline-flex items-center text-sm font-medium text-green-600">
                    ₱{offerings.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Members & Visitors Who Attended */}
            {((report.members_attended_details &&
              report.members_attended_details.length > 0) ||
              (report.visitors_attended_details &&
                report.visitors_attended_details.length > 0)) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                {report.members_attended_details &&
                  report.members_attended_details.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Members Who Attended (
                          {report.members_attended_details.length})
                        </h3>
                        {report.members_attended_details.length >
                          INITIAL_DISPLAY_COUNT && (
                          <button
                            onClick={() => setMembersExpanded(!membersExpanded)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            {membersExpanded ? (
                              <>
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
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                                Show Less
                              </>
                            ) : (
                              <>
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
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                                Show More
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(membersExpanded
                          ? report.members_attended_details
                          : report.members_attended_details.slice(
                              0,
                              INITIAL_DISPLAY_COUNT
                            )
                        ).map((member) => (
                          <div
                            key={member.id}
                            onClick={() => handlePersonClick(member)}
                            className="flex items-center space-x-2 p-2 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {member.first_name?.[0] || ""}
                              {member.last_name?.[0] || ""}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate text-sm">
                                {formatPersonName(member)}
                              </p>
                              {member.email && (
                                <p className="text-xs text-gray-600 truncate">
                                  {member.email}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {member.role && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(
                                    member.role
                                  )}`}
                                >
                                  {member.role?.toLowerCase() || "unknown"}
                                </span>
                              )}
                              {member.status && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                                    member.status
                                  )}`}
                                >
                                  {member.status?.toLowerCase() || "unknown"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                {report.visitors_attended_details &&
                  report.visitors_attended_details.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Visitors Who Attended (
                          {report.visitors_attended_details.length})
                        </h3>
                        {report.visitors_attended_details.length >
                          INITIAL_DISPLAY_COUNT && (
                          <button
                            onClick={() =>
                              setVisitorsExpanded(!visitorsExpanded)
                            }
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            {visitorsExpanded ? (
                              <>
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
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                                Show Less
                              </>
                            ) : (
                              <>
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
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                                Show More
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(visitorsExpanded
                          ? report.visitors_attended_details
                          : report.visitors_attended_details.slice(
                              0,
                              INITIAL_DISPLAY_COUNT
                            )
                        ).map((visitor) => (
                          <div
                            key={visitor.id}
                            onClick={() => handlePersonClick(visitor)}
                            className="flex items-center space-x-2 p-2 bg-gray-50 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {visitor.first_name?.[0] || ""}
                              {visitor.last_name?.[0] || ""}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate text-sm">
                                {formatPersonName(visitor)}
                              </p>
                              {visitor.email && (
                                <p className="text-xs text-gray-600 truncate">
                                  {visitor.email}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {visitor.role && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(
                                    visitor.role
                                  )}`}
                                >
                                  {visitor.role?.toLowerCase() || "unknown"}
                                </span>
                              )}
                              {visitor.status && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                                    visitor.status
                                  )}`}
                                >
                                  {visitor.status?.toLowerCase() || "unknown"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Activities */}
            {report.activities_held && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Activities Held
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.activities_held}
                </p>
              </div>
            )}

            {/* Prayer Requests */}
            {report.prayer_requests && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Prayer Requests
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.prayer_requests}
                </p>
              </div>
            )}

            {/* Testimonies */}
            {report.testimonies && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Testimonies
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.testimonies}
                </p>
              </div>
            )}

            {/* Highlights and Lowlights */}
            {(report.highlights || report.lowlights) && (
              <div className="grid grid-cols-2 gap-4">
                {report.highlights && (
                  <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                    <h3 className="text-sm font-medium text-green-900 mb-2">
                      Highlights
                    </h3>
                    <p className="text-gray-600 whitespace-pre-wrap">
                      {report.highlights}
                    </p>
                  </div>
                )}
                {report.lowlights && (
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                    <h3 className="text-sm font-medium text-orange-900 mb-2">
                      Lowlights
                    </h3>
                    <p className="text-gray-600 whitespace-pre-wrap">
                      {report.lowlights}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submission Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Submission Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Submitted By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {report.submitted_by_details
                      ? formatPersonName(report.submitted_by_details)
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Submitted At</p>
                  <p className="text-sm font-medium text-gray-900">
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

      {/* Person Profile Modal */}
      {showPersonModal && selectedPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[50] !mt-0">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[95vh] overflow-hidden flex flex-col h-full">
            <PersonProfile
              person={selectedPerson as Person}
              families={families}
              onEdit={() => {}}
              onDelete={() => {}}
              onCancel={handlePersonModalCancel}
              onAddTimeline={() => {}}
              onClose={handlePersonModalCancel}
              hideEditButton={true}
              hideDeleteButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

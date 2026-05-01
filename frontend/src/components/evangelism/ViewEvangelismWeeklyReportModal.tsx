"use client";

import { useState, useEffect } from "react";
import { EvangelismWeeklyReport } from "@/src/types/evangelism";
import { Person } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";

interface ViewEvangelismWeeklyReportModalProps {
  report: EvangelismWeeklyReport | null;
  isOpen: boolean;
  /** When false, hides Edit/Delete (matches cluster modal). */
  canMutateReports?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const INITIAL_DISPLAY_COUNT = 6;

export default function ViewEvangelismWeeklyReportModal({
  report,
  isOpen,
  canMutateReports = true,
  onClose,
  onEdit,
  onDelete,
}: ViewEvangelismWeeklyReportModalProps) {
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [visitorsExpanded, setVisitorsExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && report) {
      setMembersExpanded(false);
      setVisitorsExpanded(false);
    }
  }, [
    isOpen,
    report?.id,
    report?.updated_at,
    report?.meeting_date,
    report?.members_attended?.length,
    report?.visitors_attended?.length,
  ]);

  if (!isOpen || !report) return null;

  const membersDetails = report.members_attended_details ?? [];
  const visitorsDetails = report.visitors_attended_details ?? [];
  const memberCount =
    Array.isArray(report.members_attended) ?
      report.members_attended.length
    : membersDetails.length;
  const visitorCount =
    Array.isArray(report.visitors_attended) ?
      report.visitors_attended.length
    : visitorsDetails.length;
  const totalAttendance = memberCount + visitorCount;

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

  const getGatheringTypeColor = (type?: string) => {
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

  const groupTitle = report.evangelism_group?.name ?? "Evangelism group";

  function renderPersonCard(person: Person, variant: "member" | "visitor") {
    const avatarBg =
      variant === "member" ?
        "bg-gradient-to-br from-green-400 to-emerald-500"
      : "bg-gradient-to-br from-yellow-400 to-orange-500";
    return (
      <div
        key={person.id}
        className="flex items-center space-x-2 p-2 bg-gray-50 border border-gray-200 rounded-md cursor-default transition-colors hover:bg-gray-100"
      >
        <div
          className={`w-8 h-8 ${avatarBg} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
        >
          {person.first_name?.[0] || ""}
          {person.last_name?.[0] || ""}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate text-sm">
            {formatPersonName(person) ||
              person.username ||
              `ID ${person.id}`}
          </p>
          {person.email ? (
            <p className="text-xs text-gray-600 truncate">{person.email}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {person.role ? (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleColor(
                person.role,
              )}`}
            >
              {person.role?.toLowerCase() || "unknown"}
            </span>
          ) : null}
          {person.status ? (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(
                person.status,
              )}`}
            >
              {person.status?.toLowerCase() || "unknown"}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full max-w-4xl h-full sm:h-auto sm:max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 py-3 pl-3 sm:pl-6 pr-2 shrink-0">
          <div>
            <h2 className="text-sm font-medium text-gray-900">
              Weekly Report Details
            </h2>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {groupTitle} - {report.year} Week {report.week_number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            aria-label="Close modal"
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

        <div className="p-5 overflow-y-auto flex-1">
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-gray-900">{groupTitle}</h2>
                <div className="flex flex-col items-end text-sm text-gray-700 shrink-0">
                  <span className="font-medium">Year {report.year}</span>
                  <span className="font-medium">Week {report.week_number}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-700 mt-2">
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4 shrink-0"
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
                  <span>
                    {report.meeting_date ?
                      formatDate(report.meeting_date)
                    : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Attendance & Gathering
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Members Present</p>
                  <p className="text-xl font-bold text-gray-900">
                    {memberCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Visitors Present</p>
                  <p
                    className={`text-xl font-bold ${
                      visitorCount === 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {visitorCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Attendance</p>
                  <p className="text-xl font-bold text-blue-600">
                    {totalAttendance}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Gathering Type</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGatheringTypeColor(
                      report.gathering_type,
                    )}`}
                  >
                    {report.gathering_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">New Prospects</p>
                  <p className="text-xl font-bold text-gray-900">
                    {report.new_prospects ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Conversions This Week</p>
                  <p className="text-xl font-bold text-gray-900">
                    {report.conversions_this_week ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {(membersDetails.length > 0 || visitorsDetails.length > 0) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                {membersDetails.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Members Who Attended ({membersDetails.length})
                      </h3>
                      {membersDetails.length > INITIAL_DISPLAY_COUNT && (
                        <button
                          type="button"
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
                      {(membersExpanded ?
                        membersDetails
                      : membersDetails.slice(0, INITIAL_DISPLAY_COUNT)
                      ).map((m) => renderPersonCard(m, "member"))}
                    </div>
                  </div>
                )}
                {visitorsDetails.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Visitors Who Attended ({visitorsDetails.length})
                      </h3>
                      {visitorsDetails.length > INITIAL_DISPLAY_COUNT && (
                        <button
                          type="button"
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
                      {(visitorsExpanded ?
                        visitorsDetails
                      : visitorsDetails.slice(0, INITIAL_DISPLAY_COUNT)
                      ).map((v) => renderPersonCard(v, "visitor"))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {report.topic ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Topic
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.topic}
                </p>
              </div>
            ) : null}

            {report.activities_held ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Activities Held
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.activities_held}
                </p>
              </div>
            ) : null}

            {report.prayer_requests ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Prayer Requests
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.prayer_requests}
                </p>
              </div>
            ) : null}

            {report.testimonies ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Testimonies
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.testimonies}
                </p>
              </div>
            ) : null}

            {report.notes ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Notes
                </h3>
                <p className="text-gray-600 whitespace-pre-wrap">
                  {report.notes}
                </p>
              </div>
            ) : null}

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Submission Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Submitted By</p>
                  <p className="text-sm font-medium text-gray-900">
                    {report.submitted_by ?
                      formatPersonName(report.submitted_by as Person)
                    : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Submitted At</p>
                  <p className="text-sm font-medium text-gray-900">
                    {report.submitted_at ?
                      formatDateTime(report.submitted_at)
                    : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div className="flex flex-col md:hidden gap-3 w-full">
              {canMutateReports ?
                <>
                  <Button
                    onClick={onEdit}
                    variant="secondary"
                    className="!text-blue-600 py-3 px-4 text-sm font-medium bg-white border border-blue-300 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                  <Button
                    onClick={onClose}
                    variant="secondary"
                    className="!text-gray-700 py-3 px-4 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                  <div className="border-t border-gray-200 my-1" />
                  <Button
                    onClick={onDelete}
                    variant="secondary"
                    className="!text-red-600 py-3 px-4 text-sm font-medium bg-white border border-red-300 hover:bg-red-50 hover:border-red-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
                    <span>Delete</span>
                  </Button>
                </>
              : <Button
                  onClick={onClose}
                  variant="secondary"
                  className="!text-gray-700 py-3 px-4 text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center space-x-2 min-h-[44px] w-full"
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
              }
            </div>

            {canMutateReports ?
              <div className="hidden md:flex md:items-center md:justify-between md:w-full">
                <Button
                  onClick={onDelete}
                  variant="secondary"
                  className="!text-red-600 px-4 md:py-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center min-h-[44px] min-w-[44px]"
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
                <div className="flex items-center gap-3">
                  <Button
                    onClick={onClose}
                    variant="secondary"
                    className="!text-black px-6 md:py-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px]"
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
                    className="!text-blue-600 px-6 md:py-4 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px]"
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
            : <div className="hidden md:flex md:justify-end md:w-full">
                <Button
                  onClick={onClose}
                  variant="secondary"
                  className="!text-black px-6 md:py-4 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px]"
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
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

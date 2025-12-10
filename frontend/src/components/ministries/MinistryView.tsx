import React, { useMemo } from "react";
import { Ministry, MinistryMember, UserSummary } from "@/src/types/ministry";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";

interface MinistryViewProps {
  ministry: Ministry;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onViewPerson?: (person: UserSummary) => void;
}

export default function MinistryView({
  ministry,
  onEdit,
  onDelete,
  onCancel,
  onClose,
  onViewPerson,
}: MinistryViewProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      worship: "Worship",
      outreach: "Outreach",
      care: "Care",
      logistics: "Logistics",
      other: "Other",
    };
    return labels[category] || category;
  };

  const getCadenceLabel = (cadence: string) => {
    const labels: Record<string, string> = {
      weekly: "Weekly",
      monthly: "Monthly",
      seasonal: "Seasonal",
      event_driven: "Event Driven",
      holiday: "Holiday",
      ad_hoc: "Ad Hoc",
    };
    return labels[cadence] || cadence;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      primary_coordinator: "Primary Coordinator",
      coordinator: "Coordinator",
      team_member: "Team Member",
      guest_helper: "Guest Helper",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "primary_coordinator":
        return "bg-purple-100 text-purple-800";
      case "coordinator":
        return "bg-blue-100 text-blue-800";
      case "team_member":
        return "bg-green-100 text-green-800";
      case "guest_helper":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Parse meeting schedule
  const meetingSchedule = ministry.meeting_schedule as Record<
    string,
    string
  > | null;
  const scheduleDay = meetingSchedule?.day || "";
  const scheduleTime = meetingSchedule?.time || "";
  const scheduleWindow = meetingSchedule?.window || "";
  const scheduleNotes = meetingSchedule?.notes || "";

  // Sort members by join date (most recent first) or by name
  const sortedMembers = useMemo(() => {
    const members = [...(ministry.memberships || [])];
    return members.sort((a, b) => {
      // Sort by active status first (active first), then by join date (most recent first)
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }
      if (a.join_date && b.join_date) {
        return (
          new Date(b.join_date).getTime() - new Date(a.join_date).getTime()
        );
      }
      // Fallback to name sorting
      const nameA = formatPersonName(a.member).toLowerCase();
      const nameB = formatPersonName(b.member).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [ministry.memberships]);

  const activeMembersCount = sortedMembers.filter((m) => m.is_active).length;
  const inactiveMembersCount = sortedMembers.filter((m) => !m.is_active).length;

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-gray-900">
            Ministry Details
          </h2>
          <p className="text-xs md:text-[11px] text-gray-600 mt-0.5 truncate">
            {ministry.name}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
          aria-label="Close"
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
      <div className="p-4 md:p-5 overflow-y-auto flex-1">
        <div className="space-y-4 md:space-y-5">
          {/* Ministry Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                  {ministry.name}
                </h2>
                {ministry.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium flex-shrink-0">
                    {getCategoryLabel(ministry.category)}
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${
                    ministry.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {ministry.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-gray-700 flex-wrap">
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span className="text-sm font-normal">
                    {activeMembersCount} active
                  </span>
                </div>
                {inactiveMembersCount > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-normal text-gray-500">
                      {inactiveMembersCount} inactive
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-sm font-normal">
                    {getCadenceLabel(ministry.activity_cadence)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {ministry.description && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {ministry.description}
              </p>
            </div>
          )}

          {/* Coordinators */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Coordinators
            </h3>
            <div className="space-y-3">
              {ministry.primary_coordinator ? (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {ministry.primary_coordinator.first_name?.[0] || ""}
                      {ministry.primary_coordinator.last_name?.[0] || ""}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatPersonName(ministry.primary_coordinator)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Primary Coordinator
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No primary coordinator assigned
                </p>
              )}

              {ministry.support_coordinators &&
              ministry.support_coordinators.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Support Coordinators ({ministry.support_coordinators.length}
                    )
                  </p>
                  <div className="space-y-2">
                    {ministry.support_coordinators.map((coordinator) => (
                      <div
                        key={coordinator.id}
                        className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() =>
                          onViewPerson && onViewPerson(coordinator)
                        }
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {coordinator.first_name?.[0] || ""}
                          {coordinator.last_name?.[0] || ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {formatPersonName(coordinator)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No support coordinators assigned
                </p>
              )}
            </div>
          </div>

          {/* Meeting Information */}
          {(ministry.meeting_location ||
            scheduleDay ||
            scheduleTime ||
            scheduleWindow ||
            scheduleNotes) && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Meeting Information
              </h3>
              <div className="space-y-2">
                {ministry.meeting_location && (
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Location
                      </p>
                      <p className="text-sm text-gray-900">
                        {ministry.meeting_location}
                      </p>
                    </div>
                  </div>
                )}
                {(scheduleDay || scheduleTime) && (
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
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
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Schedule
                      </p>
                      <p className="text-sm text-gray-900">
                        {scheduleDay && scheduleTime
                          ? `${scheduleDay} at ${scheduleTime}`
                          : scheduleDay || scheduleTime || "—"}
                      </p>
                    </div>
                  </div>
                )}
                {scheduleWindow && (
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        Season/Window
                      </p>
                      <p className="text-sm text-gray-900">{scheduleWindow}</p>
                    </div>
                  </div>
                )}
                {scheduleNotes && (
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {scheduleNotes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Communication Channel */}
          {ministry.communication_channel && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Communication Channel
              </h3>
              <a
                href={ministry.communication_channel}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                {ministry.communication_channel}
              </a>
            </div>
          )}

          {/* Members */}
          {sortedMembers.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Members ({sortedMembers.length})
              </h3>
              <div className="space-y-2">
                {sortedMembers.map((membership: MinistryMember) => (
                  <div
                    key={membership.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      membership.is_active
                        ? "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        : "bg-gray-100 border-gray-300 opacity-75"
                    } ${onViewPerson ? "cursor-pointer" : ""}`}
                    onClick={() =>
                      onViewPerson &&
                      membership.member &&
                      onViewPerson(membership.member)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                          membership.is_active
                            ? "bg-gradient-to-br from-green-400 to-emerald-500"
                            : "bg-gradient-to-br from-gray-400 to-gray-500"
                        }`}
                      >
                        {membership.member.first_name?.[0] || ""}
                        {membership.member.last_name?.[0] || ""}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {formatPersonName(membership.member)}
                        </p>
                        <div className="flex flex-col gap-1.5 mt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getRoleBadgeColor(
                                membership.role
                              )}`}
                            >
                              {getRoleLabel(membership.role)}
                            </span>
                            {membership.skills && (
                              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                {membership.skills}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              Joined {formatDate(membership.join_date)}
                            </span>
                          </div>
                          {membership.notes && (
                            <div className="mt-0.5">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">
                                Notes:
                              </p>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                {membership.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${
                        membership.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {membership.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State for Members */}
          {sortedMembers.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Members
              </h3>
              <p className="text-sm text-gray-500 italic">
                No members assigned to this ministry yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 md:p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto sm:order-2">
          <Button
            onClick={onCancel}
            variant="secondary"
            className="!text-black md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
            className="!text-blue-600 md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
        <div className="sm:order-1">
          <div className="border-t border-gray-200 my-2 sm:hidden"></div>
          <Button
            onClick={onDelete}
            variant="secondary"
            className="!text-red-600 md:py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center min-h-[44px] md:min-h-0 w-full sm:w-auto"
            aria-label="Delete ministry"
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
            <span className="md:hidden ml-2">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

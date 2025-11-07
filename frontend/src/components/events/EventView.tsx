import { useMemo } from "react";

import { Event } from "@/src/types/event";
import Button from "@/src/components/ui/Button";

interface EventViewProps {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export default function EventView({
  event,
  onEdit,
  onDelete,
  onCancel,
  onClose,
}: EventViewProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      SUNDAY_SERVICE: "bg-blue-100 text-blue-800 border-blue-200",
      BIBLE_STUDY: "bg-purple-100 text-purple-800 border-purple-200",
      PRAYER_MEETING: "bg-green-100 text-green-800 border-green-200",
      SPECIAL_EVENT: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const recurrenceWeekdayLabel = useMemo(() => {
    if (!event.start_date) return null;
    return new Date(event.start_date).toLocaleDateString("en-US", {
      weekday: "long",
    });
  }, [event.start_date]);

  const recurrenceThroughLabel = useMemo(() => {
    if (!event.recurrence_pattern?.through) return null;
    return new Date(
      `${event.recurrence_pattern.through}T00:00:00`
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [event.recurrence_pattern?.through]);

  const skippedDatesCount =
    event.recurrence_pattern?.excluded_dates?.length || 0;
  const skippedLabel = skippedDatesCount === 1 ? "occurrence" : "occurrences";

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-medium text-gray-900">Event Details</h2>
          <p className="text-[11px] text-gray-600 mt-0.5">{event.title}</p>
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
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xl font-semibold text-[#2D3748] mb-3">
              {event.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-3 py-1 text-sm font-medium rounded-full border ${getEventTypeColor(
                  event.type
                )}`}
              >
                {event.type_display || event.type}
              </span>
              {event.is_recurring && (
                <span className="inline-block px-3 py-1 text-sm text-gray-600 bg-gray-50 rounded-full border border-gray-200">
                  🔁 Recurring Event
                </span>
              )}
              {event.volunteer_count !== undefined &&
                event.volunteer_count > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 bg-gray-50 rounded-full border border-gray-200">
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>
                      {event.volunteer_count} Volunteer
                      {event.volunteer_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
            </div>
          </div>

          {event.description && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Event Details
            </h3>
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
                  <div className="text-sm font-medium text-gray-900">
                    {formatDateTime(event.start_date)}
                  </div>
                  <div className="text-sm text-gray-500">
                    to {formatTime(event.end_date)}
                  </div>
                </div>
              </div>

              {event.location && (
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Location
                    </div>
                    <div className="text-sm text-gray-500">
                      {event.location}
                    </div>
                  </div>
                </div>
              )}

              {event.is_recurring && event.recurrence_pattern && (
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Recurrence
                    </div>
                    <div className="text-sm text-gray-500">
                      Weekly on {recurrenceWeekdayLabel || "the selected day"}{" "}
                      through {recurrenceThroughLabel || "the end of the year"}.
                      {skippedDatesCount > 0 && (
                        <span className="block text-xs text-gray-400 mt-1">
                          {skippedDatesCount} {skippedLabel} skipped for this
                          schedule.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
            onClick={onCancel ? onCancel : onClose}
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
            <span>{onCancel ? "Back" : "Close"}</span>
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
  );
}

import { Event } from "@/src/types/event";
import Card from "@/src/components/ui/Card";
import Button from "../ui/Button";

interface EventCardProps {
  event: Event;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
}

export default function EventCard({
  event,
  onEdit,
  onDelete,
  onView,
}: EventCardProps) {
  const nextStart = event.next_occurrence?.start_date || event.start_date;
  const nextEnd = event.next_occurrence?.end_date || event.end_date;

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      SUNDAY_SERVICE: "bg-blue-100 text-blue-800 border-blue-200",
      BIBLE_STUDY: "bg-purple-100 text-purple-800 border-purple-200",
      PRAYER_MEETING: "bg-green-100 text-green-800 border-green-200",
      SPECIAL_EVENT: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#2D3748]">
              {event.title}
            </h3>
            <span
              className={`inline-block px-3 py-1 text-xs font-medium rounded-full border mt-2 ${getEventTypeColor(
                event.type
              )}`}
            >
              {event.type_display || event.type}
            </span>
            {event.is_recurring && (
              <span className="ml-2 inline-block px-2 py-1 text-xs text-gray-600 bg-gray-50 rounded-full border border-gray-200">
                🔁 Recurring
              </span>
            )}
          </div>
          {onView && (
            <Button 
              variant="tertiary" 
              onClick={onView} 
              className="text-xs min-h-[44px]"
            >
              View
            </Button>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-start text-sm text-gray-600">
            <svg
              className="w-4 h-4 mt-0.5 mr-2 text-gray-400"
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
              <div className="font-medium">
                {new Date(nextStart).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-xs text-gray-500">
                Ends
                {" "}
                {new Date(nextEnd).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              {event.is_recurring && event.recurrence_pattern && (
                <div className="text-xs text-gray-500 mt-1">
                  Repeats weekly on{" "}
                  {new Date(nextStart).toLocaleDateString("en-US", {
                    weekday: "long",
                  })}
                  {" through "}
                  {new Date(
                    `${event.recurrence_pattern.through}T00:00:00`
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start text-sm text-gray-600">
              <svg
                className="w-4 h-4 mt-0.5 mr-2 text-gray-400"
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
              <span>{event.location}</span>
            </div>
          )}

          {event.attendance_count !== undefined && event.attendance_count > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
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
                {event.attendance_count} attendee
                {event.attendance_count !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex gap-2 pt-2 border-t">
            {onEdit && (
              <Button
                variant="tertiary"
                onClick={onEdit}
                className="flex-1 text-xs min-h-[44px]"
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="tertiary"
                onClick={onDelete}
                className="flex-1 text-xs min-h-[44px] text-red-600 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

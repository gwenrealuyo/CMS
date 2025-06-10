import { Event } from "@/src/types/event";
import Card from "@/src/components/ui/Card";
import Button from "../ui/Button";

interface EventCardProps {
  event: Event;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-[#2D3748]">
            {event.title}
          </h3>
          <span className="inline-block px-2 py-1 text-sm rounded-full bg-[#805AD5] text-white mt-2">
            {event.type}
          </span>
          <p className="mt-2 text-gray-600">{event.description}</p>
          <div className="mt-4 space-y-1">
            <p className="text-sm text-gray-500">
              Start: {formatDate(event.startDate)}
            </p>
            <p className="text-sm text-gray-500">
              End: {formatDate(event.endDate)}
            </p>
          </div>
        </div>
        <div className="space-x-2">
          {onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="secondary" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

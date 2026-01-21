import Card from "@/src/components/ui/Card";

export interface Activity {
  id: string;
  type: "people" | "event" | "finance";
  description: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: Activity[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function RecentActivity({
  activities,
  isLoading = false,
  emptyMessage = "No recent activity available.",
}: RecentActivityProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Recent Activity
      </h3>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading activity...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-1">
                <p className="text-sm text-[#2D3748]">{activity.description}</p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

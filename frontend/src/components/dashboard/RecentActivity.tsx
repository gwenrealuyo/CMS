import Card from "@/src/components/ui/Card";

export interface Activity {
  id: string;
  type: "people" | "event" | "finance";
  name?: string;
  /** Activity, cluster, or evangelism group for a first attendance. */
  place?: string;
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
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Recent Activity
      </h3>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading activity...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="scrollbar-visible max-h-64 space-y-4 overscroll-contain pr-1">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-1">
                <p className="text-sm text-foreground">
                  {activity.name ? (
                    <span className="font-semibold">{activity.name} </span>
                  ) : null}
                  {activity.place ? (
                    <>
                      attended{" "}
                      <span className="underline">{activity.place}</span> for
                      the first time.
                    </>
                  ) : (
                    activity.description
                  )}
                </p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

import Card from "@/src/components/ui/Card";

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export default function RecentActivity() {
  const activities: Activity[] = [
    {
      id: "1",
      type: "member",
      description: "New member John Doe registered",
      timestamp: "2 hours ago",
    },
    {
      id: "2",
      type: "event",
      description: "Sunday Service attendance recorded",
      timestamp: "5 hours ago",
    },
    {
      id: "3",
      type: "donation",
      description: "New donation received",
      timestamp: "1 day ago",
    },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Recent Activity
      </h3>
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
    </Card>
  );
}

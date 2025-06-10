import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";

export default function QuickActions() {
  const actions = [
    { label: "Add Person", icon: "👤", href: "/people/new" },
    { label: "Create Event", icon: "📅", href: "/events/new" },
    { label: "Record Donation", icon: "💰", href: "/donations/new" },
    { label: "Take Attendance", icon: "✓", href: "/attendance/new" },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold text-[#2D3748] mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="secondary"
            onClick={() => (window.location.href = action.href)}
            // className="flex items-center justify-center space-x-2"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
}

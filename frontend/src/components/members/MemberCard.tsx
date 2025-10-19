import { Person } from "@/src/types/person";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";

interface MemberCardProps {
  member: Person;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MemberCard({
  member,
  onEdit,
  onDelete,
}: MemberCardProps) {
  return (
    <Card>
      <div className="flex items-start space-x-4">
        <img
          src={member.photo || "https://via.placeholder.com/100"}
          // alt={member.name}
          className="w-20 h-20 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#2D3748]">
                {/* {member.name} */}
              </h3>
              <span className="inline-block px-2 py-1 text-sm rounded-full bg-[#2563EB] text-white mt-1">
                {member.role}
              </span>
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
          <div className="mt-2 text-sm text-gray-600">
            <p>{member.email}</p>
            <p>{member.phone}</p>
          </div>
          {member.milestones && member.milestones.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700">
                Recent Milestones
              </h4>
              <div className="mt-1 space-y-1">
                {member.milestones.slice(0, 2).map((milestone) => (
                  <div key={milestone.id} className="text-sm text-gray-600">
                    {milestone.type} -{" "}
                    {new Date(milestone.date).toLocaleDateString()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

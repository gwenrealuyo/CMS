import { Family, Person } from "@/src/types/person";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { formatPersonName } from "@/src/lib/name";

interface FamilyCardProps {
  family: Family;
  members: Person[];
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function FamilyCard({
  family,
  members,
  onEdit,
  onDelete,
}: FamilyCardProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-[#2D3748]">
              {family.name}
            </h3>
            <p className="text-sm text-gray-600">{members.length} members</p>
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
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md"
            >
              <img
                src={member.photo || "https://via.placeholder.com/40"}
                // alt={member.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-medium text-sm text-gray-900">
                  {formatPersonName(member)}
                </p>
                <p className="text-xs text-gray-600">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

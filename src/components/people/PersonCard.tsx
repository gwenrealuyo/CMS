import { Person } from "@/src/types/person";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

interface PersonCardProps {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
}

export default function PersonCard({
  person,
  onEdit,
  onDelete,
}: PersonCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">
            {/* {person.firstName} {person.lastName} */}
            {person.name}
          </h3>
          <p className="text-gray-600">{person.email}</p>
          <p className="text-gray-600">{person.phone}</p>
          {/* <p className="text-gray-600">{person.address}</p> */}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(person)}
            className="p-2 text-gray-600 hover:text-blue-600"
          >
            <FiEdit2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(person)}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

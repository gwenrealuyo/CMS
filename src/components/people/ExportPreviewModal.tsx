import { Person } from "@/src/types/person";

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Person[];
  onExport: (format: "excel" | "pdf" | "csv") => void;
}

export default function ExportPreviewModal({
  isOpen,
  onClose,
  data,
  onExport,
}: ExportPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[80%] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Export Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Join Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.slice(0, 5).map((person) => (
                <tr key={person.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{person.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {person.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{person.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(person.joinDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length > 5 && (
          <p className="text-sm text-gray-500 mt-4">
            Showing preview of first 5 records out of {data.length} total
            records
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => onExport("excel")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export as Excel
          </button>
          <button
            onClick={() => onExport("pdf")}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Export as PDF
          </button>
          <button
            onClick={() => onExport("csv")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export as CSV
          </button>
        </div>
      </div>
    </div>
  );
}

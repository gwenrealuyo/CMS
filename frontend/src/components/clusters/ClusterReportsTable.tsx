import { ClusterWeeklyReport } from "@/src/types/cluster";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";

interface ClusterReportsTableProps {
  reports: ClusterWeeklyReport[];
  onEdit: (report: ClusterWeeklyReport) => void;
  onDelete: (report: ClusterWeeklyReport) => void;
}

export default function ClusterReportsTable({
  reports,
  onEdit,
  onDelete,
}: ClusterReportsTableProps) {
  if (reports.length === 0) {
    return (
      <Card>
        <p className="text-gray-500 text-center py-8">No reports found.</p>
      </Card>
    );
  }

  return (
    <Card>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 p-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {report.cluster_name || "Unknown"}
                </div>
                {report.cluster_code && (
                  <div className="text-sm text-gray-500">
                    {report.cluster_code}
                  </div>
                )}
              </div>
              <div>
                <span className="text-xs text-gray-500">Year/Week</span>
                <p className="text-sm text-gray-900">
                  {report.year} / Week {report.week_number}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Meeting Date</span>
                <p className="text-sm text-gray-900">
                  {new Date(report.meeting_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Attendance</span>
                <p className="text-sm text-gray-900">
                  {report.members_present}M / {report.visitors_present}V
                  {report.member_attendance_rate !== undefined && (
                    <span className="text-xs text-gray-500 block">
                      {report.member_attendance_rate.toFixed(1)}%
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Type</span>
                <p className="text-sm text-gray-900">{report.gathering_type}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Offerings</span>
                <p className="text-sm text-gray-900">
                  ₱{typeof report.offerings === 'number' ? (report.offerings as number).toFixed(2) : String(report.offerings)}
                </p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={() => onEdit(report)}
                  className="flex-1 min-h-[44px]"
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onDelete(report)}
                  className="flex-1 min-h-[44px] text-red-600 hover:text-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cluster
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Year/Week
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Meeting Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attendance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Offerings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {report.cluster_name || "Unknown"}
                  </div>
                  {report.cluster_code && (
                    <div className="text-sm text-gray-500">
                      {report.cluster_code}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.year} / Week {report.week_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(report.meeting_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.members_present}M / {report.visitors_present}V
                  {report.member_attendance_rate !== undefined && (
                    <div className="text-xs text-gray-500">
                      {report.member_attendance_rate.toFixed(1)}%
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.gathering_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₱{typeof report.offerings === 'number' ? (report.offerings as number).toFixed(2) : String(report.offerings)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onEdit(report)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onDelete(report)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


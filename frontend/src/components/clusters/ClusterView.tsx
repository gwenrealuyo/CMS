import { Cluster, Person, Family } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface ClusterViewProps {
  cluster: Cluster;
  clusterMembers: Person[];
  clusterFamilies: Family[];
  coordinator?: Person;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ClusterView({
  cluster,
  clusterMembers,
  clusterFamilies,
  coordinator,
  onEdit,
  onDelete,
  onClose,
}: ClusterViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {cluster.name || "Untitled Cluster"}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            {cluster.code && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-sm">
                {cluster.code}
              </span>
            )}
            {(cluster as any).location && (
              <span className="inline-flex items-center gap-1 text-gray-600 text-sm">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 11a3 3 0 100-6 3 3 0 000 6z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.5-7.5 11.25-7.5 11.25S4.5 18 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                {(cluster as any).location}
              </span>
            )}
            {(cluster as any).meeting_schedule && (
              <span className="inline-flex items-center gap-1 text-gray-600 text-sm">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {(cluster as any).meeting_schedule}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" onClick={onDelete}>
            Delete
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Description */}
      {cluster.description && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Description
          </h3>
          <p className="text-gray-600">{cluster.description}</p>
        </div>
      )}

      {/* Coordinator */}
      {coordinator && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Coordinator
          </h3>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {coordinator.first_name?.[0] || ""}
              {coordinator.last_name?.[0] || ""}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {coordinator.first_name} {coordinator.last_name}
              </p>
              <p className="text-sm text-gray-600">{coordinator.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Members */}
      {clusterMembers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Members ({clusterMembers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clusterMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {member.first_name?.[0] || ""}
                  {member.last_name?.[0] || ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{member.email}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    member.role === "MEMBER"
                      ? "bg-blue-100 text-blue-800"
                      : member.role === "VISITOR"
                      ? "bg-yellow-100 text-yellow-800"
                      : member.role === "COORDINATOR"
                      ? "bg-purple-100 text-purple-800"
                      : member.role === "PASTOR"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Families */}
      {clusterFamilies.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Families ({clusterFamilies.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clusterFamilies.map((family) => (
              <div
                key={family.id}
                className="p-3 bg-white border border-gray-200 rounded-lg"
              >
                <h4 className="font-medium text-gray-900">{family.name}</h4>
                <p className="text-sm text-gray-600">
                  {family.members.length} members
                </p>
                {family.address && (
                  <p className="text-sm text-gray-500 mt-1">{family.address}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty States */}
      {clusterMembers.length === 0 && clusterFamilies.length === 0 && (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No members or families
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            This cluster doesn't have any members or families assigned yet.
          </p>
        </div>
      )}
    </div>
  );
}


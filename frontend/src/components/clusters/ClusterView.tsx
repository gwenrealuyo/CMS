import { Cluster, Person, Family } from "@/src/types/person";
import Button from "@/src/components/ui/Button";

interface ClusterViewProps {
  cluster: Cluster;
  clusterMembers: Person[];
  clusterFamilies: Family[];
  coordinator?: Person;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onAssignMembers: () => void;
}

export default function ClusterView({
  cluster,
  clusterMembers,
  clusterFamilies,
  coordinator,
  onEdit,
  onDelete,
  onCancel,
  onClose,
  onAssignMembers,
}: ClusterViewProps) {
  // Calculate member counts including coordinator
  const totalMemberCount = clusterMembers.length + (coordinator ? 1 : 0);
  const memberCount =
    clusterMembers.filter((member) => member.role === "MEMBER").length +
    (coordinator && coordinator.role === "MEMBER" ? 1 : 0);
  const visitorCount =
    clusterMembers.filter((member) => member.role === "VISITOR").length +
    (coordinator && coordinator.role === "VISITOR" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Cluster Info Card */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">
              {cluster.name || "Untitled Cluster"}
            </h2>
            {cluster.code && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                {cluster.code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="text-sm font-normal">{memberCount} members</span>
            </div>
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-sm font-normal">
                {visitorCount} visitors
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-700">
          <div className="flex items-center gap-4">
            {(cluster as any).location && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
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
                <span>{(cluster as any).location}</span>
              </div>
            )}
            {(cluster as any).meeting_schedule && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-4 h-4"
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
                <span>{(cluster as any).meeting_schedule}</span>
              </div>
            )}
          </div>
          {coordinator && (
            <div className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-normal">
                {coordinator.first_name} {coordinator.last_name}
              </span>
            </div>
          )}
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

      {/* Members */}
      {(clusterMembers.length > 0 || coordinator) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Members ({totalMemberCount})
            </h3>
            <Button
              onClick={onAssignMembers}
              variant="secondary"
              className="!text-green-600 py-2 px-4 text-sm font-normal bg-white border border-green-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>Assign Members</span>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Show coordinator first if exists */}
            {coordinator && (
              <div className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {coordinator.first_name?.[0] || ""}
                  {coordinator.last_name?.[0] || ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {coordinator.first_name} {coordinator.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{coordinator.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Coordinator
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      coordinator.role === "MEMBER"
                        ? "bg-green-100 text-green-800"
                        : coordinator.role === "VISITOR"
                        ? "bg-yellow-100 text-yellow-800"
                        : coordinator.role === "COORDINATOR"
                        ? "bg-purple-100 text-purple-800"
                        : coordinator.role === "PASTOR"
                        ? "bg-red-100 text-red-800"
                        : coordinator.role === "ADMIN"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {coordinator.role}
                  </span>
                </div>
              </div>
            )}
            {/* Show other members */}
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
                      ? "bg-green-100 text-green-800"
                      : member.role === "VISITOR"
                      ? "bg-yellow-100 text-yellow-800"
                      : member.role === "COORDINATOR"
                      ? "bg-purple-100 text-purple-800"
                      : member.role === "PASTOR"
                      ? "bg-red-100 text-red-800"
                      : member.role === "ADMIN"
                      ? "bg-blue-100 text-blue-800"
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
      {clusterMembers.length === 0 &&
        clusterFamilies.length === 0 &&
        !coordinator && (
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
            <div className="mt-4">
              <Button
                onClick={onAssignMembers}
                variant="secondary"
                className="!text-green-600 py-2 px-4 text-sm font-normal bg-white border border-green-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-center space-x-2 mx-auto"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <span>Assign Members</span>
              </Button>
            </div>
          </div>
        )}

      {/* Action Buttons */}
      <div className="pt-6">
        <div className="flex justify-between items-center">
          <Button
            onClick={onDelete}
            variant="secondary"
            className="!text-red-600 py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </Button>
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="secondary"
              className="!text-black py-4 px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Cancel</span>
            </Button>
            <Button
              onClick={onEdit}
              variant="secondary"
              className="!text-blue-600 py-4 px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Edit</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

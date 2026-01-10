import { Cluster } from "@/src/types/cluster";
import { Person, Family } from "@/src/types/person";
import { formatPersonName } from "@/src/lib/name";
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
  onSubmitReport: () => void;
  onViewPerson?: (person: Person) => void;
  onViewFamily?: (family: Family) => void;
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
  onSubmitReport,
  onViewPerson,
  onViewFamily,
}: ClusterViewProps) {
  // Calculate member and visitor counts
  // Members: role is NOT "ADMIN" and NOT "VISITOR" (includes MEMBER, COORDINATOR, PASTOR, etc.)
  // Visitors: role is "VISITOR"
  // ADMIN is excluded from both counts
  
  // Check if coordinator is already in clusterMembers to avoid double counting
  const coordinatorInMembers = coordinator 
    ? clusterMembers.some(m => m.id === coordinator.id)
    : false;
  
  // Calculate members: all people who are not ADMIN or VISITOR
  const memberCountFromCluster = clusterMembers.filter(
    (member) => member.role !== "ADMIN" && member.role !== "VISITOR"
  ).length;
  
  // Add coordinator to member count only if not already in clusterMembers and is not ADMIN/VISITOR
  const memberCount = memberCountFromCluster + (
    coordinator && !coordinatorInMembers && coordinator.role !== "ADMIN" && coordinator.role !== "VISITOR"
      ? 1
      : 0
  );
  
  // Calculate visitors: all people with VISITOR role
  const visitorCountFromCluster = clusterMembers.filter(
    (member) => member.role === "VISITOR"
  ).length;
  
  // Add coordinator to visitor count only if not already in clusterMembers and is VISITOR
  const visitorCount = visitorCountFromCluster + (
    coordinator && !coordinatorInMembers && coordinator.role === "VISITOR"
      ? 1
      : 0
  );
  
  // Total count includes all non-ADMIN people (members + visitors)
  const totalMemberCount = memberCount + visitorCount;

  const formatFullName = (person: Person) => formatPersonName(person);

  return (
    <div className="flex flex-col h-full space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-gray-900">Cluster Details</h2>
          <p className="text-xs md:text-[11px] text-gray-600 mt-0.5 truncate">
            {cluster.name || "Untitled Cluster"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-600 hover:text-red-700 text-xl font-bold p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
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
        </button>
      </div>

      {/* Content */}
      <div className="p-4 md:p-5 overflow-y-auto flex-1">
        <div className="space-y-4 md:space-y-5">
          {/* Cluster Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                  {cluster.name || "Untitled Cluster"}
                </h2>
                {cluster.code && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium flex-shrink-0">
                    {cluster.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-gray-700 flex-wrap">
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
                  <span className="text-sm font-normal">
                    {memberCount} members
                  </span>
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
                    {formatFullName(coordinator)}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">
                  Members ({totalMemberCount})
                </h3>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    onClick={onAssignMembers}
                    variant="secondary"
                    className="!text-green-600 py-2.5 md:py-2 px-4 text-sm font-normal bg-white border border-green-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
                  <Button
                    onClick={onSubmitReport}
                    variant="secondary"
                    className="!text-blue-600 py-2.5 md:py-2 px-4 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Submit Report</span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* Show coordinator first if exists */}
                {coordinator && (
                  <div
                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                    onClick={() => onViewPerson && onViewPerson(coordinator)}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {coordinator.first_name?.[0] || ""}
                      {coordinator.last_name?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {formatFullName(coordinator)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {coordinator.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800">
                        Coordinator
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
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
                    className="flex items-center space-x-2 p-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                    onClick={() => onViewPerson && onViewPerson(member)}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {member.first_name?.[0] || ""}
                      {member.last_name?.[0] || ""}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {formatFullName(member)}
                      </p>
                      <p className="text-xs text-gray-600">{member.email}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {clusterFamilies.map((family) => (
                  <div
                    key={family.id}
                    className="p-2 bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                    onClick={() => onViewFamily && onViewFamily(family)}
                  >
                    <h4 className="font-medium text-gray-900 text-sm">
                      {family.name}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {family.members.length} members
                    </p>
                    {family.address && (
                      <p className="text-xs text-gray-500 mt-1">
                        {family.address}
                      </p>
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
                  This cluster doesn&rsquo;t have any members or families
                  assigned yet.
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
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 md:p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto sm:order-2">
          <Button
            onClick={onCancel}
            variant="secondary"
            className="!text-black md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
            className="!text-blue-600 md:py-4 px-4 md:px-6 text-sm font-normal bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center space-x-2 min-h-[44px] md:min-h-0 w-full sm:w-auto"
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
        <div className="sm:order-1">
          <div className="border-t border-gray-200 my-2 sm:hidden"></div>
          <Button
            onClick={onDelete}
            variant="secondary"
            className="!text-red-600 md:py-4 px-4 text-sm font-normal bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center justify-center min-h-[44px] md:min-h-0 w-full sm:w-auto"
            aria-label="Delete cluster"
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
        </div>
      </div>
    </div>
  );
}

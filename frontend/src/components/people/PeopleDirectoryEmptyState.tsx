interface PeopleDirectoryEmptyStateProps {
  canChangeBranchFilter: boolean;
  branchName: string | null;
  hasActiveSearchOrFilters: boolean;
  userRole: string | undefined;
  isClusterCoordinator: boolean;
}

export default function PeopleDirectoryEmptyState({
  canChangeBranchFilter,
  branchName,
  hasActiveSearchOrFilters,
  userRole,
  isClusterCoordinator,
}: PeopleDirectoryEmptyStateProps) {
  let title = "No people found";
  let description =
    "No people in your branch are visible to you in the directory. This may be due to your role's access level.";

  if (hasActiveSearchOrFilters) {
    title = "No matching people";
    description =
      "No people match your search or filters. Try clearing filters or broadening your search.";
  } else if (userRole === "MEMBER") {
    title = "Limited directory access";
    description =
      "You can view your profile and family members here. The full directory is not available for your role.";
  } else if (canChangeBranchFilter && branchName) {
    title = `No people in ${branchName}`;
    description =
      "Try another branch or clear the branch filter to see more people.";
  } else if (!canChangeBranchFilter && branchName) {
    description = `No people in ${branchName} are visible to you in the directory. This may be due to your role's access level.`;
  }

  return (
    <div className="text-center py-12 px-4">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">{description}</p>
      {isClusterCoordinator && !hasActiveSearchOrFilters && (
        <p className="mt-3 text-sm text-gray-500 max-w-md mx-auto">
          To manage cluster members, use{" "}
          <a href="/clusters" className="text-primary font-medium hover:underline">
            Clusters
          </a>
          .
        </p>
      )}
    </div>
  );
}

import React, { memo } from "react";
import { Cluster, PersonUI } from "@/src/types/person";
import ActionMenu from "@/src/components/families/ActionMenu";

interface ClusterCardProps {
  cluster: Cluster;
  peopleUI: PersonUI[];
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ClusterCard = memo(
  ({ cluster, peopleUI, onView, onEdit, onDelete }: ClusterCardProps) => {
    // Memoize expensive calculations
    const coordinator = React.useMemo(
      () =>
        peopleUI.find((person) => person.id === (cluster as any).coordinator),
      [peopleUI, cluster]
    );

    const clusterMembers = React.useMemo(
      () =>
        peopleUI.filter((person) =>
          (cluster as any).members?.includes(person.id)
        ),
      [peopleUI, cluster]
    );

    const memberCount = React.useMemo(() => {
      const members = clusterMembers.filter(
        (member) => member.role === "MEMBER"
      );
      return (
        members.length + (coordinator && coordinator.role === "MEMBER" ? 1 : 0)
      );
    }, [clusterMembers, coordinator]);

    const visitorCount = React.useMemo(() => {
      const visitors = clusterMembers.filter(
        (member) => member.role === "VISITOR"
      );
      return (
        visitors.length +
        (coordinator && coordinator.role === "VISITOR" ? 1 : 0)
      );
    }, [clusterMembers, coordinator]);

    const coordinatorName = React.useMemo(() => {
      if (coordinator) {
        return `${coordinator.first_name} ${coordinator.last_name}`;
      }
      if (
        (cluster as any).coordinator?.first_name &&
        (cluster as any).coordinator?.last_name
      ) {
        return `${(cluster as any).coordinator.first_name} ${
          (cluster as any).coordinator.last_name
        }`;
      }
      return "Unknown Coordinator";
    }, [coordinator, cluster]);

    return (
      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-gray-900 truncate">
              {cluster.name || "Untitled Cluster"}
            </h4>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-bold">
                {cluster.code || "—"}
              </span>
            </div>
            {/* Coordinator Name */}
            {(cluster as any).coordinator && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                <svg
                  className="w-3.5 h-3.5 text-gray-500"
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
                <span className="truncate max-w-[12rem]">
                  {coordinatorName}
                </span>
              </div>
            )}
            {/* Location and Meeting Schedule */}
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
              {(cluster as any).location && (
                <span className="inline-flex items-center gap-1 text-gray-600">
                  <svg
                    className="w-3.5 h-3.5 text-gray-500"
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
                  <span className="truncate max-w-[12rem]">
                    {(cluster as any).location}
                  </span>
                </span>
              )}
              {(cluster as any).meeting_schedule && (
                <span className="inline-flex items-center gap-1 text-gray-600">
                  <svg
                    className="w-3.5 h-3.5 text-gray-500"
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
                  <span className="truncate max-w-[12rem]">
                    {(cluster as any).meeting_schedule}
                  </span>
                </span>
              )}
            </div>
          </div>
          {/* Top Right Corner: Counts and Actions */}
          <div className="ml-3 flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-600">
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="text-xs font-medium">{memberCount}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-xs font-medium">{visitorCount}</span>
            </div>
            <ActionMenu
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              labels={{
                view: "View Cluster",
                edit: "Edit Cluster",
                delete: "Delete Cluster",
                title: "Cluster Actions",
              }}
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-700">
          {cluster.description || "No description"}
        </div>
      </div>
    );
  }
);

ClusterCard.displayName = "ClusterCard";

export default ClusterCard;

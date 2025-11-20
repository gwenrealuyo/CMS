"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { EvangelismGroupMember } from "@/src/types/evangelism";

interface GroupMembersSectionProps {
  members: EvangelismGroupMember[];
  onAddMember: () => void;
  onBulkEnroll: () => void;
  onRemoveMember: (member: EvangelismGroupMember) => void;
  loading?: boolean;
}

export default function GroupMembersSection({
  members,
  onAddMember,
  onBulkEnroll,
  onRemoveMember,
  loading = false,
}: GroupMembersSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const displayedMembers = showAll ? members : members.slice(0, DEFAULT_LIMIT);
  const hasMoreMembers = members.length > DEFAULT_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Members</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onBulkEnroll}
            className="!text-green-600 bg-white border border-green-200 hover:bg-green-50 hover:border-green-300"
          >
            Bulk Enroll
          </Button>
          <Button
            onClick={onAddMember}
            className="bg-green-600 hover:bg-green-700"
          >
            Add Member
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No members enrolled
        </div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Name",
                accessor: "person" as keyof EvangelismGroupMember,
                render: (_value, row) => (
                  <span className="text-sm font-medium text-gray-900">
                    {row.person?.full_name || row.person?.username || "N/A"}
                  </span>
                ),
              },
              {
                header: "Role",
                accessor: "role" as keyof EvangelismGroupMember,
                render: (_value, row) => (
                  <span className="text-sm text-gray-700">
                    {row.role_display || row.role}
                  </span>
                ),
              },
              {
                header: "Joined Date",
                accessor: "joined_date" as keyof EvangelismGroupMember,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value
                      ? new Date(value as string).toLocaleDateString()
                      : "N/A"}
                  </span>
                ),
              },
              {
                header: "Status",
                accessor: "is_active" as keyof EvangelismGroupMember,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                header: "Actions",
                accessor: "id" as keyof EvangelismGroupMember,
                render: (_value, row) => (
                  <Button
                    variant="secondary"
                    onClick={() => onRemoveMember(row)}
                    className="!text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 text-xs py-1 px-2"
                  >
                    Remove
                  </Button>
                ),
              },
            ]}
            data={displayedMembers}
          />
          {hasMoreMembers && (
            <div className="flex justify-center pt-2">
              <Button
                variant="tertiary"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                {showAll
                  ? "Show Less"
                  : `Show More (${members.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

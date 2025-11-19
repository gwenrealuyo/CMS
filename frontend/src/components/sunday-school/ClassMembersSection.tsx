"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import StatusBadge from "./StatusBadge";
import BulkEnrollModal from "./BulkEnrollModal";
import { SundaySchoolClass, SundaySchoolClassMember, ClassMemberRole } from "@/src/types/sundaySchool";

interface ClassMembersSectionProps {
  classData: SundaySchoolClass;
  onAddMember?: (personId: number, role: ClassMemberRole) => Promise<void>;
  onRemoveMember?: (memberId: number) => Promise<void>;
  onBulkEnroll?: (personIds: number[], role: ClassMemberRole) => Promise<void>;
}

export default function ClassMembersSection({
  classData,
  onAddMember,
  onRemoveMember,
  onBulkEnroll,
}: ClassMembersSectionProps) {
  const [isBulkEnrollOpen, setIsBulkEnrollOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const members = classData.members || [];
  const teachers = members.filter((m) => m.role === "TEACHER" || m.role === "ASSISTANT_TEACHER");
  const students = members.filter((m) => m.role === "STUDENT");

  const handleBulkEnroll = async (personIds: number[], role: ClassMemberRole) => {
    if (onBulkEnroll) {
      setIsSubmitting(true);
      try {
        await onBulkEnroll(personIds, role);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "TEACHER":
        return "bg-blue-100 text-blue-800";
      case "ASSISTANT_TEACHER":
        return "bg-purple-100 text-purple-800";
      case "STUDENT":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const memberColumns = [
    {
      header: "Name",
      accessor: "person" as const,
      render: (_value: any, row: SundaySchoolClassMember) => (
        <div>
          <p className="font-medium text-gray-900">
            {row.person.full_name || `${row.person.first_name || ""} ${row.person.last_name || ""}`.trim() || row.person.username}
          </p>
          {row.person.email && (
            <p className="text-xs text-gray-500">{row.person.email}</p>
          )}
        </div>
      ),
    },
    {
      header: "Role",
      accessor: "role" as const,
      render: (_value: any, row: SundaySchoolClassMember) => (
        <StatusBadge
          label={row.role_display || row.role}
          colorClass={getRoleBadgeColor(row.role)}
        />
      ),
    },
    {
      header: "Enrolled",
      accessor: "enrolled_date" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-600">
          {new Date(value).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "is_active" as const,
      render: (value: boolean) => (
        <StatusBadge
          label={value ? "Active" : "Inactive"}
          colorClass={value ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
        />
      ),
    },
    {
      header: "Actions",
      accessor: "id" as const,
      render: (_value: any, row: SundaySchoolClassMember) => (
        onRemoveMember && (
          <Button
            variant="tertiary"
            onClick={() => onRemoveMember(row.id)}
            className="text-xs !px-2 !py-1 text-red-600 hover:text-red-800"
          >
            Remove
          </Button>
        )
      ),
    },
  ];

  return (
    <>
      <Card
        title="Class Members"
        headerAction={
          onBulkEnroll && (
            <Button onClick={() => setIsBulkEnrollOpen(true)} className="text-sm">
              Bulk Enroll
            </Button>
          )
        }
      >
        <div className="space-y-6">
          <div className="flex gap-4">
            <StatusBadge
              label="Teachers"
              count={teachers.length}
              colorClass="bg-blue-100 text-blue-800"
            />
            <StatusBadge
              label="Students"
              count={students.length}
              colorClass="bg-green-100 text-green-800"
            />
            <StatusBadge
              label="Total"
              count={members.length}
              colorClass="bg-gray-100 text-gray-800"
            />
          </div>

          {members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No members enrolled yet.</p>
              {onBulkEnroll && (
                <Button
                  variant="primary"
                  onClick={() => setIsBulkEnrollOpen(true)}
                  className="mt-4"
                >
                  Enroll Members
                </Button>
              )}
            </div>
          ) : (
            <Table data={members} columns={memberColumns} />
          )}
        </div>
      </Card>

      {onBulkEnroll && (
        <BulkEnrollModal
          isOpen={isBulkEnrollOpen}
          onClose={() => setIsBulkEnrollOpen(false)}
          onEnroll={handleBulkEnroll}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}


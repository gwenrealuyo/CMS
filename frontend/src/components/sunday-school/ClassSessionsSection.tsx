"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Card from "@/src/components/ui/Card";
import Table from "@/src/components/ui/Table";
import { SundaySchoolClass, SundaySchoolSession } from "@/src/types/sundaySchool";

interface ClassSessionsSectionProps {
  classData: SundaySchoolClass;
  sessions: SundaySchoolSession[];
  loading?: boolean;
  onCreateSession?: () => void;
  onCreateRecurring?: () => void;
  onViewSession?: (session: SundaySchoolSession) => void;
  onEditSession?: (session: SundaySchoolSession) => void;
  onViewAttendance?: (session: SundaySchoolSession) => void;
}

export default function ClassSessionsSection({
  classData,
  sessions,
  loading = false,
  onCreateSession,
  onCreateRecurring,
  onViewSession,
  onEditSession,
  onViewAttendance,
}: ClassSessionsSectionProps) {
  const sessionColumns = [
    {
      header: "Date",
      accessor: "session_date" as const,
      render: (value: string) => (
        <span className="text-sm font-medium text-gray-900">
          {new Date(value).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Time",
      accessor: "session_time" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-600">
          {value ? new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
        </span>
      ),
    },
    {
      header: "Lesson",
      accessor: "lesson_title" as const,
      render: (value: string) => (
        <span className="text-sm text-gray-700">{value || "—"}</span>
      ),
    },
    {
      header: "Event",
      accessor: "event_id" as const,
      render: (_value: any, row: SundaySchoolSession) => (
        row.event_id ? (
          <a
            href={`/events?event=${row.event_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Event
          </a>
        ) : (
          <span className="text-sm text-gray-400">No event</span>
        )
      ),
    },
    {
      header: "Actions",
      accessor: "id" as const,
      render: (_value: any, row: SundaySchoolSession) => (
        <div className="flex gap-2">
          {onEditSession && (
            <Button
              variant="tertiary"
              onClick={() => onEditSession(row)}
              className="text-xs !px-2 !py-1 !text-blue-600 !border-blue-200 hover:!bg-blue-50 hover:!border-blue-300"
            >
              Edit
            </Button>
          )}
          {onViewSession && (
            <Button
              variant="tertiary"
              onClick={() => onViewSession(row)}
              className="text-xs !px-2 !py-1 !text-green-600 !border-green-200 hover:!bg-green-50 hover:!border-green-300"
            >
              View
            </Button>
          )}
          {onViewAttendance && row.event_id && (
            <Button
              variant="tertiary"
              onClick={() => onViewAttendance(row)}
              className="text-xs !px-2 !py-1 !text-purple-600 !border-purple-200 hover:!bg-purple-50 hover:!border-purple-300"
            >
              Attendance
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Sessions"
      headerAction={
        <div className="flex gap-2">
          {onCreateRecurring && (
            <Button onClick={onCreateRecurring} variant="secondary" className="text-sm">
              Create Recurring
            </Button>
          )}
          {onCreateSession && (
            <Button onClick={onCreateSession} variant="primary" className="text-sm">
              Add Session
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No sessions scheduled yet.</p>
          {onCreateSession && (
            <Button onClick={onCreateSession} variant="primary" className="mt-4">
              Create First Session
            </Button>
          )}
        </div>
      ) : (
        <Table data={sessions} columns={sessionColumns} />
      )}
    </Card>
  );
}


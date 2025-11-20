"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import Table from "@/src/components/ui/Table";
import { EvangelismSession } from "@/src/types/evangelism";

interface GroupSessionsSectionProps {
  sessions: EvangelismSession[];
  onAddSession: () => void;
  onCreateRecurring: () => void;
  onViewSession: (session: EvangelismSession) => void;
  onEditSession: (session: EvangelismSession) => void;
  loading?: boolean;
}

export default function GroupSessionsSection({
  sessions,
  onAddSession,
  onCreateRecurring,
  onViewSession,
  onEditSession,
  loading = false,
}: GroupSessionsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const DEFAULT_LIMIT = 5;

  const formatTime = (time?: string) => {
    if (!time) return "N/A";
    const [hours, minutes] = time.split(":");
    const date = new Date(`2000-01-01T${hours}:${minutes}`);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const displayedSessions = showAll ? sessions : sessions.slice(0, DEFAULT_LIMIT);
  const hasMoreSessions = sessions.length > DEFAULT_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={onCreateRecurring}
            className="!text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
          >
            Create Recurring
          </Button>
          <Button 
            onClick={onAddSession}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Add Session
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No sessions scheduled</div>
      ) : (
        <>
          <Table
            columns={[
              {
                header: "Date",
                accessor: "session_date" as keyof EvangelismSession,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value ? new Date(value as string).toLocaleDateString() : "N/A"}
                  </span>
                ),
              },
              {
                header: "Time",
                accessor: "session_time" as keyof EvangelismSession,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {formatTime(value as string)}
                  </span>
                ),
              },
              {
                header: "Topic",
                accessor: "topic" as keyof EvangelismSession,
                render: (value) => (
                  <span className="text-sm text-gray-700">
                    {value || "N/A"}
                  </span>
                ),
              },
              {
                header: "Event",
                accessor: "event_id" as keyof EvangelismSession,
                render: (value, row) => (
                  value ? (
                    <a
                      href={`/events?event=${value}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Event
                    </a>
                  ) : (
                    <span className="text-sm text-gray-700">N/A</span>
                  )
                ),
              },
              {
                header: "Actions",
                accessor: "id" as keyof EvangelismSession,
                render: (_value, row) => (
                  <div className="flex gap-1.5">
                    <Button 
                      variant="secondary" 
                      onClick={() => onViewSession(row)}
                      className="!text-cyan-600 bg-white border border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 text-xs py-1 px-2"
                    >
                      View
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => onEditSession(row)}
                      className="!text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-xs py-1 px-2"
                    >
                      Edit
                    </Button>
                  </div>
                ),
              },
            ]}
            data={displayedSessions}
          />
          {hasMoreSessions && (
            <div className="flex justify-center pt-2">
              <Button
                variant="tertiary"
                onClick={() => setShowAll(!showAll)}
                className="text-sm"
              >
                {showAll ? "Show Less" : `Show More (${sessions.length - DEFAULT_LIMIT} more)`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


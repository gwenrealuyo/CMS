"use client";

import { EvangelismWeeklyReport } from "@/src/types/evangelism";
import { formatPersonName } from "@/src/lib/name";
import Button from "@/src/components/ui/Button";
import Modal from "@/src/components/ui/Modal";

interface ViewEvangelismWeeklyReportModalProps {
  report: EvangelismWeeklyReport | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ViewEvangelismWeeklyReportModal({
  report,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ViewEvangelismWeeklyReportModalProps) {
  if (!report) return null;

  const getGatheringTypeColor = (type?: string) => {
    switch (type) {
      case "PHYSICAL":
        return "bg-green-100 text-green-800";
      case "ONLINE":
        return "bg-blue-100 text-blue-800";
      case "HYBRID":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const membersDetails = report.members_attended_details ?? [];
  const visitorsDetails = report.visitors_attended_details ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Weekly report details">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-gray-500">Group</p>
            <p className="font-medium">{report.evangelism_group?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Week</p>
            <p className="font-medium">
              {report.year} W{report.week_number}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Meeting date</p>
            <p className="font-medium">
              {report.meeting_date
                ? new Date(report.meeting_date).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Gathering</p>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getGatheringTypeColor(
                report.gathering_type
              )}`}
            >
              {report.gathering_type || "—"}
            </span>
          </div>
        </div>

        {report.topic ? (
          <div>
            <p className="text-sm text-gray-500 mb-1">Topic</p>
            <p className="text-sm">{report.topic}</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">
              Members ({membersDetails.length})
            </p>
            <ul className="text-sm text-gray-700 space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-md p-2">
              {membersDetails.length === 0 ? (
                <li className="text-gray-500">None</li>
              ) : (
                membersDetails.map((p) => (
                  <li key={p.id}>
                    {formatPersonName(p) || p.username || `ID ${p.id}`}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">
              Visitors ({visitorsDetails.length})
            </p>
            <ul className="text-sm text-gray-700 space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-md p-2">
              {visitorsDetails.length === 0 ? (
                <li className="text-gray-500">None</li>
              ) : (
                visitorsDetails.map((p) => (
                  <li key={p.id}>
                    {formatPersonName(p) || p.username || `ID ${p.id}`}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {report.activities_held ? (
          <div>
            <p className="text-sm text-gray-500 mb-1">Activities</p>
            <p className="text-sm whitespace-pre-wrap">{report.activities_held}</p>
          </div>
        ) : null}
        {report.prayer_requests ? (
          <div>
            <p className="text-sm text-gray-500 mb-1">Prayer requests</p>
            <p className="text-sm whitespace-pre-wrap">{report.prayer_requests}</p>
          </div>
        ) : null}
        {report.testimonies ? (
          <div>
            <p className="text-sm text-gray-500 mb-1">Testimonies</p>
            <p className="text-sm whitespace-pre-wrap">{report.testimonies}</p>
          </div>
        ) : null}
        {report.notes ? (
          <div>
            <p className="text-sm text-gray-500 mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            className="!text-red-600 border-red-200 hover:bg-red-50"
            variant="secondary"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

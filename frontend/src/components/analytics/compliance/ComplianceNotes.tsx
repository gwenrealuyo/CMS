"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import { reportsApi } from "@/src/lib/api";
import type { ComplianceNote } from "@/src/types/cluster";

interface ComplianceNotesProps {
  notes: ComplianceNote[];
  /** Clusters the user may attach a note to (already branch-scoped). */
  clusterOptions: { id: number; label: string }[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  loading?: boolean;
  onNoteAdded: () => void;
}

export default function ComplianceNotes({
  notes,
  clusterOptions,
  defaultPeriodStart,
  defaultPeriodEnd,
  loading = false,
  onNoteAdded,
}: ComplianceNotesProps) {
  const [clusterId, setClusterId] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!clusterId || !noteText.trim()) {
      toast.error("Pick a cluster and enter a note.");
      return;
    }
    try {
      setSubmitting(true);
      await reportsApi.addComplianceNote({
        cluster_id: Number(clusterId),
        note: noteText.trim(),
        period_start: defaultPeriodStart,
        period_end: defaultPeriodEnd,
      });
      setNoteText("");
      setClusterId("");
      toast.success("Note added.");
      onNoteAdded();
    } catch (err) {
      console.error("Failed to add compliance note", err);
      toast.error("Failed to add note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Compliance Notes">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr_auto] md:items-start">
          <select
            value={clusterId}
            onChange={(e) => setClusterId(e.target.value)}
            className="h-11 rounded-md border border-gray-300 px-3 text-sm"
          >
            <option value="" disabled hidden>Select cluster...</option>
            {clusterOptions.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note for the current period..."
            rows={2}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Adding..." : "Add Note"}
          </Button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No compliance notes yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((note) => (
              <li key={note.id} className="py-3">
                <p className="text-sm text-foreground">{note.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.created_by
                    ? `${note.created_by.first_name} ${note.created_by.last_name}`
                    : "Unknown"}
                  {" - "}
                  {new Date(note.created_at).toLocaleDateString()}
                  {note.period_start && note.period_end
                    ? ` (${note.period_start} to ${note.period_end})`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

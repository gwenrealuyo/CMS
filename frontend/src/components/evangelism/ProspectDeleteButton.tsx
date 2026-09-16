"use client";

import { useState } from "react";
import Button from "@/src/components/ui/Button";
import ConfirmationModal from "@/src/components/ui/ConfirmationModal";
import { prospectDisplayName } from "@/src/lib/prospectDisplay";
import { Prospect } from "@/src/types/evangelism";

export default function ProspectDeleteButton({
  prospect,
  onDelete,
  compact = false,
}: {
  prospect: Prospect;
  onDelete: (prospect: Prospect) => Promise<void> | void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = prospectDisplayName(prospect);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onDelete(prospect);
      setOpen(false);
    } catch {
      setError("Failed to delete prospect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="tertiary"
        className={
          compact
            ? "min-h-[44px] border border-red-200 bg-white px-2 py-1 text-xs !text-red-600 hover:border-red-300 hover:bg-red-50 md:min-h-0"
            : "min-h-[40px] px-3 text-xs !text-red-600 hover:!bg-red-50"
        }
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={`Delete ${name}`}
      >
        Delete
      </Button>
      <ConfirmationModal
        isOpen={open}
        onClose={() => {
          if (loading) return;
          setOpen(false);
          setError(null);
        }}
        onConfirm={() => void handleConfirm()}
        title="Delete Prospect Permanently"
        message={
          <>
            Are you sure you want to permanently delete{" "}
            <strong className="font-semibold text-gray-900">{name}</strong>? This
            action cannot be undone. A linked People profile, if any, will not
            be deleted.
            {error ? (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : null}
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
        zIndex={80}
      />
    </>
  );
}

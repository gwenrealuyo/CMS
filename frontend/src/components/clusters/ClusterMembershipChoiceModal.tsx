"use client";

import React from "react";
import Button from "@/src/components/ui/Button";
import ModalOverlay from "@/src/components/ui/ModalOverlay";

export type ClusterMembershipChoice = "add" | "transfer";

interface ClusterMembershipChoiceModalProps {
  isOpen: boolean;
  personName: string;
  otherClusterLabels: string;
  /** Transfer only when the person is in exactly one other cluster. */
  allowTransfer?: boolean;
  onClose: () => void;
  onChoose: (choice: ClusterMembershipChoice) => void;
  zIndex?: 70 | 80;
}

export default function ClusterMembershipChoiceModal({
  isOpen,
  personName,
  otherClusterLabels,
  allowTransfer = true,
  onClose,
  onChoose,
  zIndex = 80,
}: ClusterMembershipChoiceModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      zIndex={zIndex}
      panelClassName="relative w-full max-w-md"
    >
      <div className="rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          Already in another cluster
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          <strong className="font-semibold text-gray-900">{personName}</strong>{" "}
          belongs to{" "}
          <strong className="font-semibold text-gray-900">
            {otherClusterLabels}
          </strong>
          . How should they join this cluster?
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => onChoose("add")}
            className="w-full min-h-[44px]"
          >
            Add to this cluster too
          </Button>
          {allowTransfer && (
            <button
              type="button"
              onClick={() => onChoose("transfer")}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-md font-medium transition-colors duration-200 flex items-center justify-center bg-amber-600 text-white hover:bg-amber-700"
            >
              Transfer here
            </button>
          )}
          <Button
            type="button"
            variant="tertiary"
            onClick={onClose}
            className="w-full min-h-[44px]"
          >
            Cancel
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {allowTransfer
            ? "Transfer removes them from their other active cluster. Add keeps them in both."
            : "They are in more than one other cluster. Add keeps all memberships. To move them here only, remove them from the other clusters first, then add them here."}
        </p>
      </div>
    </ModalOverlay>
  );
}

"use client";

import React from "react";
import Button from "@/src/components/ui/Button";
import ModalOverlay from "@/src/components/ui/ModalOverlay";

/** Dual Add only — real moves use the approved transfer-request workflow. */
export type ClusterMembershipChoice = "add";

interface ClusterMembershipChoiceModalProps {
  isOpen: boolean;
  personName: string;
  otherClusterLabels: string;
  /** @deprecated Transfer is no longer immediate; kept for call-site compat. */
  allowTransfer?: boolean;
  onClose: () => void;
  onChoose: (choice: ClusterMembershipChoice) => void;
  onRequestTransfer?: () => void;
  zIndex?: 70 | 80;
}

export default function ClusterMembershipChoiceModal({
  isOpen,
  personName,
  otherClusterLabels,
  onClose,
  onChoose,
  onRequestTransfer,
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
          . Add them here as well (dual membership), or request a transfer for
          approval.
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
          {onRequestTransfer && (
            <button
              type="button"
              onClick={onRequestTransfer}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-md font-medium transition-colors duration-200 flex items-center justify-center bg-amber-600 text-white hover:bg-amber-700"
            >
              Request transfer instead…
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
          Add keeps them in both clusters. A transfer leaves their other
          cluster and must be approved by Cluster Senior, Pastor, Admin, or
          Cluster Committee.
        </p>
      </div>
    </ModalOverlay>
  );
}

"use client";

import LessonPdfResourceCard from "@/src/components/lessons/LessonPdfResourceCard";
import { LessonCommitmentSettings } from "@/src/types/lesson";

interface CommitmentFormSectionProps {
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  onOpenModal: () => void;
  canManageCommitmentForm?: boolean;
}

export default function CommitmentFormSection({
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  onOpenModal,
  canManageCommitmentForm = false,
}: CommitmentFormSectionProps) {
  return (
    <LessonPdfResourceCard
      title="Commitment Forms"
      description="Share and update the latest commitment form for teachers to view, download, and mark participants as signed."
      fileUrl={
        commitmentSettings?.commitment_form_url ||
        commitmentSettings?.commitment_form
      }
      uploadedAt={commitmentSettings?.updated_at}
      loading={commitmentLoading}
      error={commitmentError}
      onOpenModal={onOpenModal}
      canManage={canManageCommitmentForm}
      fallbackFileName="commitment-form"
      viewLabel="View Form"
      downloadLabel="Download Form"
      replaceLabel="Replace Commitment Form"
      uploadLabel="Upload Commitment Form"
      emptyLabel="No commitment form uploaded yet."
    />
  );
}

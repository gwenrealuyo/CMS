"use client";

import LessonPdfResourceCard from "@/src/components/lessons/LessonPdfResourceCard";
import { LessonCommitmentSettings } from "@/src/types/lesson";

interface NccLessonsPdfSectionProps {
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  onOpenModal: () => void;
  canManageNccLessonsPdf?: boolean;
}

export default function NccLessonsPdfSection({
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  onOpenModal,
  canManageNccLessonsPdf = false,
}: NccLessonsPdfSectionProps) {
  return (
    <LessonPdfResourceCard
      title="NCC Lessons PDF"
      description="View and download the printable New Converts Course booklet. Catalog managers can upload or replace the latest PDF."
      fileUrl={
        commitmentSettings?.ncc_lessons_pdf_url ||
        commitmentSettings?.ncc_lessons_pdf
      }
      uploadedAt={commitmentSettings?.ncc_lessons_pdf_updated_at}
      loading={commitmentLoading}
      error={commitmentError}
      onOpenModal={onOpenModal}
      canManage={canManageNccLessonsPdf}
      fallbackFileName="ncc-lessons"
      viewLabel="View Booklet"
      downloadLabel="Download Booklet"
      replaceLabel="Replace NCC Lessons PDF"
      uploadLabel="Upload NCC Lessons PDF"
      emptyLabel="No NCC lessons booklet uploaded yet."
    />
  );
}

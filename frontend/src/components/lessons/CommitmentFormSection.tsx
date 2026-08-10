"use client";

import { useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import { LessonCommitmentSettings } from "@/src/types/lesson";

interface CommitmentFormSectionProps {
  commitmentSettings: LessonCommitmentSettings | null;
  commitmentLoading: boolean;
  commitmentError: string | null;
  onOpenModal: () => void;
}

export default function CommitmentFormSection({
  commitmentSettings,
  commitmentLoading,
  commitmentError,
  onOpenModal,
}: CommitmentFormSectionProps) {
  const [downloading, setDownloading] = useState(false);
  const commitmentUrl = commitmentSettings?.commitment_form_url ?? "";
  const hasCommitmentForm = Boolean(commitmentUrl && !commitmentLoading);
  const uploadedAt = commitmentSettings?.updated_at
    ? new Date(commitmentSettings.updated_at).toLocaleString()
    : null;
  const fileName = commitmentUrl
    ? decodeURIComponent(commitmentUrl.split("/").pop() || "commitment-form")
    : "commitment-form";

  const handleDownload = async () => {
    if (!commitmentUrl || downloading) return;
    setDownloading(true);
    try {
      // `download` on <a> is ignored for cross-origin URLs (frontend ≠ API host),
      // so fetch the file and trigger a same-origin blob download instead.
      const response = await fetch(commitmentUrl);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open the PDF if blob download is blocked (e.g. CORS).
      window.open(commitmentUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card title="Commitment Forms">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Share and update the latest commitment form for teachers to view,
          download,
          and mark participants as signed.
        </p>

        {commitmentError && <ErrorMessage message={commitmentError} />}

        {commitmentLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-3">
            {hasCommitmentForm ? (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <p className="font-medium text-gray-700">{fileName}</p>
                  {uploadedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {uploadedAt}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                    onClick={() =>
                      window.open(commitmentUrl, "_blank", "noopener,noreferrer")
                    }
                  >
                    View Form
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? "Downloading…" : "Download Form"}
                  </Button>
                  <Button
                    onClick={onOpenModal}
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                  >
                    Replace Commitment Form
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-500">
                  No commitment form uploaded yet.
                </span>
                <Button
                  onClick={onOpenModal}
                  className="w-full sm:w-auto min-h-[44px] text-sm"
                >
                  Upload Commitment Form
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

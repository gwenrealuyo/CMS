"use client";

import { useState } from "react";
import Card from "@/src/components/ui/Card";
import Button from "@/src/components/ui/Button";
import ErrorMessage from "@/src/components/ui/ErrorMessage";
import LoadingSpinner from "@/src/components/ui/LoadingSpinner";
import {
  downloadLessonMediaFile,
  resolveLessonMediaUrl,
} from "@/src/lib/lessonsUtils";

interface LessonPdfResourceCardProps {
  title: string;
  description: string;
  fileUrl: string | null | undefined;
  uploadedAt: string | null | undefined;
  loading: boolean;
  error: string | null;
  onOpenModal: () => void;
  canManage?: boolean;
  fallbackFileName: string;
  viewLabel: string;
  downloadLabel: string;
  replaceLabel: string;
  uploadLabel: string;
  emptyLabel: string;
}

const secondaryLinkClassName =
  "px-4 py-2.5 md:py-2 rounded-md font-medium transition-colors duration-200 min-h-[44px] md:min-h-0 flex items-center justify-center bg-[#4A5568] text-white hover:bg-[#2D3748] w-full sm:w-auto text-sm";

export default function LessonPdfResourceCard({
  title,
  description,
  fileUrl,
  uploadedAt,
  loading,
  error,
  onOpenModal,
  canManage = false,
  fallbackFileName,
  viewLabel,
  downloadLabel,
  replaceLabel,
  uploadLabel,
  emptyLabel,
}: LessonPdfResourceCardProps) {
  const [downloading, setDownloading] = useState(false);
  const resolvedUrl = resolveLessonMediaUrl(fileUrl);
  const hasFile = Boolean(resolvedUrl && !loading);
  const formattedUploadedAt = uploadedAt
    ? new Date(uploadedAt).toLocaleString()
    : null;
  const fileName = resolvedUrl
    ? decodeURIComponent(resolvedUrl.split("/").pop() || fallbackFileName)
    : fallbackFileName;

  const handleDownload = async () => {
    if (!resolvedUrl || downloading) return;
    setDownloading(true);
    try {
      await downloadLessonMediaFile(resolvedUrl, fileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card title={title}>
      <div className="space-y-5">
        <p className="text-sm text-gray-500">{description}</p>

        {error && <ErrorMessage message={error} />}

        {loading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-3">
            {hasFile ? (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <p className="font-medium text-gray-700">{fileName}</p>
                  {formattedUploadedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {formattedUploadedAt}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={secondaryLinkClassName}
                  >
                    {viewLabel}
                  </a>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? "Downloading…" : downloadLabel}
                  </Button>
                  {canManage && (
                    <Button
                      onClick={onOpenModal}
                      className="w-full sm:w-auto min-h-[44px] text-sm"
                    >
                      {replaceLabel}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-500">{emptyLabel}</span>
                {canManage && (
                  <Button
                    onClick={onOpenModal}
                    className="w-full sm:w-auto min-h-[44px] text-sm"
                  >
                    {uploadLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

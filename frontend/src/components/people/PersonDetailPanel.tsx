"use client";

import { useEffect, type ReactNode } from "react";

interface PersonDetailPanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onExpand?: () => void;
  children: ReactNode;
}

export default function PersonDetailPanel({
  isOpen,
  title,
  onClose,
  onExpand,
  children,
}: PersonDetailPanelProps) {
  if (!isOpen) {
    return null;
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      className="hidden lg:flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm sticky top-24 h-[calc(100vh-11rem)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-0.5">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label="Expand"
              title="Expand"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close person detail panel"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

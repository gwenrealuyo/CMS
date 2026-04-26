"use client";

import { useEffect, type ReactNode } from "react";

interface PersonDetailPanelProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function PersonDetailPanel({
  isOpen,
  title,
  onClose,
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close person detail panel"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

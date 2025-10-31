"use client";
import React, { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  hideHeader = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling on the background
      document.body.style.overflow = "hidden";
    } else {
      // Restore scrolling when modal is closed
      document.body.style.overflow = "unset";
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className} !mt-0`}
    >
      <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {!hideHeader && (
          <div className="p-6 pb-0 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[#2D3748]">{title}</h2>
              <button
                onClick={onClose}
                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div
          className={`flex-1 overflow-y-auto ${hideHeader ? "" : "p-6 pt-0"}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

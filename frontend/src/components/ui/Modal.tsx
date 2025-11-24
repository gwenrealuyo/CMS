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
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className} !mt-0 p-0 md:p-4`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-none md:rounded-lg max-w-3xl w-full h-full md:h-auto md:max-h-[95vh] md:mx-4 overflow-hidden flex flex-col">
        {!hideHeader && (
          <div className="p-4 md:py-2 md:px-6 pb-0 flex-shrink-0 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4 md:mb-0">
              <h2 className="text-lg font-semibold text-[#2D3748]">{title}</h2>
              <button
                onClick={onClose}
                className="text-red-500 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close modal"
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
          className={`flex-1 overflow-y-auto ${
            hideHeader ? "p-4 md:p-0 pt-0" : "p-4 md:p-6"
          }`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

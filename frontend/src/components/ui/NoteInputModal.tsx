"use client";

import React, { useState, useEffect, useRef } from "react";
import Button from "./Button";
import ModalOverlay from "./ModalOverlay";

interface NoteInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  title?: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export default function NoteInputModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Add Note",
  message,
  initialValue = "",
  placeholder = "Enter note...",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
}: NoteInputModalProps) {
  const [note, setNote] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNote(initialValue);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    onConfirm(note);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleConfirm();
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="relative w-full max-w-lg"
    >
      <div
        className="rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
        aria-describedby={message ? "note-modal-description" : undefined}
      >
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
              <h3
                id="note-modal-title"
                className="mb-2 text-lg font-medium leading-6 text-gray-900"
              >
                {title}
              </h3>
              {message && (
                <p
                  id="note-modal-description"
                  className="mb-4 text-sm text-gray-500"
                >
                  {message}
                </p>
              )}
              <textarea
                ref={textareaRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Note input"
                disabled={loading}
              />
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full sm:ml-3 sm:w-auto"
          >
            {loading ? "Processing..." : confirmText}
          </Button>
          <Button
            variant="tertiary"
            onClick={onClose}
            disabled={loading}
            className="mt-3 w-full sm:mt-0 sm:w-auto"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}

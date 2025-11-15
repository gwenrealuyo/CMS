import React, { useState, useEffect, useRef } from "react";
import Button from "./Button";

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
      // Focus textarea when modal opens
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
    // Allow Ctrl/Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
      aria-describedby={message ? "note-modal-description" : undefined}
    >
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3
                id="note-modal-title"
                className="text-lg leading-6 font-medium text-gray-900 mb-2"
              >
                {title}
              </h3>
              {message && (
                <p
                  id="note-modal-description"
                  className="text-sm text-gray-500 mb-4"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Note input"
                disabled={loading}
              />
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full sm:w-auto sm:ml-3"
          >
            {loading ? "Processing..." : confirmText}
          </Button>
          <Button
            variant="tertiary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto mt-3 sm:mt-0"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
}

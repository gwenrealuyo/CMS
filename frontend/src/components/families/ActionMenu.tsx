import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface ActionMenuProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** When false, only the View action is shown (e.g. read-only cluster browse). Default true. */
  showEditDelete?: boolean;
  labels?: {
    view: string;
    edit: string;
    delete: string;
    title: string;
  };
}

export default function ActionMenu({
  onView,
  onEdit,
  onDelete,
  showEditDelete = true,
  labels = {
    view: "View Family",
    edit: "Edit Family",
    delete: "Delete Family",
    title: "Family Actions",
  },
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = showEditDelete ? 168 : 56;
      const dropdownWidth = 192;

      const minTop = 8;
      const maxTop = Math.max(minTop, viewportHeight - dropdownHeight - 8);
      const proposedTop = buttonRect.bottom + 4;
      const top = Math.max(minTop, Math.min(maxTop, proposedTop));

      const proposedLeft = buttonRect.right - dropdownWidth;
      const minLeft = 8;
      const maxLeft = viewportWidth - dropdownWidth - 8;
      const left = Math.max(minLeft, Math.min(maxLeft, proposedLeft));

      setCoords({ top, left });
    } else if (!isOpen) {
      setCoords(null);
    }
  }, [isOpen, showEditDelete]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideButton = menuRef.current?.contains(target);
      const clickedInsidePortal = portalMenuRef.current?.contains(target);

      if (!clickedInsideButton && !clickedInsidePortal) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title={labels.title}
        type="button"
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
            d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      </button>

      {isOpen &&
        mounted &&
        coords &&
        ReactDOM.createPortal(
          <div
            ref={portalMenuRef}
            className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          >
            <button
              onClick={() => handleAction(onView)}
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
              type="button"
            >
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>{labels.view}</span>
            </button>

            {showEditDelete && (
              <>
                <button
                  onClick={() => handleAction(onEdit)}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                  type="button"
                >
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span>{labels.edit}</span>
                </button>

                <div className="border-t border-gray-100 my-1"></div>

                <button
                  onClick={() => handleAction(onDelete)}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-3"
                  type="button"
                >
                  <svg
                    className="w-4 h-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span>{labels.delete}</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

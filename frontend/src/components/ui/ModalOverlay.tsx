"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalOverlayProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  zIndex?: 70 | 80;
  className?: string;
  panelClassName?: string;
}

export default function ModalOverlay({
  isOpen,
  onClose,
  children,
  zIndex = 70,
  className = "",
  panelClassName = "",
}: ModalOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const zClass = zIndex === 80 ? "z-[80]" : "z-[70]";

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/50 p-4 !mt-0 ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className={panelClassName || "relative w-full max-w-lg"}>
        {children}
      </div>
    </div>,
    document.body
  );
}

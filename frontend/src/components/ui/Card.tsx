import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  headerAction?: ReactNode;
}

export default function Card({ children, title, headerAction }: CardProps) {
  const showHeader = Boolean(title || headerAction);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {showHeader && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h3 className="text-xl font-semibold text-[#2D3748]">{title}</h3>
          )}
          {headerAction && (
            <div className="flex items-center gap-3">{headerAction}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

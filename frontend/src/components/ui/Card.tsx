import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  headerAction?: ReactNode;
  className?: string;
}

export default function Card({
  children,
  title,
  headerAction,
  className,
}: CardProps) {
  const showHeader = Boolean(title || headerAction);

  return (
    <div
      className={`bg-card rounded-lg card-shadow border border-border p-4 md:p-6 ${className || ""}`}
    >
      {showHeader && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <h3 className="text-lg md:text-xl font-semibold text-foreground">
              {title}
            </h3>
          )}
          {headerAction && (
            <div className="flex w-full sm:w-auto items-center gap-3">{headerAction}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

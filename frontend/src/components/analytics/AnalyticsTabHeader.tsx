"use client";

import type { ReactNode } from "react";

interface AnalyticsTabHeaderProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

/** Page title and blurb for the active analytics tab. */
export default function AnalyticsTabHeader({
  title,
  description,
  icon,
}: AnalyticsTabHeaderProps) {
  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        {icon && <div className="shrink-0">{icon}</div>}
        <h2 className="min-w-0 text-xl font-semibold text-foreground md:text-2xl">
          {title}
        </h2>
      </div>
      <p className="mt-1 max-w-3xl text-base text-foreground/70">
        {description}
      </p>
    </div>
  );
}

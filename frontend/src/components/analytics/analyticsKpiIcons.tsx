"use client";

import type { ReactNode } from "react";

const KPI_ICON_CLASS = "h-6 w-6 shrink-0 text-primary/70";

export function kpiIcon(
  Icon: React.ComponentType<{ className?: string }>,
): ReactNode {
  return <Icon className={KPI_ICON_CLASS} aria-hidden />;
}

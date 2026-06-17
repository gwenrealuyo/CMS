"use client";

import type { ReactNode } from "react";
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  MegaphoneIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import type { AnalyticsTab } from "@/src/app/analytics/analyticsTabs";
import { ANALYTICS_MODULE_ACCENTS } from "@/src/lib/analyticsTheme";

const MODULE_ICON_MAP: Record<
  AnalyticsTab,
  React.ComponentType<{ className?: string }>
> = {
  overview: DocumentChartBarIcon,
  people: UserGroupIcon,
  v2b: MegaphoneIcon,
  e1r1: UserPlusIcon,
  engagement: ClipboardDocumentCheckIcon,
  ncc: BookOpenIcon,
  cym: AcademicCapIcon,
  compliance: ClipboardDocumentCheckIcon,
  stewardship: CurrencyDollarIcon,
  builder: Squares2X2Icon,
};

const ICON_CLASS = "h-6 w-6 shrink-0 text-primary/70";

export function getModuleIcon(tab: AnalyticsTab): ReactNode {
  const Icon = MODULE_ICON_MAP[tab];
  return <Icon className={ICON_CLASS} aria-hidden />;
}

export function getModuleAccentClass(tab: AnalyticsTab): string {
  return ANALYTICS_MODULE_ACCENTS[tab] ?? "border-l-primary";
}

"use client";

import { ChartBarSquareIcon } from "@heroicons/react/24/outline";
import Card from "@/src/components/ui/Card";

interface AnalyticsPlaceholderProps {
  title: string;
  description?: string;
}

/** "Coming soon" panel for analytics tabs not yet implemented (Phase 0). */
export default function AnalyticsPlaceholder({
  title,
  description = "This dashboard is coming soon.",
}: AnalyticsPlaceholderProps) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <ChartBarSquareIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}

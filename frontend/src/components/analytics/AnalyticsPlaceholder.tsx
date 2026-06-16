"use client";

import { ChartBarSquareIcon } from "@heroicons/react/24/outline";
import Card from "@/src/components/ui/Card";

/** "Coming soon" panel for analytics tabs not yet implemented. */
export default function AnalyticsPlaceholder() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <ChartBarSquareIcon className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-sm text-muted-foreground">
          This dashboard is coming soon.
        </p>
      </div>
    </Card>
  );
}

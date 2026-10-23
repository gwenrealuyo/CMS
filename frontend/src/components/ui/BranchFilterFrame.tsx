import type { ReactNode } from "react";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";

/** Building mark for the page-header branch menu (Clusters, Lessons, and the same row elsewhere). */
export default function BranchFilterFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative w-full min-w-0 sm:w-52 sm:shrink-0">
      <BuildingOffice2Icon
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500"
        aria-hidden
      />
      {children}
    </div>
  );
}

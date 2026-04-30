"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Hover hint when a control uses pointer-events-none (e.g. locked branch filter). */
export function LockedControlTooltip({
  label,
  children,
  wrapperClassName = "inline-block w-52 shrink-0 align-middle cursor-default",
}: {
  label: string;
  children: ReactNode;
  wrapperClassName?: string;
}) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={wrapperClassName}>{children}</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-[100] max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-gray-50 shadow-lg"
          >
            {label}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

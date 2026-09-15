"use client";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { useIsMdUp } from "@/src/lib/listViewMode";

const HINT_CONTENT_CLASS =
  "z-[100] max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-gray-50 shadow-lg";

function usePrefersHoverTooltip(): boolean {
  const isMdUp = useIsMdUp();
  const [fineHover, setFineHover] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    const onChange = (event: MediaQueryListEvent) =>
      setFineHover(event.matches);
    setFineHover(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return isMdUp && fineHover;
}

/** Radix hover/focus tooltip. Pass a single focusable element as `children` (Trigger asChild). */
export function HoverTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className={HINT_CONTENT_CLASS}
          >
            {label}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** Tap-to-toggle hint for touch / small screens. Same look as HoverTooltip. */
function TapPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root modal>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          className={HINT_CONTENT_CLASS}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {label}
          <Popover.Arrow className="fill-gray-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Hover tooltip on desktop; tap popover on touch / small screens. */
export function HintTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const prefersHover = usePrefersHoverTooltip();
  if (prefersHover) {
    return <HoverTooltip label={label}>{children}</HoverTooltip>;
  }
  return <TapPopover label={label}>{children}</TapPopover>;
}

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
    <HoverTooltip label={label}>
      <span className={wrapperClassName}>{children}</span>
    </HoverTooltip>
  );
}

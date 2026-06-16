"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { EventTypeOption } from "@/src/types/event";
import {
  buildEventTypeRegistry,
  getEventTypeChipStyle,
  getEventTypeDotStyle,
  sortEventTypes,
  type EventTypeRegistry,
} from "@/src/lib/events/eventTypeStyles";
import type { CSSProperties } from "react";

type EventTypeStylesContextValue = {
  types: EventTypeOption[];
  registry: EventTypeRegistry;
  getChipStyle: (code: string, size?: "sm" | "md") => CSSProperties;
  getDotStyle: (code: string) => CSSProperties;
  sortTypes: (codes: string[]) => string[];
};

const EventTypeStylesContext = createContext<EventTypeStylesContextValue | null>(
  null
);

export function EventTypeStylesProvider({
  types,
  children,
}: {
  types: EventTypeOption[];
  children: ReactNode;
}) {
  const registry = useMemo(() => buildEventTypeRegistry(types), [types]);

  const getChipStyle = useCallback(
    (code: string, size: "sm" | "md" = "md") =>
      getEventTypeChipStyle(code, registry, size),
    [registry]
  );

  const getDotStyle = useCallback(
    (code: string) => getEventTypeDotStyle(code, registry),
    [registry]
  );

  const sortTypes = useCallback(
    (codes: string[]) => sortEventTypes(codes, registry),
    [registry]
  );

  const value = useMemo(
    () => ({
      types,
      registry,
      getChipStyle,
      getDotStyle,
      sortTypes,
    }),
    [types, registry, getChipStyle, getDotStyle, sortTypes]
  );

  return (
    <EventTypeStylesContext.Provider value={value}>
      {children}
    </EventTypeStylesContext.Provider>
  );
}

export function useEventTypeStyles() {
  const context = useContext(EventTypeStylesContext);
  if (!context) {
    throw new Error(
      "useEventTypeStyles must be used within an EventTypeStylesProvider"
    );
  }
  return context;
}

export function useOptionalEventTypeStyles() {
  return useContext(EventTypeStylesContext);
}

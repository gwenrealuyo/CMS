import { CSSProperties } from "react";
import { EventTypeOption } from "@/src/types/event";

export const DEFAULT_EVENT_TYPE_COLOR = "#9CA3AF";

export type EventTypeRegistry = Map<string, EventTypeOption>;

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_EVENT_TYPE_COLOR;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return DEFAULT_EVENT_TYPE_COLOR;
  }
  return withHash.toUpperCase();
}

export function buildEventTypeRegistry(
  types: EventTypeOption[]
): EventTypeRegistry {
  return new Map(types.map((type) => [type.code, type]));
}

export function getEventTypeFromRegistry(
  code: string,
  registry: EventTypeRegistry
): EventTypeOption | undefined {
  return registry.get(code);
}

export function getEventTypeColor(
  code: string,
  registry: EventTypeRegistry
): string {
  return normalizeHexColor(
    registry.get(code)?.color ?? DEFAULT_EVENT_TYPE_COLOR
  );
}

export function sortEventTypes(
  codes: string[],
  registry?: EventTypeRegistry
): string[] {
  const uniqueCodes = Array.from(new Set(codes));

  if (!registry || registry.size === 0) {
    return uniqueCodes.sort((a, b) => a.localeCompare(b));
  }

  return uniqueCodes.sort((a, b) => {
    const typeA = registry.get(a);
    const typeB = registry.get(b);
    const orderA = typeA?.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = typeB?.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    const labelA = typeA?.label ?? a;
    const labelB = typeB?.label ?? b;
    return labelA.localeCompare(labelB);
  });
}

const CHIP_BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "9999px",
  backgroundColor: "transparent",
  fontWeight: 600,
  lineHeight: 1,
};

export function getEventTypeChipStyle(
  code: string,
  registry: EventTypeRegistry,
  size: "sm" | "md" = "md"
): CSSProperties {
  const color = getEventTypeColor(code, registry);
  return {
    ...CHIP_BASE_STYLE,
    border: `1px solid ${color}`,
    color,
    padding: size === "sm" ? "0.125rem 0.5rem" : "0.25rem 0.75rem",
    fontSize: size === "sm" ? "0.625rem" : "0.75rem",
  };
}

export function getEventTypeDotStyle(
  code: string,
  registry: EventTypeRegistry
): CSSProperties {
  return {
    backgroundColor: getEventTypeColor(code, registry),
  };
}

export function labelToEventTypeCode(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

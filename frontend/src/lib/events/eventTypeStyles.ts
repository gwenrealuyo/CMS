const EVENT_TYPE_CHIP_CLASSES: Record<string, string> = {
  SUNDAY_SERVICE: "chip-primary",
  BIBLE_STUDY: "chip-purple",
  PRAYER_MEETING: "chip-green",
  SPECIAL_EVENT: "chip-orange",
};

const EVENT_TYPE_AGENDA_CHIP_CLASSES: Record<string, string> = {
  SUNDAY_SERVICE: "chip-primary-sm",
  BIBLE_STUDY: "chip-purple-sm",
  PRAYER_MEETING: "chip-green-sm",
  SPECIAL_EVENT: "chip-orange-sm",
};

const EVENT_TYPE_DOT_CLASSES: Record<string, string> = {
  SUNDAY_SERVICE: "bg-primary",
  BIBLE_STUDY: "bg-purple-600",
  PRAYER_MEETING: "bg-green-600",
  SPECIAL_EVENT: "bg-orange-600",
};

export const EVENT_TYPE_ORDER = [
  "SUNDAY_SERVICE",
  "BIBLE_STUDY",
  "PRAYER_MEETING",
  "SPECIAL_EVENT",
] as const;

export function getEventTypeChipClass(type: string): string {
  return EVENT_TYPE_CHIP_CLASSES[type] || "chip-gray";
}

export function getEventTypeAgendaChipClass(type: string): string {
  return EVENT_TYPE_AGENDA_CHIP_CLASSES[type] || "chip-gray-sm";
}

export function getEventTypeDotClass(type: string): string {
  return EVENT_TYPE_DOT_CLASSES[type] || "bg-gray-400";
}

export function sortEventTypes(types: string[]): string[] {
  const orderIndex = (type: string) => {
    const idx = EVENT_TYPE_ORDER.indexOf(
      type as (typeof EVENT_TYPE_ORDER)[number]
    );
    return idx === -1 ? EVENT_TYPE_ORDER.length : idx;
  };

  return Array.from(new Set(types)).sort((a, b) => {
    const orderDiff = orderIndex(a) - orderIndex(b);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b);
  });
}

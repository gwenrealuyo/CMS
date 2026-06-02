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

export function getEventTypeChipClass(type: string): string {
  return EVENT_TYPE_CHIP_CLASSES[type] || "chip-gray";
}

export function getEventTypeAgendaChipClass(type: string): string {
  return EVENT_TYPE_AGENDA_CHIP_CLASSES[type] || "chip-gray-sm";
}

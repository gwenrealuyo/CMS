/** Filled tonal chip classes for evangelism gathering types (no outlined chips). */
export function getEvangelismGatheringTypeChipClass(type?: string | null): string {
  switch (type) {
    case "PHYSICAL":
      return "bg-green-100 text-green-800";
    case "ONLINE":
      return "bg-blue-100 text-blue-800";
    case "HYBRID":
      return "bg-purple-100 text-purple-800";
    case "MIXED":
      return "bg-amber-100 text-amber-800";
    case "UNKNOWN":
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export type KpiValueTone = "default" | "success" | "danger";

export function kpiValueToneClass(tone: KpiValueTone = "default"): string {
  switch (tone) {
    case "success":
      return "text-green-700";
    case "danger":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

/** Zero is a problem (e.g. 0 visitors). */
export function toneWhenZeroIsBad(value: number): KpiValueTone {
  return value === 0 ? "danger" : "default";
}

/** Zero is the goal (e.g. 0 non-compliant clusters). */
export function toneWhenZeroIsGood(value: number): KpiValueTone {
  return value === 0 ? "success" : "default";
}

/** Any positive count is a concern (e.g. without family, drop-offs). */
export function toneWhenPositiveIsBad(value: number): KpiValueTone {
  if (value === 0) return "success";
  if (value > 0) return "danger";
  return "default";
}

/** Higher is better; zero is bad. */
export function toneWhenHigherIsBetter(
  value: number,
  { successAbove = 0 }: { successAbove?: number } = {},
): KpiValueTone {
  if (value === 0) return "danger";
  if (value > successAbove) return "success";
  return "default";
}

export function parsePercentValue(value: string | number): number | null {
  if (typeof value === "number") {
    return value;
  }
  const match = String(value).match(/([\d.]+)\s*%/);
  return match ? parseFloat(match[1]) : null;
}

export function parseNumericValue(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[₱%,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Compliance rate: 100% green; low rates red. */
export function toneForComplianceRate(rate: number): KpiValueTone {
  if (rate >= 100) return "success";
  if (rate < 80) return "danger";
  return "default";
}

/** General percentage KPIs (attendance, recovery, etc.). */
export function toneForPercentRate(
  rate: number,
  {
    successAt = 90,
    dangerBelow = 50,
  }: { successAt?: number; dangerBelow?: number } = {},
): KpiValueTone {
  if (rate >= successAt) return "success";
  if (rate <= dangerBelow) return "danger";
  return "default";
}

export function toneForOverviewHeadline(
  label: string,
  value: string | number,
): KpiValueTone {
  const labelLower = label.toLowerCase();
  const numeric = parseNumericValue(value);

  if (labelLower.includes("compliance rate")) {
    const pct = parsePercentValue(value);
    if (pct != null) return toneForComplianceRate(pct);
  }

  if (numeric != null) {
    if (labelLower.includes("non-compliant") && numeric > 0) {
      return "danger";
    }
    if (
      labelLower.includes("drop-off") ||
      labelLower.includes("outstanding") ||
      labelLower.includes("unassigned")
    ) {
      if (numeric > 0) return "danger";
      if (numeric === 0) return "success";
    }

    if (
      labelLower.includes("visitor") ||
      labelLower.includes("attendance") ||
      labelLower.includes("student")
    ) {
      if (numeric === 0) return "danger";
    }

    if (
      labelLower.includes("completed") ||
      labelLower.includes("compliant")
    ) {
      if (numeric > 0 && !labelLower.includes("non")) return "success";
    }

    if (labelLower.includes("collected") && numeric === 0) {
      return "danger";
    }
  }

  return "default";
}

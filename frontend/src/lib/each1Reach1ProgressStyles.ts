/**
 * Visual styles for Each 1 Reach 1 progress (bar fill + headline percentage color).
 * Branching matches Each1Reach1Dashboard progress bars.
 */
export function getEach1Reach1ProgressBarBgClass(
  percentage: number,
  achieved?: number,
  target?: number,
): string {
  if (achieved !== undefined && target !== undefined && achieved > target) {
    return "bg-violet-500";
  }
  if (achieved !== undefined && (achieved === 0 || achieved === 1)) {
    return "bg-red-500";
  }
  if (percentage === 0 || percentage <= 20) {
    return "bg-red-500";
  }
  if (percentage <= 40) {
    return "bg-orange-500";
  }
  if (percentage <= 70) {
    return "bg-yellow-500";
  }
  if (percentage >= 100) {
    return "bg-green-500";
  }
  return "bg-yellow-500";
}

/** Text color for metrics (e.g. summary card %) matching bar hue; green only at 100%+. */
export function getEach1Reach1ProgressValueTextClass(
  percentage: number,
  achieved?: number,
  target?: number,
): string {
  if (achieved !== undefined && target !== undefined && achieved > target) {
    return "text-violet-600";
  }
  if (achieved !== undefined && (achieved === 0 || achieved === 1)) {
    return "text-red-600";
  }
  if (percentage === 0 || percentage <= 20) {
    return "text-red-600";
  }
  if (percentage <= 40) {
    return "text-orange-600";
  }
  if (percentage <= 70) {
    return "text-yellow-700";
  }
  if (percentage >= 100) {
    return "text-green-600";
  }
  return "text-yellow-700";
}

/**
 * Same tiered headline colors without Each 1 Reach 1 rules (no violet /
 * achieved≤1 conversion handling). Use for lesson average progress etc.
 */
export function getTieredCompletionPercentTextClass(
  percentage: number,
): string {
  if (percentage === 0 || percentage <= 20) {
    return "text-red-600";
  }
  if (percentage <= 40) {
    return "text-orange-600";
  }
  if (percentage <= 70) {
    return "text-yellow-700";
  }
  if (percentage >= 100) {
    return "text-green-600";
  }
  return "text-yellow-700";
}

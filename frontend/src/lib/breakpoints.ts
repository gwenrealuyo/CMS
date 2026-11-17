export const TABLET_MIN = 744;
export const MD_MIN = 768;
export const DESKTOP_MIN = 1024;

/** Matches DashboardLayout / Sidebar expanded rail (`md:ml-[17.5rem]`). */
export const SIDEBAR_EXPANDED_WIDTH_PX = 280;
/** Matches DashboardLayout / Sidebar collapsed rail (`md:ml-16`). */
export const SIDEBAR_COLLAPSED_WIDTH_PX = 64;

export function isTabletUpWidth(width: number): boolean {
  return width >= TABLET_MIN;
}

export function isMdUpWidth(width: number): boolean {
  return width >= MD_MIN;
}

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN;
}

export const TABLET_MIN = 744;
export const MD_MIN = 768;
export const DESKTOP_MIN = 1024;

export function isTabletUpWidth(width: number): boolean {
  return width >= TABLET_MIN;
}

export function isMdUpWidth(width: number): boolean {
  return width >= MD_MIN;
}

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN;
}

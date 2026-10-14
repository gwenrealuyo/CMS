export const APP_NAME = "The Lighthouse";

export function formatPageTitle(page?: string | null): string {
  const name = page?.trim();
  if (!name) return APP_NAME;
  return `${name} | ${APP_NAME}`;
}

/**
 * Build a browser-reachable media URL for uploads served by the API
 * (profile photos, lesson PDFs, etc.).
 *
 * Prefers the API origin from NEXT_PUBLIC_API_URL so relative `/media/...`
 * paths and absolute URLs with an internal/wrong host still load in the browser.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Blob / data URLs are already browser-local (e.g. upload previews).
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const apiOrigin = new URL(apiBase).origin;
    const parsed = new URL(url, apiOrigin);
    const mediaIndex = parsed.pathname.indexOf("/media/");
    if (mediaIndex >= 0) {
      return `${apiOrigin}${parsed.pathname.slice(mediaIndex)}${parsed.search}`;
    }
    if (parsed.pathname.startsWith("media/")) {
      return `${apiOrigin}/${parsed.pathname}${parsed.search}`;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

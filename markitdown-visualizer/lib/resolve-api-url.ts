/** Browser-safe absolute URL for same-origin API (avoids wrong base with subpaths). */
export function apiUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).href;
}

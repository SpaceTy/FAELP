/**
 * Resolve an asset path (e.g. "/uploads/material-types/foo.webp") to a URL
 * the browser can load.  Assets are always served from the same origin as the
 * frontend, so relative paths work as-is.  If the value is already an absolute
 * URL we strip it down to just the path so it resolves against the current
 * origin rather than a build-time VITE_API_URL that may point to a different
 * port.
 */
export function resolveAssetUrl(path: string | undefined | null): string {
  if (!path) return '';

  // Already a relative path – the browser resolves it against the current origin.
  if (path.startsWith('/') && !path.startsWith('//')) {
    return path;
  }

  // Absolute URL – extract the path so it hits the current origin.
  try {
    const url = new URL(path);
    return url.pathname + url.search + url.hash;
  } catch {
    return path;
  }
}

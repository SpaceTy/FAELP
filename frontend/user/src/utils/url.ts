const configuredApiBase = (import.meta.env.VITE_API_URL || '').trim();

function getBaseUrl(): string {
  if (configuredApiBase) {
    return configuredApiBase;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '/';
}

export function resolveAssetUrl(path: string | undefined | null): string {
  if (!path) return '';

  // Keep already absolute/protocol-based URLs unchanged.
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    path.startsWith('//')
  ) {
    return path;
  }

  try {
    return new URL(path, getBaseUrl()).toString();
  } catch {
    return path;
  }
}

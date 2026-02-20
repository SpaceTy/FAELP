const configuredApiBase = (import.meta.env.VITE_API_URL || '').trim();

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function getBaseUrl(): string {
  if (configuredApiBase) {
    try {
      const configured = new URL(configuredApiBase);
      if (
        typeof window !== 'undefined' &&
        window.location?.hostname &&
        isLoopbackHost(configured.hostname) &&
        !isLoopbackHost(window.location.hostname)
      ) {
        return window.location.origin;
      }
    } catch {
      // Keep configuredApiBase as-is if it isn't a valid URL.
    }
    return configuredApiBase;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '/';
}

export function resolveAssetUrl(path: string | undefined | null): string {
  if (!path) return '';

  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) {
    try {
      const absolute = new URL(path, getBaseUrl());
      if (isLoopbackHost(absolute.hostname)) {
        return new URL(`${absolute.pathname}${absolute.search}${absolute.hash}`, getBaseUrl()).toString();
      }
    } catch {
      return path;
    }
    return path;
  }

  try {
    return new URL(path, getBaseUrl()).toString();
  } catch {
    return path;
  }
}

/**
 * Common tracking parameters to remove from URLs
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'source',
  'referrer',
];

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalize URL by removing tracking params and trailing slashes
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove common tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Remove trailing slash for consistency (except for root)
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return url;
  }
}

/**
 * Extract domain from URL (without www prefix)
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Resolve a potentially relative URL against a base URL
 */
export function resolveUrl(url: string | undefined | null, baseUrl: string): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is external relative to a domain
 */
export function isExternalUrl(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    const urlDomain = parsed.hostname.replace(/^www\./, '');
    return urlDomain !== baseDomain;
  } catch {
    return false;
  }
}

/**
 * Extract protocol from URL
 */
export function getProtocol(url: string): string {
  try {
    return new URL(url).protocol;
  } catch {
    return '';
  }
}

/**
 * Get the path portion of a URL
 */
export function getPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/**
 * Check if URL matches a pattern (supports * wildcard)
 */
export function matchesUrlPattern(url: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return url === pattern || url.startsWith(pattern);
  }

  const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

  return new RegExp(`^${regexPattern}`).test(url);
}

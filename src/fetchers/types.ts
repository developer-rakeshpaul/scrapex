/**
 * Fetcher interface - allows swapping fetch implementation
 * for Puppeteer, Playwright, or custom solutions
 */
export interface Fetcher {
  /**
   * Fetch HTML from a URL
   * @returns HTML content and final URL (after redirects)
   */
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;

  /** Fetcher name for logging */
  readonly name: string;
}

/**
 * Options for fetching
 */
export interface FetchOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** User agent string */
  userAgent?: string;

  /** Additional headers to send */
  headers?: Record<string, string>;

  /**
   * Allowed MIME types.
   * Defaults to HTML/XHTML if undefined.
   */
  allowedContentTypes?: string[];
}

/**
 * Result from fetching a URL
 */
export interface FetchResult {
  /** Raw HTML content */
  html: string;

  /** Final URL after redirects */
  finalUrl: string;

  /** HTTP status code */
  statusCode: number;

  /** Content-Type header */
  contentType: string;

  /** Response headers (optional) */
  headers?: Record<string, string>;
}

/**
 * Default user agent string
 */
export const DEFAULT_USER_AGENT =
  'Scrapex-Bot/2.0 (+https://github.com/developer-rakeshpaul/scrapex)';

/**
 * Default timeout in milliseconds
 */
export const DEFAULT_TIMEOUT = 10000;

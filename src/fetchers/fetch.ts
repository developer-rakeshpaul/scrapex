import { ScrapeError } from '@/core/errors.js';
import {
  DEFAULT_TIMEOUT,
  DEFAULT_USER_AGENT,
  type Fetcher,
  type FetchOptions,
  type FetchResult,
} from './types.js';

/**
 * Default fetcher using native fetch API.
 * Works in Node.js 18+ without polyfills.
 */
export class NativeFetcher implements Fetcher {
  readonly name = 'native-fetch';

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const { timeout = DEFAULT_TIMEOUT, userAgent = DEFAULT_USER_AGENT, headers = {} } = options;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new ScrapeError(`Invalid URL: ${url}`, 'INVALID_URL');
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new ScrapeError(`Invalid protocol: ${parsedUrl.protocol}`, 'INVALID_URL');
    }

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          ...headers,
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      // Handle error status codes
      if (!response.ok) {
        if (response.status === 404) {
          throw new ScrapeError(`Page not found: ${url}`, 'NOT_FOUND', 404);
        }
        if (response.status === 403 || response.status === 401) {
          throw new ScrapeError(`Access blocked: ${url}`, 'BLOCKED', response.status);
        }
        if (response.status === 429) {
          throw new ScrapeError(`Rate limited: ${url}`, 'BLOCKED', 429);
        }
        throw new ScrapeError(
          `HTTP error ${response.status}: ${url}`,
          'FETCH_FAILED',
          response.status
        );
      }

      const contentType = response.headers.get('content-type') || '';

      // Ensure we're getting HTML
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new ScrapeError(`Unexpected content type: ${contentType}`, 'PARSE_ERROR');
      }

      const html = await response.text();

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        html,
        finalUrl: response.url,
        statusCode: response.status,
        contentType,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw ScrapeErrors
      if (error instanceof ScrapeError) {
        throw error;
      }

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ScrapeError(`Request timed out after ${timeout}ms`, 'TIMEOUT');
      }

      // Handle other errors
      if (error instanceof Error) {
        throw new ScrapeError(`Fetch failed: ${error.message}`, 'FETCH_FAILED', undefined, error);
      }

      throw new ScrapeError('Unknown fetch error', 'FETCH_FAILED');
    }
  }
}

/**
 * Default fetcher instance
 */
export const defaultFetcher = new NativeFetcher();

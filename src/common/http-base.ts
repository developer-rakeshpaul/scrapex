/**
 * Shared HTTP provider infrastructure for LLM and Embedding providers.
 * Provides SSRF protection, resilience, and error normalization.
 */
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { ScrapeError } from '../core/errors.js';
import { createHttpError } from './errors.js';
import type { ResilienceConfig, ResilienceState, RetryConfig } from './resilience.js';
import {
  CircuitBreaker,
  CircuitOpenError,
  RateLimiter,
  Semaphore,
  withRetry,
  withTimeout,
} from './resilience.js';

export type {
  CircuitBreakerConfig,
  CircuitState,
  RateLimitConfig,
  ResilienceConfig,
  ResilienceState,
  RetryConfig,
} from './resilience.js';
// Re-export resilience utilities and types for convenience
export {
  CircuitBreaker,
  CircuitOpenError,
  isRetryableError,
  RateLimiter,
  Semaphore,
  sleep,
  withResilience,
  withRetry,
  withTimeout,
} from './resilience.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Security options for HTTP providers.
 */
export interface HttpSecurityOptions {
  /** Require HTTPS protocol. @default true */
  requireHttps?: boolean;
  /** Allow private/internal IP addresses. @default false */
  allowPrivate?: boolean;
  /** Resolve DNS and validate IPs before request. @default true */
  resolveDns?: boolean;
  /** Allow HTTP redirects. @default false */
  allowRedirects?: boolean;
}

/**
 * Base configuration for HTTP providers.
 */
export interface BaseHttpConfig<TError = unknown> {
  /** Base URL for the API endpoint */
  baseUrl: string;
  /** Model identifier */
  model: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Extract error message from failed response */
  errorMapper?: (response: TError) => string;
  /** Security options */
  requireHttps?: boolean;
  allowPrivate?: boolean;
  resolveDns?: boolean;
  allowRedirects?: boolean;
  /** Resilience options */
  resilience?: ResilienceConfig;
}

// ─────────────────────────────────────────────────────────────
// SSRF Protection
// ─────────────────────────────────────────────────────────────

/**
 * Private IP ranges blocked for SSRF protection.
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^127\./, // 127.0.0.0/8
  /^0\./, // 0.0.0.0/8
  /^169\.254\./, // Link-local
  /^::1$/, // IPv6 loopback
  /^(fc|fd)[0-9a-f]{2}:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
  /^localhost$/i,
];

/**
 * Check if a hostname/IP is private.
 */
export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Validate a URL for security.
 */
export function validateUrl(url: string, options: HttpSecurityOptions = {}): URL {
  const requireHttps = options.requireHttps ?? true;
  const allowPrivate = options.allowPrivate ?? false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ScrapeError(`Invalid URL: ${url}`, 'INVALID_URL');
  }

  // HTTPS enforcement
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new ScrapeError(`HTTPS required. Got: ${parsed.protocol}`, 'VALIDATION_ERROR');
  }

  // Private IP check (before DNS resolution)
  if (!allowPrivate && isPrivateHost(parsed.hostname)) {
    throw new ScrapeError(
      `Private/internal addresses not allowed: ${parsed.hostname}`,
      'VALIDATION_ERROR'
    );
  }

  return parsed;
}

/**
 * Validate URL and resolve DNS to check for private IPs.
 */
export async function validateUrlWithDns(
  url: string,
  options: HttpSecurityOptions = {}
): Promise<void> {
  const parsed = validateUrl(url, options);
  const resolveDns = options.resolveDns ?? true;
  const allowPrivate = options.allowPrivate ?? false;

  if (!resolveDns || allowPrivate) {
    return;
  }

  const host = parsed.hostname;

  // Skip if already an IP address
  if (isIP(host)) {
    return;
  }

  // Resolve DNS and check all addresses
  try {
    const addresses = await dns.lookup(host, { all: true });
    for (const addr of addresses) {
      if (isPrivateHost(addr.address)) {
        throw new ScrapeError(
          `DNS resolved to private address: ${host} -> ${addr.address}`,
          'VALIDATION_ERROR'
        );
      }
    }
  } catch (error) {
    if (error instanceof ScrapeError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new ScrapeError(`Failed to resolve hostname: ${host} (${message})`, 'FETCH_FAILED');
  }
}

// ─────────────────────────────────────────────────────────────
// Base HTTP Provider
// ─────────────────────────────────────────────────────────────

/**
 * Fetch request options for base provider.
 */
export interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Result of a fetch request.
 */
export interface FetchResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Base HTTP provider with shared security and resilience.
 */
export abstract class BaseHttpProvider {
  protected readonly baseUrl: string;
  protected readonly model: string;
  protected readonly headers: Record<string, string>;
  protected readonly errorMapper?: (response: unknown) => string;

  // Security options
  protected readonly requireHttps: boolean;
  protected readonly allowPrivate: boolean;
  protected readonly resolveDns: boolean;
  protected readonly allowRedirects: boolean;

  // Resilience options
  protected readonly timeoutMs: number;
  protected readonly retryConfig?: RetryConfig;
  protected readonly concurrency: number;

  // Resilience state (initialized lazily or passed in)
  private circuitBreaker?: ResilienceState['circuitBreaker'];
  private rateLimiter?: ResilienceState['rateLimiter'];
  private semaphore?: ResilienceState['semaphore'];

  constructor(config: BaseHttpConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.errorMapper = config.errorMapper;

    // Security defaults
    this.requireHttps = config.requireHttps ?? true;
    this.allowPrivate = config.allowPrivate ?? false;
    this.resolveDns = config.resolveDns ?? true;
    this.allowRedirects = config.allowRedirects ?? false;

    // Resilience defaults
    this.timeoutMs = config.resilience?.timeoutMs ?? 30000;
    this.retryConfig = config.resilience?.retry;
    this.concurrency = config.resilience?.concurrency ?? 1;

    const sharedState = config.resilience?.state;

    // Initialize resilience components if configured or provided
    this.circuitBreaker =
      sharedState?.circuitBreaker ??
      (config.resilience?.circuitBreaker
        ? new CircuitBreaker(config.resilience.circuitBreaker)
        : undefined);
    this.rateLimiter =
      sharedState?.rateLimiter ??
      (config.resilience?.rateLimit ? new RateLimiter(config.resilience.rateLimit) : undefined);
    this.semaphore = sharedState?.semaphore ?? new Semaphore(this.concurrency);

    // Validate URL on construction
    validateUrl(this.baseUrl, {
      requireHttps: this.requireHttps,
      allowPrivate: this.allowPrivate,
    });
  }

  /**
   * Get the current resilience state for persistence across calls.
   */
  getResilienceState(): ResilienceState {
    return {
      circuitBreaker: this.circuitBreaker,
      rateLimiter: this.rateLimiter,
      semaphore: this.semaphore,
    };
  }

  /**
   * Make an HTTP request with security and resilience.
   */
  protected async fetch<T>(url: string, options: FetchOptions = {}): Promise<FetchResult<T>> {
    const securityOptions: HttpSecurityOptions = {
      requireHttps: this.requireHttps,
      allowPrivate: this.allowPrivate,
      resolveDns: this.resolveDns,
      allowRedirects: this.allowRedirects,
    };

    // Validate URL with DNS resolution
    await validateUrlWithDns(url, securityOptions);

    // Check circuit breaker before proceeding
    if (this.circuitBreaker?.isOpen()) {
      throw new CircuitOpenError('Circuit breaker is open. Too many recent failures.');
    }

    // Acquire rate limit token if configured
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }

    // The actual fetch operation
    const doFetch = async (signal: AbortSignal): Promise<FetchResult<T>> => {
      const response = await fetch(url, {
        method: options.method ?? 'POST',
        headers: { ...this.headers, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal ?? signal,
        redirect: this.allowRedirects ? 'follow' : 'error',
      });

      // Validate redirect target if followed
      if (this.allowRedirects && response.redirected) {
        await validateUrlWithDns(response.url, securityOptions);
      }

      // Handle errors
      if (!response.ok) {
        throw await createHttpError(response, this.constructor.name, this.errorMapper);
      }

      const data = (await response.json()) as T;

      return {
        data,
        status: response.status,
        headers: response.headers,
      };
    };

    // Wrap with concurrency control (semaphore)
    const executeWithConcurrency = async (): Promise<FetchResult<T>> => {
      if (!this.semaphore) {
        throw new ScrapeError('Semaphore not initialized', 'VALIDATION_ERROR');
      }
      return this.semaphore.execute(async () => {
        // Apply timeout
        const fetchWithTimeout = async (): Promise<FetchResult<T>> => {
          return withTimeout((signal) => doFetch(signal), this.timeoutMs);
        };

        // Apply retry if configured
        try {
          let result: FetchResult<T>;
          if (this.retryConfig) {
            const retryResult = await withRetry(fetchWithTimeout, this.retryConfig);
            result = retryResult.result;
          } else {
            result = await fetchWithTimeout();
          }

          // Record success for circuit breaker
          this.circuitBreaker?.recordSuccess();
          return result;
        } catch (error) {
          // Record failure for circuit breaker
          this.circuitBreaker?.recordFailure();
          throw error;
        }
      });
    };

    return executeWithConcurrency();
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Exports
// ─────────────────────────────────────────────────────────────

/**
 * Create standard headers for API requests.
 */
export function createHeaders(
  apiKey?: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
}

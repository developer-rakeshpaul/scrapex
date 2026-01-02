/**
 * Shared resilience utilities for HTTP providers.
 * Provides retry, circuit breaker, rate limiting, timeout, and concurrency control.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Retry configuration.
 */
export interface RetryConfig {
  /** Maximum retry attempts. @default 3 */
  maxAttempts?: number;
  /** Initial backoff delay in ms. @default 1000 */
  backoffMs?: number;
  /** Backoff multiplier. @default 2 */
  backoffMultiplier?: number;
  /** HTTP status codes to retry. @default [408, 429, 500, 502, 503, 504] */
  retryableStatuses?: number[];
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Failures before opening circuit. @default 5 */
  failureThreshold?: number;
  /** Time before attempting to close circuit. @default 30000 */
  resetTimeoutMs?: number;
}

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  /** Max requests per minute */
  requestsPerMinute?: number;
  /** Max tokens per minute (for LLM providers) */
  tokensPerMinute?: number;
}

/**
 * Circuit breaker state.
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Internal circuit breaker state.
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

/**
 * Resilience configuration for HTTP providers.
 */
export interface ResilienceConfig {
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  rateLimit?: RateLimitConfig;
  /** Request timeout in ms. @default 30000 */
  timeoutMs?: number;
  /** Max concurrent requests. @default 1 */
  concurrency?: number;
  /** Optional shared state for circuit breaker / rate limiter / semaphore */
  state?: ResilienceState;
}

/**
 * Shared resilience state for persistence across calls.
 */
export interface ResilienceState {
  circuitBreaker?: {
    isOpen(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getState?(): CircuitState;
  };
  rateLimiter?: {
    acquire(): Promise<void>;
  };
  semaphore?: {
    execute<T>(fn: () => Promise<T>): Promise<T>;
  };
}

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Errors that should be retried (transient failures).
 */
const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
];

/**
 * Check if an error is retryable.
 */
export function isRetryableError(
  error: unknown,
  retryableStatuses: number[] = DEFAULT_RETRY.retryableStatuses
): boolean {
  if (error instanceof Error) {
    // Check for network errors
    const code = (error as NodeJS.ErrnoException).code;
    if (code && RETRYABLE_ERROR_CODES.includes(code)) {
      return true;
    }

    // Check for HTTP status codes on error object
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return retryableStatuses.includes(error.statusCode);
    }
    if ('status' in error && typeof error.status === 'number') {
      return retryableStatuses.includes(error.status);
    }

    // Check for timeout/fetch errors by code
    if ('code' in error) {
      const errCode = error.code as string;
      if (errCode === 'TIMEOUT' || errCode === 'FETCH_FAILED') {
        return true;
      }
    }

    // Check message for common retryable patterns
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('temporarily unavailable')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep for specified milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig,
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<{ result: T; attempts: number }> {
  const maxAttempts = config?.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
  const backoffMs = config?.backoffMs ?? DEFAULT_RETRY.backoffMs;
  const multiplier = config?.backoffMultiplier ?? DEFAULT_RETRY.backoffMultiplier;
  const retryableStatuses = config?.retryableStatuses ?? DEFAULT_RETRY.retryableStatuses;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxAttempts || !isRetryableError(error, retryableStatuses)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = backoffMs * multiplier ** (attempt - 1);

      // Add jitter (±10%)
      const jitter = delay * (0.9 + Math.random() * 0.2);

      onRetry?.(attempt, lastError, jitter);

      await sleep(jitter);
    }
  }

  throw lastError ?? new Error('Retry failed');
}

// ─────────────────────────────────────────────────────────────
// Timeout
// ─────────────────────────────────────────────────────────────

/**
 * Execute a function with timeout.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create an AbortSignal that times out after specified milliseconds.
 * If parentSignal is provided, this signal will abort when the parent aborts.
 */
export function createTimeoutSignal(timeoutMs: number, parentSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  timeoutId.unref?.();

  const clear = () => clearTimeout(timeoutId);
  controller.signal.addEventListener('abort', clear, { once: true });

  if (parentSignal) {
    if (parentSignal.aborted) {
      clear();
      controller.abort(parentSignal.reason);
      return controller.signal;
    }

    parentSignal.addEventListener(
      'abort',
      () => {
        clear();
        controller.abort(parentSignal.reason);
      },
      { once: true }
    );
  }
  return controller.signal;
}

// ─────────────────────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────────────────────

/**
 * Default circuit breaker configuration.
 */
const DEFAULT_CIRCUIT_BREAKER: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
};

/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitOpenError extends Error {
  readonly isCircuitOpen = true;

  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit breaker implementation.
 * Prevents cascade failures by stopping requests when failure rate is high.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? DEFAULT_CIRCUIT_BREAKER.failureThreshold;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? DEFAULT_CIRCUIT_BREAKER.resetTimeoutMs;
    this.state = {
      state: 'closed',
      failures: 0,
    };
  }

  /**
   * Check if requests are blocked.
   */
  isOpen(): boolean {
    this.updateState();
    return this.state.state === 'open';
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    this.updateState();
    return this.state.state;
  }

  /**
   * Record a successful request.
   */
  recordSuccess(): void {
    this.state.failures = 0;
    this.state.state = 'closed';
    this.state.lastFailureTime = undefined;
    this.state.nextAttemptTime = undefined;
  }

  /**
   * Record a failed request.
   */
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failures >= this.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttemptTime = Date.now() + this.resetTimeoutMs;
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      const nextAttempt = this.state.nextAttemptTime
        ? new Date(this.state.nextAttemptTime).toISOString()
        : 'unknown';
      throw new CircuitOpenError(`Circuit breaker is open. Next attempt at ${nextAttempt}`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Reset the circuit breaker.
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
    };
  }

  /**
   * Update state based on time (open -> half-open transition).
   */
  private updateState(): void {
    if (
      this.state.state === 'open' &&
      this.state.nextAttemptTime &&
      Date.now() >= this.state.nextAttemptTime
    ) {
      this.state.state = 'half-open';
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────

/**
 * Token bucket rate limiter.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(config: RateLimitConfig) {
    // Convert requests per minute to tokens per second
    const requestsPerSecond = (config.requestsPerMinute ?? 60) / 60;

    this.maxTokens = Math.max(1, Math.ceil(requestsPerSecond * 10)); // 10 second burst
    this.refillRate = requestsPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Check if a request is allowed without consuming tokens.
   */
  canProceed(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /**
   * Attempt to acquire tokens for a request.
   * Returns true if allowed, false if rate limited.
   */
  tryAcquire(tokens = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available, then acquire.
   */
  async acquire(tokens = 1): Promise<void> {
    if (this.tryAcquire(tokens)) {
      return;
    }

    // Calculate precise wait time for required tokens
    this.refill();
    const tokensNeeded = tokens - this.tokens;
    const waitMs = Math.ceil((tokensNeeded / this.refillRate) * 1000);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    // After waiting, acquire should succeed (but retry if timing drift)
    while (!this.tryAcquire(tokens)) {
      await sleep(Math.ceil((1 / this.refillRate) * 1000));
    }
  }

  /**
   * Get time until next token is available (in milliseconds).
   */
  getWaitTime(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    return Math.ceil((1 / this.refillRate) * 1000);
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

// ─────────────────────────────────────────────────────────────
// Concurrency Control
// ─────────────────────────────────────────────────────────────

/**
 * Semaphore for limiting concurrent operations.
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if necessary.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a permit.
   */
  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Execute function with semaphore protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Combined Resilience Wrapper
// ─────────────────────────────────────────────────────────────

/**
 * Execute a function with all resilience features.
 */
export async function withResilience<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  config?: ResilienceConfig,
  state?: ResilienceState,
  callbacks?: {
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  }
): Promise<{ result: T; attempts: number }> {
  const timeoutMs = config?.timeoutMs ?? 30000;

  // Check circuit breaker
  if (state?.circuitBreaker?.isOpen()) {
    throw new CircuitOpenError('Circuit breaker is open');
  }

  // Acquire rate limit token
  if (state?.rateLimiter) {
    await state.rateLimiter.acquire();
  }

  // Wrap with concurrency control
  const executeWithConcurrency = async (): Promise<{ result: T; attempts: number }> => {
    // Wrap with timeout
    const withTimeoutFn = () => withTimeout(fn, timeoutMs);

    // Wrap with retry
    try {
      const retryResult = await withRetry(withTimeoutFn, config?.retry, callbacks?.onRetry);
      state?.circuitBreaker?.recordSuccess();
      return retryResult;
    } catch (error) {
      state?.circuitBreaker?.recordFailure();
      throw error;
    }
  };

  // Apply semaphore if available
  if (state?.semaphore) {
    return state.semaphore.execute(executeWithConcurrency);
  }

  return executeWithConcurrency();
}

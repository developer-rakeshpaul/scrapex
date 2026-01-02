/**
 * Common utilities shared between LLM and Embedding providers.
 */

// Error utilities
export {
  createHttpError,
  getErrorCodeFromStatus,
  isRetryableStatus,
  normalizeError,
  parseErrorBody,
  RETRYABLE_STATUS_CODES,
} from './errors.js';
// HTTP types
export type {
  BaseHttpConfig,
  FetchOptions,
  FetchResult,
  HttpSecurityOptions,
} from './http-base.js';
// HTTP base provider
export {
  BaseHttpProvider,
  createHeaders,
  isPrivateHost,
  validateUrl,
  validateUrlWithDns,
} from './http-base.js';
// Resilience types
export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  RateLimitConfig,
  ResilienceConfig,
  ResilienceState,
  RetryConfig,
} from './resilience.js';
// Resilience utilities
export {
  CircuitBreaker,
  CircuitOpenError,
  createTimeoutSignal,
  isRetryableError,
  RateLimiter,
  Semaphore,
  sleep,
  withResilience,
  withRetry,
  withTimeout,
} from './resilience.js';

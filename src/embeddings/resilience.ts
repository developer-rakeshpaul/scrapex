/**
 * Resilience utilities for embedding providers.
 *
 * Re-exports from the common resilience module for backwards compatibility.
 * New code should import directly from '../common/resilience.js' or 'scrapex/common'.
 */

export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  RateLimitConfig,
  ResilienceConfig,
  ResilienceState,
  RetryConfig,
} from '../common/resilience.js';
// Re-export everything from common resilience module
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
} from '../common/resilience.js';

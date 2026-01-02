import type { ScrapedData } from '../core/types.js';
import type { HttpEmbeddingConfig } from './providers/http.js';

// ─────────────────────────────────────────────────────────────
// Provider Configuration (Provider-Agnostic Design)
// ─────────────────────────────────────────────────────────────

/**
 * Embedding provider configuration - discriminated union for type safety.
 *
 * Use preset factory functions to create providers:
 * - `createOpenAIEmbedding()` - OpenAI API
 * - `createAzureEmbedding()` - Azure OpenAI
 * - `createOllamaEmbedding()` - Local Ollama
 * - `createHuggingFaceEmbedding()` - HuggingFace Inference API
 * - `createCohereEmbedding()` - Cohere API
 * - `createTransformersEmbedding()` - Local Transformers.js
 *
 * @example Using a preset
 * ```ts
 * import { createOpenAIEmbedding } from 'scrapex/embeddings';
 *
 * const result = await scrape(url, {
 *   embeddings: {
 *     provider: { type: 'custom', provider: createOpenAIEmbedding() },
 *   },
 * });
 * ```
 *
 * @example Using inline HTTP config
 * ```ts
 * const result = await scrape(url, {
 *   embeddings: {
 *     provider: {
 *       type: 'http',
 *       config: {
 *         baseUrl: 'https://api.example.com/embed',
 *         model: 'custom-model',
 *         headers: { Authorization: 'Bearer ...' },
 *       },
 *     },
 *   },
 * });
 * ```
 */
export type EmbeddingProviderConfig =
  | { type: 'http'; config: HttpEmbeddingConfig }
  | { type: 'custom'; provider: EmbeddingProvider };

// Re-export HttpEmbeddingConfig for convenience
export type { HttpEmbeddingConfig } from './providers/http.js';

// ─────────────────────────────────────────────────────────────
// Provider Interface
// ─────────────────────────────────────────────────────────────

/**
 * Embedding provider interface - mirrors LLMProvider pattern.
 */
export interface EmbeddingProvider {
  readonly name: string;
  /**
   * Generate embeddings for one or more texts.
   */
  embed(texts: string[], options: EmbedRequest): Promise<EmbedResponse>;
}

export interface EmbedRequest {
  /** Model to use. If undefined, provider uses its configured default. */
  model?: string;
  dimensions?: number;
  signal?: AbortSignal;
}

export interface EmbedResponse {
  embeddings: number[][];
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Input Configuration
// ─────────────────────────────────────────────────────────────

export type EmbeddingInputType = 'textContent' | 'title+summary' | 'custom';

export interface EmbeddingInputConfig {
  /**
   * Predefined input source. Ignored if `transform` is provided.
   * @default 'textContent'
   */
  type?: EmbeddingInputType;
  /**
   * Custom function to generate input text from scraped data.
   * Enables dynamic construction (e.g., "Combine price + title").
   */
  transform?: (data: Partial<ScrapedData>) => string;
  /**
   * Static custom input string. Used when type is 'custom'.
   */
  customText?: string;
}

// ─────────────────────────────────────────────────────────────
// Chunking Configuration
// ─────────────────────────────────────────────────────────────

export interface ChunkingConfig {
  /**
   * Target chunk size in tokens.
   * @default 500
   */
  size?: number;
  /**
   * Overlap between chunks in tokens.
   * @default 50
   */
  overlap?: number;
  /**
   * Token counting strategy.
   * - 'heuristic': chars / 4 (fast, approximate)
   * - 'tiktoken': accurate for OpenAI models (lazy-loaded)
   * - function: custom tokenizer
   */
  tokenizer?: 'heuristic' | 'tiktoken' | ((text: string) => number);
  /**
   * Hard cap on input length (characters) to prevent memory exhaustion.
   * @default 100000 (100KB)
   */
  maxInputLength?: number;
}

// ─────────────────────────────────────────────────────────────
// Output Configuration
// ─────────────────────────────────────────────────────────────

export type EmbeddingAggregation =
  | 'average' // Average all chunk vectors (default)
  | 'max' // Element-wise maximum
  | 'first' // Use first chunk only
  | 'all'; // Return all chunk vectors

export interface OutputConfig {
  /**
   * Aggregation strategy for chunk vectors.
   * @default 'average'
   */
  aggregation?: EmbeddingAggregation;
  /** Model-specific dimension override */
  dimensions?: number;
}

// ─────────────────────────────────────────────────────────────
// Safety & Compliance Configuration
// ─────────────────────────────────────────────────────────────

export interface PiiRedactionConfig {
  /** Redact email addresses */
  email?: boolean;
  /** Redact phone numbers */
  phone?: boolean;
  /** Redact credit card numbers */
  creditCard?: boolean;
  /** Redact SSN patterns */
  ssn?: boolean;
  /** Redact IP addresses */
  ipAddress?: boolean;
  /** Additional patterns to redact */
  customPatterns?: RegExp[];
}

export interface SafetyConfig {
  /**
   * PII redaction patterns to apply before embedding.
   * Critical for GDPR/CCPA compliance with third-party APIs.
   */
  piiRedaction?: PiiRedactionConfig;
  /**
   * Minimum text length to proceed with embedding.
   * Skips with reason if below threshold.
   */
  minTextLength?: number;
  /**
   * Maximum tokens per API request to prevent billing DoS.
   * @default 8192
   */
  maxTokens?: number;
  /**
   * Explicitly opt-in to receive sensitive data in callbacks.
   * When false (default), onChunk receives redacted content.
   */
  allowSensitiveCallbacks?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Cache Configuration
// ─────────────────────────────────────────────────────────────

export interface EmbeddingCacheConfig {
  /** Cache implementation */
  store?: EmbeddingCache;
  /** Time-to-live in milliseconds */
  ttlMs?: number;
  /** Maximum entries for in-memory cache */
  maxEntries?: number;
  /**
   * Extra salt to disambiguate cache keys for custom providers/transforms.
   */
  cacheKeySalt?: string;
}

/**
 * Content-addressable cache interface for embeddings.
 * Keys are based on content hash, not URL.
 */
export interface EmbeddingCache {
  get(key: string): Promise<EmbeddingResult | undefined>;
  set(key: string, value: EmbeddingResult, options?: { ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Resilience Configuration
// ─────────────────────────────────────────────────────────────

export interface RetryConfig {
  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxAttempts?: number;
  /**
   * Initial backoff delay in milliseconds.
   * @default 1000
   */
  backoffMs?: number;
  /**
   * Backoff multiplier for exponential delay.
   * @default 2
   */
  backoffMultiplier?: number;
}

export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening the circuit.
   * @default 5
   */
  failureThreshold?: number;
  /**
   * Time to wait before attempting to close the circuit.
   * @default 30000
   */
  resetTimeoutMs?: number;
}

export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute?: number;
  /** Maximum tokens per minute */
  tokensPerMinute?: number;
}

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

export interface ResilienceConfig {
  /** Retry configuration for transient failures */
  retry?: RetryConfig;
  /** Circuit breaker to prevent cascade failures */
  circuitBreaker?: CircuitBreakerConfig;
  /** Rate limiting per provider */
  rateLimit?: RateLimitConfig;
  /**
   * Optional shared state for circuit breaker and rate limiter.
   * Use to persist state across multiple calls.
   */
  state?: ResilienceState;
  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
  /**
   * Concurrent chunk processing.
   * @default 1
   */
  concurrency?: number;
}

// ─────────────────────────────────────────────────────────────
// Main Options Interface
// ─────────────────────────────────────────────────────────────

export interface EmbeddingOptions {
  /** Embedding provider configuration */
  provider: EmbeddingProviderConfig;
  /** Model identifier (overrides provider default) */
  model?: string;
  /** Input text configuration */
  input?: EmbeddingInputConfig;
  /** Chunking and tokenization settings */
  chunking?: ChunkingConfig;
  /** Output format and aggregation */
  output?: OutputConfig;
  /** Safety and compliance settings */
  safety?: SafetyConfig;
  /** Caching configuration */
  cache?: EmbeddingCacheConfig;
  /** Resilience and rate limiting */
  resilience?: ResilienceConfig;
  /**
   * Callback for each chunk (receives redacted content by default).
   */
  onChunk?: (chunk: Readonly<string>, embedding: Readonly<number[]>) => void;
  /**
   * Metrics callback for observability.
   */
  onMetrics?: (metrics: EmbeddingMetrics) => void;
}

// ─────────────────────────────────────────────────────────────
// Result Types (Discriminated Union for Type Safety)
// ─────────────────────────────────────────────────────────────

export interface EmbeddingSource {
  /** Model used for embedding (may be undefined for custom providers) */
  model?: string;
  /** Number of chunks processed */
  chunks: number;
  /** Total tokens processed */
  tokens: number;
  /** Content checksum for cache validation */
  checksum: string;
  /** Whether result was from cache */
  cached: boolean;
  /** Total latency in milliseconds */
  latencyMs: number;
}

/**
 * Successful embedding result with single aggregated vector.
 */
export interface EmbeddingSuccessSingle {
  status: 'success';
  aggregation: 'average' | 'max' | 'first';
  vector: number[];
  source: EmbeddingSource;
}

/**
 * Successful embedding result with all chunk vectors.
 */
export interface EmbeddingSuccessMultiple {
  status: 'success';
  aggregation: 'all';
  vectors: number[][];
  source: EmbeddingSource;
}

/**
 * Skipped embedding with reason.
 */
export interface EmbeddingSkipped {
  status: 'skipped';
  reason: string;
  source: Partial<EmbeddingSource>;
}

/**
 * Embedding result - discriminated union for type safety.
 * Use `result.status` to narrow the type.
 */
export type EmbeddingResult = EmbeddingSuccessSingle | EmbeddingSuccessMultiple | EmbeddingSkipped;

// ─────────────────────────────────────────────────────────────
// Metrics for Observability
// ─────────────────────────────────────────────────────────────

export interface EmbeddingMetrics {
  /** Provider name */
  provider: string;
  /** Model used (may be undefined for custom providers) */
  model?: string;
  /** Input tokens processed */
  inputTokens: number;
  /** Output embedding dimensions */
  outputDimensions: number;
  /** Number of chunks processed */
  chunks: number;
  /** Total latency in milliseconds */
  latencyMs: number;
  /** Whether result was from cache */
  cached: boolean;
  /** Number of retry attempts */
  retries: number;
  /** Whether PII was redacted */
  piiRedacted: boolean;
}

// ─────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────

/**
 * Internal chunk representation during processing.
 */
export interface TextChunk {
  /** Chunk text content */
  text: string;
  /** Start position in original text */
  startIndex: number;
  /** End position in original text */
  endIndex: number;
  /** Estimated token count */
  tokens: number;
}

/**
 * Circuit breaker state.
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker internal state tracking.
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

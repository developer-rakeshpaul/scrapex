/**
 * Embedding module for scrapex.
 *
 * Provides opt-in embedding generation with support for multiple providers:
 * - OpenAI (text-embedding-3-small, text-embedding-3-large)
 * - Azure OpenAI
 * - Cohere
 * - HTTP/REST APIs (Ollama, HuggingFace, LocalAI)
 * - Transformers.js (in-process, offline)
 *
 * @example Using preset factory functions
 * ```ts
 * import { scrape } from 'scrapex';
 * import { createOpenAIEmbedding } from 'scrapex/embeddings';
 *
 * const result = await scrape(url, {
 *   embeddings: {
 *     provider: { type: 'custom', provider: createOpenAIEmbedding() },
 *     model: 'text-embedding-3-small',
 *   },
 * });
 *
 * if (result.embeddings?.status === 'success') {
 *   console.log(result.embeddings.vector);
 * }
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

// Aggregation
export {
  type AggregationResult,
  aggregateVectors,
  cosineSimilarity,
  dotProduct,
  euclideanDistance,
  getDimensions,
  normalizeVector,
} from './aggregation.js';
// Cache
export {
  type CacheStats,
  createNoOpCache,
  generateCacheKey,
  generateChecksum,
  getDefaultCache,
  InMemoryEmbeddingCache,
  resetDefaultCache,
  validateCachedResult,
} from './cache.js';
// Chunking
export {
  chunkText,
  createTokenizer,
  estimateTokens,
  getChunkingStats,
  heuristicTokenCount,
  needsChunking,
} from './chunking.js';
// Input selection
export {
  type InputValidation,
  previewInput,
  selectInput,
  validateInput,
} from './input.js';
// Main pipeline functions
export { embed, embedScrapedData, generateEmbeddings } from './pipeline.js';
// HTTP Provider (provider-agnostic)
export { createHttpEmbedding, HttpEmbeddingProvider } from './providers/http.js';
// Provider factory and utilities
export {
  createEmbeddingProvider,
  getDefaultModel,
  isEmbeddingProvider,
} from './providers/index.js';
// Preset factory functions
export {
  createAzureEmbedding,
  createCohereEmbedding,
  createHuggingFaceEmbedding,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  createTransformersEmbedding,
  TRANSFORMERS_MODELS,
} from './providers/presets.js';
// Resilience
export {
  CircuitBreaker,
  CircuitOpenError,
  createTimeoutSignal,
  isRetryableError,
  RateLimiter,
  Semaphore,
  withResilience,
  withRetry,
  withTimeout,
} from './resilience.js';
// Safety
export {
  containsPii,
  createPiiRedactor,
  type RedactionResult,
  redactPii,
} from './safety.js';
// Types
export type {
  ChunkingConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  EmbeddingAggregation,
  // Cache
  EmbeddingCache,
  EmbeddingCacheConfig,
  EmbeddingInputConfig,
  EmbeddingInputType,
  // Metrics
  EmbeddingMetrics,
  // Options
  EmbeddingOptions,
  // Provider interface
  EmbeddingProvider,
  // Provider configuration
  EmbeddingProviderConfig,
  // Results
  EmbeddingResult,
  EmbeddingSkipped,
  EmbeddingSource,
  EmbeddingSuccessMultiple,
  EmbeddingSuccessSingle,
  EmbedRequest,
  EmbedResponse,
  HttpEmbeddingConfig,
  OutputConfig,
  PiiRedactionConfig,
  RateLimitConfig,
  ResilienceConfig,
  ResilienceState,
  RetryConfig,
  SafetyConfig,
  // Internal types
  TextChunk,
} from './types.js';

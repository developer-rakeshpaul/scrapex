import type { ScrapedData } from '../core/types.js';
import { ScrapeError } from '../core/errors.js';
import { aggregateVectors, getDimensions } from './aggregation.js';
import { generateCacheKey, generateChecksum, getDefaultCache } from './cache.js';
import { chunkText, estimateTokens } from './chunking.js';
import { selectInput, validateInput } from './input.js';
import { getProviderCacheKey } from './providers/base.js';
import { createEmbeddingProvider } from './providers/index.js';
import { CircuitBreaker, RateLimiter, Semaphore, withResilience } from './resilience.js';
import { createPiiRedactor } from './safety.js';
import type {
  EmbeddingMetrics,
  EmbeddingOptions,
  EmbeddingProviderConfig,
  EmbeddingResult,
  EmbeddingSkipped,
  EmbeddingSource,
  EmbedResponse,
} from './types.js';

const DEFAULT_CHUNK_SIZE = 500;

/**
 * Get the effective model for embedding.
 * Prioritizes: explicit options.model > provider config model
 */
function getEffectiveModel(
  providerConfig: EmbeddingProviderConfig,
  explicitModel?: string
): string | undefined {
  // Explicit model from options always wins
  if (explicitModel) {
    return explicitModel;
  }

  // For HTTP providers, use the model from config
  if (providerConfig.type === 'http') {
    return providerConfig.config.model;
  }

  // For custom providers, return undefined to let provider fully control its default
  return undefined;
}

/**
 * Generate embeddings for scraped data.
 * This is the main entry point for the embedding pipeline.
 */
export async function generateEmbeddings(
  data: Partial<ScrapedData>,
  options: EmbeddingOptions
): Promise<EmbeddingResult> {
  const startTime = Date.now();

  try {
    // Step 1: Create or get provider
    const provider = createEmbeddingProvider(options.provider);
    const model = getEffectiveModel(options.provider, options.model);

    // Step 2: Select input text
    const rawInput = selectInput(data, options.input);
    const validation = validateInput(rawInput, options.safety?.minTextLength ?? 10);

    if (!validation.valid) {
      return createSkippedResult(validation.reason, { model });
    }

    const originalInput = validation.text;
    let inputText = validation.text;

    // Step 3: Apply PII redaction if configured
    let piiRedacted = false;
    if (options.safety?.piiRedaction) {
      const redactor = createPiiRedactor(options.safety.piiRedaction);
      const redactionResult = redactor(inputText);
      inputText = redactionResult.text;
      piiRedacted = redactionResult.redacted;
    }

    // Step 4: Check cache
    const effectiveChunking = applyMaxTokensToChunking(options.chunking, options.safety?.maxTokens);

    const cacheKey = generateCacheKey({
      providerKey: getProviderCacheKey(options.provider),
      model,
      dimensions: options.output?.dimensions,
      aggregation: options.output?.aggregation,
      input: options.input,
      chunking: effectiveChunking,
      safety: options.safety,
      cacheKeySalt: options.cache?.cacheKeySalt,
      content: inputText,
    });

    const cache = options.cache?.store ?? getDefaultCache();
    const cachedResult = await cache.get(cacheKey);

    if (cachedResult && cachedResult.status === 'success') {
      // Emit metrics for cache hit
      if (options.onMetrics) {
        options.onMetrics({
          provider: provider.name,
          model,
          inputTokens: estimateTokens(inputText),
          outputDimensions: getDimensions(
            cachedResult.aggregation === 'all' ? cachedResult.vectors : cachedResult.vector
          ),
          chunks: cachedResult.source.chunks,
          latencyMs: Date.now() - startTime,
          cached: true,
          retries: 0,
          piiRedacted,
        });
      }

      return {
        ...cachedResult,
        source: { ...cachedResult.source, cached: true },
      };
    }

    // Step 5: Chunk text
    const chunks = chunkText(inputText, effectiveChunking);
    const callbackChunks =
      options.onChunk && options.safety?.allowSensitiveCallbacks
        ? chunkText(originalInput, effectiveChunking)
        : null;

    if (chunks.length === 0) {
      return createSkippedResult('No content after chunking', { model });
    }

    // Step 6: Apply rate limiting and resilience
    const sharedState = options.resilience?.state;
    const rateLimiter =
      sharedState?.rateLimiter ??
      (options.resilience?.rateLimit ? new RateLimiter(options.resilience.rateLimit) : null);

    const circuitBreaker =
      sharedState?.circuitBreaker ??
      (options.resilience?.circuitBreaker
        ? new CircuitBreaker(options.resilience.circuitBreaker)
        : null);

    const concurrency = options.resilience?.concurrency ?? 1;
    const semaphore = sharedState?.semaphore ?? new Semaphore(concurrency);

    // Step 7: Embed chunks
    const embeddings: number[][] = [];
    let totalTokens = 0;
    let retryCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      // Wait for rate limiter
      if (rateLimiter) {
        await rateLimiter.acquire();
      }

      // Check circuit breaker
      if (circuitBreaker?.isOpen()) {
        return createSkippedResult('Circuit breaker is open', {
          model,
          chunks: i,
        });
      }

      // Process chunk with semaphore for concurrency control
      await semaphore.execute(async () => {
        const { result } = await withResilience<EmbedResponse>(
          async (signal) => {
            const response = await provider.embed([chunk.text], {
              model,
              dimensions: options.output?.dimensions,
              signal,
            });

            // Record success with circuit breaker
            if (circuitBreaker) {
              circuitBreaker.recordSuccess();
            }

            return response;
          },
          options.resilience,
          undefined, // state - not using shared state here
          {
            onRetry: () => {
              retryCount++;
              // Record failure with circuit breaker
              if (circuitBreaker) {
                circuitBreaker.recordFailure();
              }
            },
          }
        );

        // Track tokens
        if (result.usage) {
          totalTokens += result.usage.totalTokens;
        } else {
          totalTokens += chunk.tokens;
        }

        // Store embedding
        const embedding = result.embeddings[0];
        if (embedding) {
          embeddings.push(embedding);

          // Callback for progress tracking
          if (options.onChunk) {
            const callbackText = callbackChunks?.[i]?.text ?? chunk.text;
            options.onChunk(callbackText, embedding);
          }
        }
      });
    }

    // Step 8: Aggregate embeddings
    const aggregation = options.output?.aggregation ?? 'average';
    const aggregated = aggregateVectors(embeddings, aggregation);

    // Step 9: Build source metadata
    const source: EmbeddingSource = {
      model,
      chunks: chunks.length,
      tokens: totalTokens || estimateTokens(inputText),
      checksum: generateChecksum(inputText),
      cached: false,
      latencyMs: Date.now() - startTime,
    };

    // Step 10: Build result
    let result: EmbeddingResult;

    if (aggregated.type === 'single') {
      result = {
        status: 'success',
        aggregation: aggregation as 'average' | 'max' | 'first',
        vector: aggregated.vector,
        source,
      };
    } else {
      result = {
        status: 'success',
        aggregation: 'all',
        vectors: aggregated.vectors,
        source,
      };
    }

    // Step 11: Cache result
    await cache.set(cacheKey, result, {
      ttlMs: options.cache?.ttlMs,
    });

    // Step 12: Emit metrics
    if (options.onMetrics) {
      const metrics: EmbeddingMetrics = {
        provider: provider.name,
        model,
        inputTokens: source.tokens,
        outputDimensions: aggregated.dimensions,
        chunks: chunks.length,
        latencyMs: source.latencyMs,
        cached: false,
        retries: retryCount,
        piiRedacted,
      };
      options.onMetrics(metrics);
    }

    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (error instanceof ScrapeError && ['INVALID_URL', 'BLOCKED'].includes(error.code)) {
      throw error;
    }
    return createSkippedResult(reason, {
      latencyMs: Date.now() - startTime,
    });
  }
}

function applyMaxTokensToChunking(
  chunking: EmbeddingOptions['chunking'],
  maxTokens?: number
): EmbeddingOptions['chunking'] {
  if (!maxTokens || maxTokens <= 0) {
    return chunking;
  }

  const baseSize = chunking?.size ?? DEFAULT_CHUNK_SIZE;
  const baseOverlap = chunking?.overlap ?? 50;
  const clampedSize = Math.min(baseSize, maxTokens);

  // Clamp overlap to be less than the new size to prevent negative effective chunk sizes
  // Ensure at least 1 token of effective chunk size (size - overlap >= 1)
  const clampedOverlap = Math.min(baseOverlap, Math.max(0, clampedSize - 1));

  return {
    ...chunking,
    size: clampedSize,
    overlap: clampedOverlap,
  };
}

/**
 * Embed arbitrary text directly.
 * Standalone function for embedding text outside of scrape().
 */
export async function embed(text: string, options: EmbeddingOptions): Promise<EmbeddingResult> {
  // Create a minimal ScrapedData-like object
  const data: Partial<ScrapedData> = {
    textContent: text,
  };

  // Force textContent input type
  const optionsWithInput: EmbeddingOptions = {
    ...options,
    input: {
      ...options.input,
      type: 'textContent',
    },
  };

  return generateEmbeddings(data, optionsWithInput);
}

/**
 * Embed from existing ScrapedData.
 * Useful when you've already scraped and want to add embeddings later.
 */
export async function embedScrapedData(
  data: ScrapedData,
  options: EmbeddingOptions
): Promise<EmbeddingResult> {
  return generateEmbeddings(data, options);
}

/**
 * Create a skipped result with reason.
 */
function createSkippedResult(
  reason: string,
  partialSource?: Partial<EmbeddingSource>
): EmbeddingSkipped {
  return {
    status: 'skipped',
    reason,
    source: partialSource ?? {},
  };
}

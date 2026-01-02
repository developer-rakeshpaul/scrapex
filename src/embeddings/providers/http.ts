/**
 * HTTP-based Embedding Provider using native fetch.
 * Provides a unified interface for any REST-based embedding API.
 */

import { type BaseHttpConfig, BaseHttpProvider } from '../../common/http-base.js';
import { ScrapeError } from '../../core/errors.js';
import type { EmbeddingProvider, EmbedRequest, EmbedResponse } from '../types.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * HTTP embedding provider configuration.
 */
export interface HttpEmbeddingConfig<TRequest = unknown, TResponse = unknown, TError = unknown>
  extends BaseHttpConfig<TError> {
  /**
   * Build request body from input texts.
   * @default { input: texts, model }
   */
  requestBuilder?: (texts: string[], model: string) => TRequest;
  /**
   * Extract embeddings array from response.
   * @default (res) => res.data.map(d => d.embedding)
   */
  responseMapper?: (response: TResponse) => number[][];
}

// ─────────────────────────────────────────────────────────────
// HTTP Embedding Provider
// ─────────────────────────────────────────────────────────────

/**
 * HTTP-based embedding provider.
 * Works with any REST API using native fetch.
 */
export class HttpEmbeddingProvider<TRequest = unknown, TResponse = unknown, _TError = unknown>
  extends BaseHttpProvider
  implements EmbeddingProvider
{
  readonly name = 'http-embedding';

  private readonly requestBuilder: (texts: string[], model: string) => TRequest;
  private readonly responseMapper: (response: TResponse) => number[][];

  constructor(config: HttpEmbeddingConfig<TRequest, TResponse, _TError>) {
    super(config as HttpEmbeddingConfig);

    // Default request builder: OpenAI-compatible format
    this.requestBuilder =
      config.requestBuilder ??
      ((texts: string[], model: string) =>
        ({
          input: texts,
          model,
        }) as TRequest);

    // Default response mapper: OpenAI-compatible format
    this.responseMapper =
      config.responseMapper ??
      ((response: TResponse) => {
        const resp = response as Record<string, unknown>;

        // OpenAI format: { data: [{ embedding: [...] }] }
        if (Array.isArray(resp.data)) {
          return resp.data.map((item: { embedding: number[] }) => item.embedding);
        }

        // Simple format: { embeddings: [[...]] }
        if (Array.isArray(resp.embeddings)) {
          return resp.embeddings as number[][];
        }

        // Ollama format: { embedding: [...] }
        if (Array.isArray(resp.embedding)) {
          return [resp.embedding as number[]];
        }

        // HuggingFace format: [[...]]
        if (Array.isArray(response)) {
          return response as number[][];
        }

        throw new ScrapeError(
          'Unable to parse embedding response. Provide a custom responseMapper.',
          'VALIDATION_ERROR'
        );
      });
  }

  /**
   * Generate embeddings for one or more texts.
   */
  async embed(texts: string[], options: EmbedRequest): Promise<EmbedResponse> {
    const model = options.model || this.model;
    const body = this.requestBuilder(texts, model);

    const { data } = await this.fetch<TResponse>(this.baseUrl, {
      body,
      signal: options.signal,
    });

    const embeddings = this.responseMapper(data);

    // Validate embeddings count
    if (embeddings.length !== texts.length) {
      throw new ScrapeError(
        `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`,
        'VALIDATION_ERROR'
      );
    }

    return { embeddings };
  }
}

/**
 * Create a generic HTTP embedding provider.
 */
export function createHttpEmbedding<TRequest = unknown, TResponse = unknown, TError = unknown>(
  config: HttpEmbeddingConfig<TRequest, TResponse, TError>
): EmbeddingProvider {
  return new HttpEmbeddingProvider(config);
}

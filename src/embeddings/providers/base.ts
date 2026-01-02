/**
 * Embedding provider base utilities.
 * SSRF protection and HTTP utilities are now in src/common/http-base.ts
 */

import { ScrapeError } from '../../core/errors.js';
import type { EmbeddingProviderConfig, EmbedResponse } from '../types.js';

/**
 * Generate a stable cache key identifier for provider configuration.
 */
export function getProviderCacheKey(config: EmbeddingProviderConfig): string {
  switch (config.type) {
    case 'http': {
      const baseUrl = config.config.baseUrl.replace(/\/$/, '');
      return `http:${baseUrl}:${config.config.model}`;
    }
    case 'custom':
      return `custom:${config.provider.name}`;
    default: {
      const _exhaustive: never = config;
      return String(_exhaustive);
    }
  }
}

/**
 * Validate embedding response structure.
 */
export function validateEmbedResponse(response: unknown, expectedCount: number): EmbedResponse {
  if (!response || typeof response !== 'object') {
    throw new ScrapeError('Invalid embedding response: expected object', 'VALIDATION_ERROR');
  }

  const resp = response as Record<string, unknown>;

  // Check for embeddings array
  let embeddings: number[][];

  if (Array.isArray(resp.embeddings)) {
    embeddings = resp.embeddings;
  } else if (Array.isArray(resp.data)) {
    // OpenAI format: { data: [{ embedding: [...] }] }
    embeddings = resp.data.map((item: { embedding?: number[] }) => {
      if (!Array.isArray(item.embedding)) {
        throw new ScrapeError(
          'Invalid embedding response: missing embedding in data item',
          'VALIDATION_ERROR'
        );
      }
      return item.embedding;
    });
  } else if (Array.isArray(resp.embedding)) {
    // Single embedding format: { embedding: [...] }
    embeddings = [resp.embedding];
  } else {
    throw new ScrapeError(
      'Invalid embedding response: missing embeddings array',
      'VALIDATION_ERROR'
    );
  }

  // Validate count
  if (embeddings.length !== expectedCount) {
    throw new ScrapeError(
      `Embedding count mismatch: expected ${expectedCount}, got ${embeddings.length}`,
      'VALIDATION_ERROR'
    );
  }

  // Validate dimensions consistency
  if (embeddings.length > 0) {
    const firstEmbed = embeddings[0];
    if (!firstEmbed) {
      throw new ScrapeError(
        'Invalid embedding response: empty first embedding',
        'VALIDATION_ERROR'
      );
    }
    const dimensions = firstEmbed.length;
    for (let i = 1; i < embeddings.length; i++) {
      const embed = embeddings[i];
      if (!embed || embed.length !== dimensions) {
        throw new ScrapeError(
          `Embedding dimension mismatch at index ${i}: expected ${dimensions}, got ${embed?.length ?? 0}`,
          'VALIDATION_ERROR'
        );
      }
    }

    // Validate values are numbers
    for (const embedding of embeddings) {
      for (const value of embedding) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new ScrapeError(
            'Invalid embedding value: expected finite number',
            'VALIDATION_ERROR'
          );
        }
      }
    }
  }

  // Extract usage if present
  const usage = resp.usage as { prompt_tokens?: number; total_tokens?: number } | undefined;

  return {
    embeddings,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

/**
 * Get default model for a provider type.
 */
export function getDefaultModel(providerType: string): string {
  switch (providerType) {
    case 'openai':
      return 'text-embedding-3-small';
    case 'azure':
      return 'text-embedding-ada-002';
    case 'transformers':
      return 'Xenova/all-MiniLM-L6-v2';
    default:
      return 'default';
  }
}

// Note: createHeaders is available from 'src/common/http-base.ts' if needed

/**
 * Handle common API errors and convert to ScrapeError.
 */
export function handleApiError(error: unknown, providerName: string): never {
  if (error instanceof ScrapeError) {
    throw error;
  }

  if (error instanceof Error) {
    const lowerMessage = error.message.toLowerCase();

    // Check for rate limiting
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      throw new ScrapeError(`${providerName} rate limit exceeded: ${error.message}`, 'BLOCKED');
    }

    // Check for auth errors
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
      throw new ScrapeError(`${providerName} authentication failed: ${error.message}`, 'BLOCKED');
    }

    // Check for timeout
    if (lowerMessage.includes('timeout') || error.name === 'AbortError') {
      throw new ScrapeError(`${providerName} request timed out: ${error.message}`, 'TIMEOUT');
    }

    throw new ScrapeError(`${providerName} embedding failed: ${error.message}`, 'LLM_ERROR');
  }

  throw new ScrapeError(`${providerName} embedding failed: ${String(error)}`, 'LLM_ERROR');
}

/**
 * Parse error response from API.
 */
export async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json.error?.message || json.message || text;
    } catch {
      return text;
    }
  } catch {
    return `HTTP ${response.status} ${response.statusText}`;
  }
}

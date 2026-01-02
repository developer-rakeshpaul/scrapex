import { ScrapeError } from '../../core/errors.js';
import type { EmbeddingProvider, EmbeddingProviderConfig } from '../types.js';

// Re-export base utilities that are still used
export {
  getDefaultModel,
  getProviderCacheKey,
  validateEmbedResponse,
} from './base.js';
export type { HttpEmbeddingConfig } from './http.js';
// HTTP Provider (provider-agnostic)
export { createHttpEmbedding, HttpEmbeddingProvider } from './http.js';
// Preset factory functions
export {
  createAzureEmbedding,
  createCohereEmbedding,
  createHuggingFaceEmbedding,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  createTransformersEmbedding,
  TRANSFORMERS_MODELS,
} from './presets.js';

/**
 * Create an embedding provider from configuration.
 * This is the main factory function for creating providers.
 */
export async function createEmbeddingProvider(
  config: EmbeddingProviderConfig
): Promise<EmbeddingProvider> {
  switch (config.type) {
    case 'http': {
      const { createHttpEmbedding } = await import('./http.js');
      return createHttpEmbedding(config.config);
    }

    case 'custom': {
      return config.provider;
    }

    default: {
      // Exhaustive check
      const _exhaustive: never = config;
      throw new ScrapeError(
        `Unknown embedding provider type: ${(_exhaustive as { type: string }).type}`,
        'VALIDATION_ERROR'
      );
    }
  }
}

/**
 * Type guard to check if a value is an EmbeddingProvider.
 */
export function isEmbeddingProvider(value: unknown): value is EmbeddingProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'embed' in value &&
    typeof (value as EmbeddingProvider).embed === 'function'
  );
}

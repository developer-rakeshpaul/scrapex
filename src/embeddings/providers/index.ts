import { ScrapeError } from '../../core/errors.js';
import type { EmbeddingProvider, EmbeddingProviderConfig } from '../types.js';
import { createHttpEmbedding } from './http.js';

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
export function createEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  switch (config.type) {
    case 'http': {
      // Use static import - already imported at top of file
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
    typeof (value as EmbeddingProvider).name === 'string' &&
    'embed' in value &&
    typeof (value as EmbeddingProvider).embed === 'function'
  );
}

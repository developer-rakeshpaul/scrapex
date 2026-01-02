/**
 * Preset factory functions for common embedding providers.
 * All presets use the HttpEmbeddingProvider with appropriate configuration.
 */

import type { EmbeddingProvider, EmbedRequest, EmbedResponse } from '../types.js';
import { HttpEmbeddingProvider } from './http.js';

// ─────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────

/**
 * OpenAI API embedding response shape.
 */
interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Create an OpenAI embedding provider.
 *
 * @example
 * ```ts
 * const provider = createOpenAIEmbedding({ apiKey: 'sk-...' });
 * const { embeddings } = await provider.embed(['Hello'], { model: 'text-embedding-3-small' });
 * ```
 */
export function createOpenAIEmbedding(options?: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
}): EmbeddingProvider {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey option.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (options?.organization) {
    headers['OpenAI-Organization'] = options.organization;
  }

  return new HttpEmbeddingProvider<unknown, OpenAIEmbeddingResponse>({
    baseUrl: options?.baseUrl ?? 'https://api.openai.com/v1/embeddings',
    model: options?.model ?? 'text-embedding-3-small',
    headers,
    requestBuilder: (texts, model) => ({ input: texts, model }),
    responseMapper: (res) => res.data.map((item) => item.embedding),
  });
}

// ─────────────────────────────────────────────────────────────
// Azure OpenAI
// ─────────────────────────────────────────────────────────────

/**
 * Create an Azure OpenAI embedding provider.
 *
 * @example
 * ```ts
 * const provider = createAzureEmbedding({
 *   endpoint: 'https://my-resource.openai.azure.com',
 *   deploymentName: 'text-embedding-ada-002',
 *   apiVersion: '2023-05-15',
 * });
 * ```
 */
export function createAzureEmbedding(options: {
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
  apiKey?: string;
}): EmbeddingProvider {
  const apiKey = options.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Azure OpenAI API key required. Set AZURE_OPENAI_API_KEY env var or pass apiKey option.'
    );
  }

  const baseUrl = `${options.endpoint.replace(/\/$/, '')}/openai/deployments/${options.deploymentName}/embeddings?api-version=${options.apiVersion}`;

  return new HttpEmbeddingProvider<unknown, OpenAIEmbeddingResponse>({
    baseUrl,
    model: options.deploymentName,
    headers: { 'api-key': apiKey },
    requestBuilder: (texts) => ({ input: texts }),
    responseMapper: (res) => res.data.map((item) => item.embedding),
  });
}

// ─────────────────────────────────────────────────────────────
// Ollama (Local)
// ─────────────────────────────────────────────────────────────

/**
 * Ollama embedding response shape.
 */
interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Create an Ollama embedding provider for local models.
 *
 * LIMITATION: Ollama's /api/embeddings endpoint processes one text at a time,
 * not batches. When multiple chunks are embedded, each chunk triggers a
 * separate HTTP request. This is handled transparently by the pipeline's
 * sequential chunk processing, but may be slower than batch-capable providers.
 * For high-throughput scenarios, consider using OpenAI, Cohere, or HuggingFace
 * which support batch embedding in a single request.
 *
 * @example
 * ```ts
 * const provider = createOllamaEmbedding({ model: 'nomic-embed-text' });
 * ```
 */
export function createOllamaEmbedding(options?: {
  baseUrl?: string;
  model?: string;
}): EmbeddingProvider {
  return new HttpEmbeddingProvider<unknown, OllamaEmbeddingResponse>({
    baseUrl: options?.baseUrl ?? 'http://localhost:11434/api/embeddings',
    model: options?.model ?? 'nomic-embed-text',
    requireHttps: false,
    allowPrivate: true,
    requestBuilder: (texts, model) => ({ model, prompt: texts[0] }),
    responseMapper: (res) => [res.embedding],
  });
}

// ─────────────────────────────────────────────────────────────
// HuggingFace Inference
// ─────────────────────────────────────────────────────────────

/**
 * Create a HuggingFace Inference API embedding provider.
 *
 * @example
 * ```ts
 * const provider = createHuggingFaceEmbedding({
 *   model: 'sentence-transformers/all-MiniLM-L6-v2',
 * });
 * ```
 */
export function createHuggingFaceEmbedding(options: {
  model: string;
  apiKey?: string;
}): EmbeddingProvider {
  const apiKey = options.apiKey ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return new HttpEmbeddingProvider<{ inputs: string[] }, number[][]>({
    baseUrl: `https://api-inference.huggingface.co/models/${options.model}`,
    model: options.model,
    headers,
    requestBuilder: (texts) => ({ inputs: texts }),
    responseMapper: (response) => {
      // HuggingFace returns embeddings directly as array
      if (Array.isArray(response)) {
        // Check if it's a single embedding or array of embeddings
        if (Array.isArray(response[0]) && typeof response[0][0] === 'number') {
          return response;
        }
        // Single text input returns single embedding
        return [response as unknown as number[]];
      }
      throw new Error('Unexpected HuggingFace response format');
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Cohere
// ─────────────────────────────────────────────────────────────

/**
 * Cohere embedding response shape.
 */
interface CohereEmbeddingResponse {
  embeddings: number[][];
}

/**
 * Create a Cohere embedding provider.
 *
 * @example
 * ```ts
 * const provider = createCohereEmbedding({ model: 'embed-english-v3.0' });
 * ```
 */
export function createCohereEmbedding(options?: {
  apiKey?: string;
  model?: string;
}): EmbeddingProvider {
  const apiKey = options?.apiKey ?? process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('Cohere API key required. Set COHERE_API_KEY env var or pass apiKey option.');
  }

  return new HttpEmbeddingProvider<unknown, CohereEmbeddingResponse>({
    baseUrl: 'https://api.cohere.ai/v1/embed',
    model: options?.model ?? 'embed-english-v3.0',
    headers: { Authorization: `Bearer ${apiKey}` },
    requestBuilder: (texts, model) => ({
      texts,
      model,
      input_type: 'search_document',
    }),
    responseMapper: (res) => res.embeddings,
  });
}

// ─────────────────────────────────────────────────────────────
// Transformers.js (Dependency Injection)
// ─────────────────────────────────────────────────────────────

/**
 * Feature extraction pipeline type for Transformers.js
 */
type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: 'mean' | 'cls' | 'max'; normalize?: boolean }
) => Promise<{ data: Float32Array }>;

/**
 * Transformers.js module interface for dependency injection.
 */
interface TransformersModule {
  pipeline: (
    task: 'feature-extraction',
    model: string,
    options?: { quantized?: boolean }
  ) => Promise<FeatureExtractionPipeline>;
  env?: { cacheDir?: string };
}

/**
 * Create a local Transformers.js embedding provider.
 * Uses dependency injection - user provides the imported transformers module.
 *
 * @example
 * ```typescript
 * import * as transformers from '@huggingface/transformers';
 * import { createTransformersEmbedding } from 'scrapex/embeddings';
 *
 * const provider = createTransformersEmbedding(transformers, {
 *   model: 'Xenova/all-MiniLM-L6-v2',
 * });
 * ```
 *
 * Required Node.js dependencies:
 * ```
 * npm install @huggingface/transformers onnxruntime-node
 * ```
 */
export function createTransformersEmbedding(
  transformers: TransformersModule,
  options?: {
    model?: string;
    quantized?: boolean;
    pooling?: 'mean' | 'cls' | 'max';
    normalize?: boolean;
    cacheDir?: string;
  }
): EmbeddingProvider {
  let pipeline: FeatureExtractionPipeline | null = null;
  let currentModel: string | null = null;

  const config = {
    model: options?.model ?? 'Xenova/all-MiniLM-L6-v2',
    quantized: options?.quantized ?? true,
    pooling: options?.pooling ?? 'mean',
    normalize: options?.normalize ?? true,
  };

  // Set cache directory if provided
  if (options?.cacheDir && transformers.env) {
    transformers.env.cacheDir = options.cacheDir;
  }

  return {
    name: 'transformers',
    async embed(texts: string[], request: EmbedRequest): Promise<EmbedResponse> {
      const model = request.model || config.model;

      // Lazy-load pipeline (only on first use or model change)
      if (!pipeline || currentModel !== model) {
        pipeline = await transformers.pipeline('feature-extraction', model, {
          quantized: config.quantized,
        });
        currentModel = model;
      }

      const embeddings: number[][] = [];
      for (const text of texts) {
        const output = await pipeline(text, {
          pooling: config.pooling,
          normalize: config.normalize,
        });
        embeddings.push(Array.from(output.data));
      }

      return { embeddings };
    },
  };
}

/** Recommended models for Transformers.js */
export const TRANSFORMERS_MODELS = {
  /** Default - Fast, general purpose (384 dimensions, ~23MB) */
  DEFAULT: 'Xenova/all-MiniLM-L6-v2',
  /** Higher quality, more resources (768 dimensions, ~110MB) */
  QUALITY: 'Xenova/all-mpnet-base-v2',
  /** Optimized for retrieval (384 dimensions, ~33MB) */
  RETRIEVAL: 'Xenova/bge-small-en-v1.5',
  /** Multi-language support (384 dimensions, ~118MB) */
  MULTILINGUAL: 'Xenova/multilingual-e5-small',
} as const;

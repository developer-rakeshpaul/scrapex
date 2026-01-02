import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpEmbeddingProvider } from '@/embeddings/providers/http.js';
import {
  createAzureEmbedding,
  createCohereEmbedding,
  createHuggingFaceEmbedding,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  createTransformersEmbedding,
} from '@/embeddings/providers/presets.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DNS to prevent "Failed to resolve hostname" in strict mode
vi.mock('node:dns', async () => {
  return {
    promises: {
      lookup: async () => [{ address: '1.2.3.4', family: 4 }],
    },
  };
});

describe('Provider Presets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe('OpenAI', () => {
    it('should throw if no API key provided', () => {
      expect(() => createOpenAIEmbedding({})).toThrow('OpenAI API key required');
    });

    it('should use API key from env var', () => {
      vi.stubEnv('OPENAI_API_KEY', 'env-key');
      const provider = createOpenAIEmbedding();
      expect(provider).toBeInstanceOf(HttpEmbeddingProvider);
    });

    it('should configure correctly with options', async () => {
      const provider = createOpenAIEmbedding({
        apiKey: 'test-key',
        model: 'custom-model',
        organization: 'org-123',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
      });

      await provider.embed(['hello'], {});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'OpenAI-Organization': 'org-123',
          }),
          body: JSON.stringify({
            input: ['hello'],
            model: 'custom-model',
          }),
        })
      );
    });
  });

  describe('Azure OpenAI', () => {
    it('should throw if config missing', () => {
      // @ts-expect-error - testing runtime checks
      expect(() => createAzureEmbedding({})).toThrow();
    });

    it('should construct correct URL and headers', async () => {
      const provider = createAzureEmbedding({
        endpoint: 'https://my-resource.openai.azure.com',
        deploymentName: 'dep-name',
        apiVersion: '2023-05-15',
        apiKey: 'azure-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2] }],
        }),
      });

      await provider.embed(['text'], {});

      const expectedUrl =
        'https://my-resource.openai.azure.com/openai/deployments/dep-name/embeddings?api-version=2023-05-15';

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            'api-key': 'azure-key',
          }),
        })
      );
    });

    it('should respect env var for API key', () => {
      vi.stubEnv('AZURE_OPENAI_API_KEY', 'env-azure-key');
      const provider = createAzureEmbedding({
        endpoint: 'https://test.com',
        deploymentName: 'dep',
        apiVersion: 'v1',
      });
      // Should not throw
      expect(provider).toBeDefined();
    });
  });

  describe('Ollama', () => {
    it('should use default local config', async () => {
      const provider = createOllamaEmbedding();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1] }),
      });

      // Ollama preset maps batch to single request? No, HttpProvider sends all.
      // But Ollama endpoint only supports single text.
      // So we test single text success.
      await provider.embed(['t1'], {});

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"prompt":"t1"'),
        })
      );
    });

    it('should allow custom base URL', async () => {
      const provider = createOllamaEmbedding({
        baseUrl: 'http://custom-host:11434/api/embeddings',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1] }),
      });

      await provider.embed(['test'], {});

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-host:11434/api/embeddings',
        expect.anything()
      );
    });

    it('should fail if batching is attempted (current limitation)', async () => {
      const provider = createOllamaEmbedding();

      // Mock response for single item
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1] }),
      });

      // Passing 2 texts will cause mismatch because Ollama preset only sends first text
      // and returns 1 embedding. HttpProvider expects 2.
      await expect(provider.embed(['t1', 't2'], {})).rejects.toThrow('Embedding count mismatch');
    });
  });

  describe('HuggingFace', () => {
    it('should use bearer token if provided', async () => {
      const provider = createHuggingFaceEmbedding({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        apiKey: 'hf_token',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [[0.1, 0.2]],
      });

      await provider.embed(['test'], {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api-inference.huggingface.co'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer hf_token',
          }),
        })
      );
    });

    it('should handle single embedding response', async () => {
      const provider = createHuggingFaceEmbedding({ model: 'test' });

      // HF sometimes returns 1D array for single input, 2D for batch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [0.1, 0.2, 0.3], // 1D array
      });

      const result = await provider.embed(['single'], {});
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle batch embedding response', async () => {
      const provider = createHuggingFaceEmbedding({ model: 'test' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [[0.1], [0.2]], // 2D array
      });

      const result = await provider.embed(['a', 'b'], {});
      expect(result.embeddings).toHaveLength(2);
    });
  });

  describe('Cohere', () => {
    it('should throw if no API key', () => {
      expect(() => createCohereEmbedding({})).toThrow('Cohere API key required');
    });

    it('should send input_type search_document', async () => {
      vi.stubEnv('COHERE_API_KEY', 'co-key');
      const provider = createCohereEmbedding();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embeddings: [[0.1], [0.2]] }),
      });

      await provider.embed(['a', 'b'], {});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cohere.ai/v1/embed',
        expect.objectContaining({
          body: expect.stringContaining('"input_type":"search_document"'),
        })
      );
    });
  });

  describe('Transformers.js (Local)', () => {
    // Mock the transformers module
    const mockPipeline = vi.fn();
    const mockTransformers = {
      pipeline: mockPipeline,
      env: { cacheDir: '' },
    };

    it('should lazily load pipeline only on first call', async () => {
      const provider = createTransformersEmbedding(mockTransformers as any);

      expect(mockPipeline).not.toHaveBeenCalled();

      // First call
      mockPipeline.mockResolvedValue(async (_text: string) => ({
        data: new Float32Array([0.1, 0.2]),
      }));

      await provider.embed(['test'], {});
      expect(mockPipeline).toHaveBeenCalledTimes(1);

      // Second call
      await provider.embed(['test2'], {});
      expect(mockPipeline).toHaveBeenCalledTimes(1); // Should reuse
    });

    it('should reload pipeline if model changes', async () => {
      const provider = createTransformersEmbedding(mockTransformers as any);

      const extractor = vi.fn().mockResolvedValue({ data: new Float32Array([0.1]) });
      mockPipeline.mockResolvedValue(extractor);

      await provider.embed(['t1'], { model: 'model-a' });
      expect(mockPipeline).toHaveBeenCalledWith('feature-extraction', 'model-a', expect.anything());

      await provider.embed(['t1'], { model: 'model-b' });
      expect(mockPipeline).toHaveBeenCalledWith('feature-extraction', 'model-b', expect.anything());
    });

    it('should set cache directory', () => {
      createTransformersEmbedding(mockTransformers as any, { cacheDir: '/tmp/cache' });
      expect(mockTransformers.env.cacheDir).toBe('/tmp/cache');
    });
  });
});

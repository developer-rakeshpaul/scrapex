import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScrapedData } from '@/core/types.js';
import { InMemoryEmbeddingCache, resetDefaultCache } from '@/embeddings/cache.js';
import { embed, embedScrapedData, generateEmbeddings } from '@/embeddings/pipeline.js';
import type {
  EmbeddingOptions,
  EmbeddingProvider,
  EmbedRequest,
  EmbedResponse,
} from '@/embeddings/types.js';

// Mock Provider Factory
const createMockProvider = (
  response: number[][] = [[0.1, 0.2, 0.3]],
  shouldFail = false
): EmbeddingProvider => {
  return {
    name: 'mock-provider',
    embed: async (texts: string[], _options: EmbedRequest): Promise<EmbedResponse> => {
      if (shouldFail) {
        throw new Error('Provider failed');
      }
      return {
        embeddings: response,
        usage: {
          promptTokens: 10 * texts.length,
          totalTokens: 10 * texts.length,
        },
      };
    },
  };
};

// Create provider that tracks calls and returns per-chunk embeddings
const createTrackingProvider = (): {
  provider: EmbeddingProvider;
  calls: string[][];
  options: EmbedRequest[];
} => {
  const calls: string[][] = [];
  const options: EmbedRequest[] = [];
  return {
    calls,
    options,
    provider: {
      name: 'tracking-provider',
      embed: async (texts: string[], opts: EmbedRequest): Promise<EmbedResponse> => {
        calls.push([...texts]);
        options.push({ ...opts });
        return {
          embeddings: texts.map((_, i) => [i + 1, i + 2, i + 3]),
          usage: {
            promptTokens: texts.length * 10,
            totalTokens: texts.length * 10,
          },
        };
      },
    },
  };
};

describe('Embedding Pipeline', () => {
  beforeEach(() => {
    resetDefaultCache();
  });

  const mockData: Partial<ScrapedData> = {
    // ...
    url: 'https://example.com',
    textContent:
      'This is some sample content for testing the embedding pipeline. It needs to be long enough to pass minimum length checks and generate at least one chunk.',
    title: 'Sample Title',
    summary: 'Sample Summary',
  };

  describe('generateEmbeddings', () => {
    it('should generate embeddings successfully', async () => {
      const provider = createMockProvider([[1, 2, 3]]);

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        model: 'test-model',
      });

      expect(result.status).toBe('success');
      if (result.status === 'success' && result.aggregation !== 'all') {
        expect(result.aggregation).toBe('average');
        expect(result.vector).toEqual([1, 2, 3]);
        expect(result.source.model).toBe('test-model');
        expect(result.source.cached).toBe(false);
      }
    });

    it('should handle "all" aggregation', async () => {
      const provider = createMockProvider();

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        output: { aggregation: 'all' },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.aggregation).toBe('all');
        expect('vectors' in result).toBe(true);
      }
    });

    it('should skip if input text is below minTextLength', async () => {
      const shortData = { textContent: 'Short' };
      const provider = createMockProvider();

      const result = await generateEmbeddings(shortData, {
        provider: { type: 'custom', provider },
        safety: { minTextLength: 100 },
      });

      expect(result.status).toBe('skipped');
      if (result.status === 'skipped') {
        expect(result.reason).toContain('too short');
      }
    });

    it('should use PII redaction', async () => {
      const dataWithPii = {
        textContent: 'Contact me at user@example.com for more information about the project.',
      };
      const provider = createMockProvider();
      const embedSpy = vi.spyOn(provider, 'embed');

      const result = await generateEmbeddings(dataWithPii, {
        provider: { type: 'custom', provider },
        safety: { piiRedaction: { email: true } },
      });

      expect(result.status).toBe('success');
      expect(embedSpy).toHaveBeenCalled();
      const calledText = embedSpy.mock.calls[0]?.[0]?.[0];
      expect(calledText).toContain('[REDACTED]');
      expect(calledText).not.toContain('user@example.com');
    });

    it('should return cached result if available', async () => {
      const cache = new InMemoryEmbeddingCache();
      const provider = createMockProvider();
      const spy = vi.spyOn(provider, 'embed');

      const options: EmbeddingOptions = {
        provider: { type: 'custom', provider },
        model: 'cached-model',
        cache: { store: cache },
      };

      // First call - cache miss
      await generateEmbeddings(mockData, options);
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result = await generateEmbeddings(mockData, options);
      expect(spy).toHaveBeenCalledTimes(1); // Should not increase

      if (result.status === 'success') {
        expect(result.source.cached).toBe(true);
      }
    });

    it('should emit metrics', async () => {
      const provider = createMockProvider();
      const onMetrics = vi.fn();

      await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        onMetrics,
      });

      expect(onMetrics).toHaveBeenCalledTimes(1);
      expect(onMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mock-provider',
          chunks: 1,
          cached: false,
        })
      );
    });

    it('should emit progress via onChunk', async () => {
      const provider = createMockProvider();
      const onChunk = vi.fn();

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        onChunk,
      });

      expect(result.status).toBe('success');
      expect(onChunk).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      // Mock a provider that fails twice then succeeds
      let attempts = 0;
      const provider: EmbeddingProvider = {
        name: 'flaky-provider',
        embed: async () => {
          attempts++;
          if (attempts <= 2) {
            // Throw a retryable error
            const err = new Error('Request timed out') as Error & {
              code?: string;
            };
            err.code = 'ETIMEDOUT';
            throw err;
          }
          return {
            embeddings: [[0.1, 0.1, 0.1]],
            usage: { promptTokens: 10, totalTokens: 10 },
          };
        },
      };

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        resilience: {
          retry: { maxAttempts: 3, backoffMs: 1 },
        },
      });

      expect(result.status).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should handle "max" aggregation', async () => {
      const provider = createMockProvider([[1, 5, 3]]);

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        output: { aggregation: 'max' },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success' && result.aggregation !== 'all') {
        expect(result.aggregation).toBe('max');
        expect('vector' in result).toBe(true);
      }
    });

    it('should handle "first" aggregation', async () => {
      const provider = createMockProvider([[1, 2, 3]]);

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        output: { aggregation: 'first' },
      });

      expect(result.status).toBe('success');
      if (result.status === 'success' && result.aggregation !== 'all') {
        expect(result.aggregation).toBe('first');
        expect(result.vector).toEqual([1, 2, 3]);
      }
    });

    it('should use transform function for input', async () => {
      const { provider, calls } = createTrackingProvider();

      await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        input: {
          transform: (data) => `Custom: ${data.title} - ${data.summary}`,
        },
      });

      expect(calls[0]?.[0]).toContain('Custom: Sample Title - Sample Summary');
    });

    it('should use customText when type is custom', async () => {
      const { provider, calls } = createTrackingProvider();

      await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        input: {
          type: 'custom',
          customText: 'This is my custom static text for embedding.',
        },
      });

      expect(calls[0]?.[0]).toBe('This is my custom static text for embedding.');
    });

    it('should pass model to provider', async () => {
      const { provider, options } = createTrackingProvider();

      await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        model: 'custom-model-v2',
      });

      expect(options[0]?.model).toBe('custom-model-v2');
    });

    it('should pass dimensions to provider', async () => {
      const { provider, options } = createTrackingProvider();

      await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        output: { dimensions: 256 },
      });

      expect(options[0]?.dimensions).toBe(256);
    });

    it('should handle multi-chunk text with aggregation', async () => {
      // Long text that will be chunked - use repeated words for proper chunking
      const longData = {
        textContent: Array(500).fill('word').join(' '),
      };

      let callCount = 0;
      const provider: EmbeddingProvider = {
        name: 'multi-chunk-provider',
        embed: async () => {
          callCount++;
          return {
            embeddings: [[callCount, callCount * 2, callCount * 3]],
            usage: { promptTokens: 100, totalTokens: 100 },
          };
        },
      };

      const result = await generateEmbeddings(longData, {
        provider: { type: 'custom', provider },
        chunking: { size: 100, overlap: 10 }, // Small chunks to ensure multiple
        output: { aggregation: 'average' },
      });

      expect(result.status).toBe('success');
      expect(callCount).toBeGreaterThan(1);
      if (result.status === 'success') {
        expect(result.source.chunks).toBeGreaterThan(1);
      }
    });

    it('should call onChunk for each chunk', async () => {
      // Long text that will be chunked
      const longData = {
        textContent: Array(500).fill('word').join(' '),
      };

      const provider = createMockProvider([[1, 2, 3]]);
      const onChunk = vi.fn();

      await generateEmbeddings(longData, {
        provider: { type: 'custom', provider },
        chunking: { size: 100, overlap: 10 }, // Small chunks
        onChunk,
      });

      expect(onChunk.mock.calls.length).toBeGreaterThan(1);
    });

    it('should skip on empty input', async () => {
      const emptyData = { textContent: '' };
      const provider = createMockProvider();

      const result = await generateEmbeddings(emptyData, {
        provider: { type: 'custom', provider },
      });

      expect(result.status).toBe('skipped');
    });

    it('should skip on whitespace-only input', async () => {
      const whitespaceData = { textContent: '   \n\t   ' };
      const provider = createMockProvider();

      const result = await generateEmbeddings(whitespaceData, {
        provider: { type: 'custom', provider },
      });

      expect(result.status).toBe('skipped');
    });

    it('should return skipped on non-retryable provider error', async () => {
      const provider: EmbeddingProvider = {
        name: 'failing-provider',
        embed: async () => {
          throw new Error('Invalid API key');
        },
      };

      const result = await generateEmbeddings(mockData, {
        provider: { type: 'custom', provider },
        resilience: { retry: { maxAttempts: 1 } },
      });

      expect(result.status).toBe('skipped');
      if (result.status === 'skipped') {
        expect(result.reason).toContain('Invalid API key');
      }
    });

    it('should redact multiple PII types', async () => {
      const dataWithPii = {
        textContent:
          'Email: test@example.com, Phone: 555-123-4567, IP: 192.168.1.1, this text is long enough.',
      };
      const { provider, calls } = createTrackingProvider();

      await generateEmbeddings(dataWithPii, {
        provider: { type: 'custom', provider },
        safety: {
          piiRedaction: {
            email: true,
            phone: true,
            ipAddress: true,
          },
        },
      });

      const processedText = calls[0]?.[0] ?? '';
      expect(processedText).not.toContain('test@example.com');
      expect(processedText).not.toContain('555-123-4567');
      expect(processedText).not.toContain('192.168.1.1');
      expect(processedText).toContain('[REDACTED]');
    });

    it('should emit metrics with piiRedacted flag', async () => {
      const dataWithPii = {
        textContent: 'Contact: user@example.com for more details about the project.',
      };
      const provider = createMockProvider();
      const onMetrics = vi.fn();

      await generateEmbeddings(dataWithPii, {
        provider: { type: 'custom', provider },
        safety: { piiRedaction: { email: true } },
        onMetrics,
      });

      expect(onMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          piiRedacted: true,
        })
      );
    });

    it('should emit metrics on cache hit', async () => {
      const cache = new InMemoryEmbeddingCache();
      const provider = createMockProvider();
      const onMetrics = vi.fn();

      const options: EmbeddingOptions = {
        provider: { type: 'custom', provider },
        cache: { store: cache },
        onMetrics,
      };

      // First call - cache miss
      await generateEmbeddings(mockData, options);
      expect(onMetrics).toHaveBeenLastCalledWith(expect.objectContaining({ cached: false }));

      // Second call - cache hit
      await generateEmbeddings(mockData, options);
      expect(onMetrics).toHaveBeenLastCalledWith(expect.objectContaining({ cached: true }));
    });
  });

  describe('embed (standalone)', () => {
    it('should embed arbitrary text', async () => {
      const provider = createMockProvider();
      const result = await embed(
        'Hello world, this is a longer text to ensure we pass validation checks.',
        {
          provider: { type: 'custom', provider },
        }
      );

      expect(result.status).toBe('success');
    });
  });

  describe('embedScrapedData (standalone)', () => {
    it('should embed ScrapedData', async () => {
      const provider = createMockProvider();
      const result = await embedScrapedData(mockData as ScrapedData, {
        provider: { type: 'custom', provider },
        input: { type: 'title+summary' },
      });

      expect(result.status).toBe('success');
    });
  });
});

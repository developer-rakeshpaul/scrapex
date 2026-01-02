/**
 * Embeddings - Documentation Examples Validation
 *
 * Tests embedding utilities from:
 * - docs/src/content/docs/api/embeddings.mdx
 * - docs/src/content/docs/guides/embeddings.mdx
 *
 * Note: These tests validate utility functions that don't require API calls.
 * Provider-specific tests (OpenAI, Azure, etc.) require API keys.
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateVectors,
  chunkText,
  containsPii,
  cosineSimilarity,
  createAzureEmbedding,
  createCohereEmbedding,
  createHttpEmbedding,
  createHuggingFaceEmbedding,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  createPiiRedactor,
  createTransformersEmbedding,
  dotProduct,
  embed,
  embedScrapedData,
  estimateTokens,
  euclideanDistance,
  generateCacheKey,
  generateChecksum,
  generateEmbeddings,
  InMemoryEmbeddingCache,
  needsChunking,
  normalizeVector,
  redactPii,
  selectInput,
  TRANSFORMERS_MODELS,
  validateInput,
} from '@/embeddings/index.js';

describe('Embeddings Utilities (from docs/api/embeddings.mdx)', () => {
  describe('cosineSimilarity()', () => {
    it('calculates cosine similarity between vectors', () => {
      // From docs - returns 0 (orthogonal) to 1 (identical)
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);

      // Orthogonal vectors
      const c = [1, 0, 0];
      const d = [0, 1, 0];
      expect(cosineSimilarity(c, d)).toBeCloseTo(0, 5);
    });
  });

  describe('euclideanDistance()', () => {
    it('calculates Euclidean distance between vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 0, 0];
      const distance = euclideanDistance(a, b);
      expect(distance).toBeCloseTo(1, 5);

      // Same vectors
      expect(euclideanDistance(a, a)).toBeCloseTo(0, 5);
    });
  });

  describe('dotProduct()', () => {
    it('calculates dot product of two vectors', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      const product = dotProduct(a, b);
      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(product).toBe(32);
    });
  });

  describe('normalizeVector()', () => {
    it('normalizes a vector to unit length', () => {
      const vector = [3, 4]; // 3-4-5 triangle
      const normalized = normalizeVector(vector);

      // Unit vector should have magnitude 1
      const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1, 5);

      // Values should be 3/5 and 4/5
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });
  });

  describe('aggregateVectors()', () => {
    it('aggregates vectors using different strategies - documentation examples', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      // Average strategy - returns { type: 'single', vector, dimensions }
      const avgResult = aggregateVectors(vectors, 'average') as {
        type: string;
        vector: number[];
        dimensions: number;
      };
      expect(avgResult.type).toBe('single');
      expect(avgResult.vector[0]).toBeCloseTo(4, 5); // (1+4+7)/3
      expect(avgResult.vector[1]).toBeCloseTo(5, 5); // (2+5+8)/3
      expect(avgResult.vector[2]).toBeCloseTo(6, 5); // (3+6+9)/3

      // Max strategy - element-wise max
      const maxResult = aggregateVectors(vectors, 'max') as {
        type: string;
        vector: number[];
        dimensions: number;
      };
      expect(maxResult.vector[0]).toBe(7);
      expect(maxResult.vector[1]).toBe(8);
      expect(maxResult.vector[2]).toBe(9);

      // First strategy
      const firstResult = aggregateVectors(vectors, 'first') as {
        type: string;
        vector: number[];
        dimensions: number;
      };
      expect(firstResult.vector).toEqual([1, 2, 3]);

      // All strategy - returns { type: 'multiple', vectors, dimensions }
      const allResult = aggregateVectors(vectors, 'all') as {
        type: string;
        vectors: number[][];
        dimensions: number;
      };
      expect(allResult.type).toBe('multiple');
      expect(allResult.vectors.length).toBe(3);
    });
  });

  describe('InMemoryEmbeddingCache', () => {
    it('provides LRU cache functionality', async () => {
      // From docs
      const cache = new InMemoryEmbeddingCache({
        maxEntries: 100,
      });

      const mockResult = {
        status: 'success' as const,
        aggregation: 'average' as const,
        vector: [0.1, 0.2, 0.3],
        source: {
          chunks: 1,
          tokens: 10,
          checksum: 'abc123',
          cached: false,
          latencyMs: 100,
        },
      };

      // Set and get
      await cache.set('test-key', mockResult);
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(mockResult);

      // Delete
      const deleted = await cache.delete('test-key');
      expect(deleted).toBe(true);

      // Clear
      await cache.set('key1', mockResult);
      await cache.set('key2', mockResult);
      await cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
    });
  });

  describe('generateCacheKey()', () => {
    it('generates content-addressable cache keys', () => {
      const key = generateCacheKey({
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        content: 'Hello world',
      });

      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);

      // Same input should generate same key
      const key2 = generateCacheKey({
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        content: 'Hello world',
      });
      expect(key).toBe(key2);

      // Different content should generate different key
      const key3 = generateCacheKey({
        providerKey: 'openai',
        model: 'text-embedding-3-small',
        content: 'Different content',
      });
      expect(key).not.toBe(key3);
    });
  });

  describe('generateChecksum()', () => {
    it('generates SHA-256 checksum for content', () => {
      const checksum = generateChecksum('Hello world');

      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);

      // Same input should generate same checksum
      expect(generateChecksum('Hello world')).toBe(checksum);

      // Different input should generate different checksum
      expect(generateChecksum('Different')).not.toBe(checksum);
    });
  });

  describe('redactPii()', () => {
    it('redacts PII from text using default patterns', () => {
      const text = 'Contact me at john@example.com or 555-123-4567';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.redactionCount).toBeGreaterThan(0);
      expect(result.text).not.toContain('john@example.com');
      expect(result.text).not.toContain('555-123-4567');
    });
  });

  describe('createPiiRedactor()', () => {
    it('creates custom PII redactor', () => {
      // From docs
      const redactor = createPiiRedactor({
        email: true,
        phone: true,
        creditCard: false,
        ssn: false,
        ipAddress: false,
      });

      const result = redactor('Email: test@test.com, Phone: 555-123-4567');
      expect(result.text).not.toContain('test@test.com');
      expect(result.text).not.toContain('555-123-4567');
    });
  });

  describe('containsPii()', () => {
    it('checks if text contains PII', () => {
      expect(containsPii('Contact: john@example.com')).toBe(true);
      expect(containsPii('No personal info here')).toBe(false);
    });
  });

  describe('chunkText()', () => {
    it('splits text into overlapping chunks', () => {
      const longText = 'This is a long text. '.repeat(100);
      const chunks = chunkText(longText, { size: 50, overlap: 10 });

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      // Each chunk should have required properties
      for (const chunk of chunks) {
        expect(typeof chunk.text).toBe('string');
        expect(typeof chunk.startIndex).toBe('number');
        expect(typeof chunk.endIndex).toBe('number');
        expect(typeof chunk.tokens).toBe('number');
      }
    });
  });

  describe('estimateTokens()', () => {
    it('estimates token count for text', () => {
      const text = 'Hello world, this is a test sentence.';
      const count = estimateTokens(text);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('needsChunking()', () => {
    it('checks if text exceeds chunk size', () => {
      const shortText = 'Hello';
      const longText = 'This is a very long text. '.repeat(1000);

      expect(needsChunking(shortText, 500)).toBe(false);
      expect(needsChunking(longText, 500)).toBe(true);
    });
  });

  describe('selectInput()', () => {
    it('selects input text from scraped data', () => {
      const data = {
        textContent: 'This is the main text content',
        title: 'Page Title',
        description: 'Page description',
      };

      const text = selectInput(data);
      expect(typeof text).toBe('string');
      expect(text?.length).toBeGreaterThan(0);
    });

    it('supports custom input configuration', () => {
      const data = {
        textContent: 'This is the main text content',
        title: 'Page Title',
      };

      const text = selectInput(data, { type: 'textContent' });
      expect(text).toBe('This is the main text content');
    });

    it('prefers title + summary for search-friendly input', () => {
      const data = {
        title: 'Scaling Scrapers',
        summary: 'Practical patterns for reliability and cost control.',
      };

      const text = selectInput(data, { type: 'title+summary' });
      expect(text).toBe('Scaling Scrapers\n\nPractical patterns for reliability and cost control.');
    });

    it('strips markdown when falling back to content', () => {
      const data = {
        content: '# Heading\n\nSome **bold** text and a [link](https://example.com).',
      };

      const text = selectInput(data);
      expect(text).toBe('Heading\n\nSome bold text and a link.');
    });
  });

  describe('validateInput()', () => {
    it('validates input text for embedding', () => {
      // Valid input
      const valid = validateInput('Hello world, this is a test');
      expect(valid.valid).toBe(true);
      if (valid.valid) {
        expect(typeof valid.text).toBe('string');
        expect(typeof valid.wordCount).toBe('number');
        expect(typeof valid.charCount).toBe('number');
      }

      // Invalid input - empty
      const empty = validateInput('');
      expect(empty.valid).toBe(false);
      if (!empty.valid) {
        expect(typeof empty.reason).toBe('string');
      }

      // Invalid input - undefined
      const undef = validateInput(undefined);
      expect(undef.valid).toBe(false);
    });

    it('respects custom minimum length thresholds', () => {
      const shortText = 'This is too short.';
      const result = validateInput(shortText, 50);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('Input too short');
      }
    });
  });

  describe('TRANSFORMERS_MODELS', () => {
    it('exports recommended model constants', () => {
      // From docs
      expect(TRANSFORMERS_MODELS.DEFAULT).toBe('Xenova/all-MiniLM-L6-v2');
      expect(TRANSFORMERS_MODELS.QUALITY).toBe('Xenova/all-mpnet-base-v2');
      expect(TRANSFORMERS_MODELS.RETRIEVAL).toBe('Xenova/bge-small-en-v1.5');
      expect(TRANSFORMERS_MODELS.MULTILINGUAL).toBe('Xenova/multilingual-e5-small');
    });
  });
});

describe('Embeddings Type Imports (from docs)', () => {
  it('all documented functions are exported', () => {
    // Verify the module exports what the docs say
    expect(cosineSimilarity).toBeDefined();
    expect(euclideanDistance).toBeDefined();
    expect(dotProduct).toBeDefined();
    expect(normalizeVector).toBeDefined();
    expect(aggregateVectors).toBeDefined();
    expect(InMemoryEmbeddingCache).toBeDefined();
    expect(generateCacheKey).toBeDefined();
    expect(generateChecksum).toBeDefined();
    expect(redactPii).toBeDefined();
    expect(createPiiRedactor).toBeDefined();
    expect(containsPii).toBeDefined();
    expect(chunkText).toBeDefined();
    expect(estimateTokens).toBeDefined();
    expect(needsChunking).toBeDefined();
    expect(selectInput).toBeDefined();
    expect(validateInput).toBeDefined();

    // Provider factories
    expect(createOpenAIEmbedding).toBeDefined();
    expect(createAzureEmbedding).toBeDefined();
    expect(createHttpEmbedding).toBeDefined();
    expect(createOllamaEmbedding).toBeDefined();
    expect(createHuggingFaceEmbedding).toBeDefined();
    expect(createCohereEmbedding).toBeDefined();
    expect(createTransformersEmbedding).toBeDefined();

    // Main functions
    expect(embed).toBeDefined();
    expect(embedScrapedData).toBeDefined();
    expect(generateEmbeddings).toBeDefined();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createNoOpCache,
  generateCacheKey,
  generateChecksum,
  InMemoryEmbeddingCache,
  validateCachedResult,
} from '@/embeddings/cache.js';
import type { EmbeddingResult } from '@/embeddings/types.js';

describe('Embedding Cache', () => {
  describe('generateCacheKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'Hello world',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'Hello world',
      });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different content', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'World',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different providers', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'azure:https://example.openai.azure.com:2024-02-01',
        model: 'text-embedding-3-small',
        content: 'Hello',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-large',
        content: 'Hello',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different dimensions', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'model',
        dimensions: 256,
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'model',
        dimensions: 512,
        content: 'Hello',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different input configs', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        input: { type: 'textContent' },
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        input: { type: 'title+summary' },
        content: 'Hello',
      });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different safety configs', () => {
      const key1 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        safety: { piiRedaction: { email: true } },
        content: 'Hello',
      });
      const key2 = generateCacheKey({
        providerKey: 'openai:https://api.openai.com/v1',
        model: 'text-embedding-3-small',
        safety: { piiRedaction: { email: false } },
        content: 'Hello',
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('generateChecksum', () => {
    it('should generate consistent checksums', () => {
      const checksum1 = generateChecksum('Hello world');
      const checksum2 = generateChecksum('Hello world');

      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksums for different content', () => {
      const checksum1 = generateChecksum('Hello');
      const checksum2 = generateChecksum('World');

      expect(checksum1).not.toBe(checksum2);
    });

    it('should return 16 character hex string', () => {
      const checksum = generateChecksum('test');

      expect(checksum).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(checksum)).toBe(true);
    });
  });

  describe('InMemoryEmbeddingCache', () => {
    let cache: InMemoryEmbeddingCache;

    beforeEach(() => {
      cache = new InMemoryEmbeddingCache({ maxEntries: 10, ttlMs: 1000 });
    });

    const successResult: EmbeddingResult = {
      status: 'success',
      aggregation: 'average',
      vector: [0.1, 0.2, 0.3],
      source: {
        model: 'test',
        chunks: 1,
        tokens: 10,
        checksum: 'abc123',
        cached: false,
        latencyMs: 100,
      },
    };

    it('should store and retrieve values', async () => {
      await cache.set('key1', successResult);
      const result = await cache.get('key1');

      expect(result).toEqual(successResult);
    });

    it('should return undefined for missing keys', async () => {
      const result = await cache.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should delete values', async () => {
      await cache.set('key1', successResult);
      const deleted = await cache.delete('key1');
      const result = await cache.get('key1');

      expect(deleted).toBe(true);
      expect(result).toBeUndefined();
    });

    it('should clear all values', async () => {
      await cache.set('key1', successResult);
      await cache.set('key2', successResult);
      await cache.clear();

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });

    it('should evict expired entries', async () => {
      const shortTtlCache = new InMemoryEmbeddingCache({ ttlMs: 10 });
      await shortTtlCache.set('key1', successResult);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await shortTtlCache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should evict LRU entries when full', async () => {
      const smallCache = new InMemoryEmbeddingCache({ maxEntries: 2 });

      await smallCache.set('key1', successResult);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await smallCache.set('key2', successResult);
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Access key1 to make it recently used
      await smallCache.get('key1');

      // This should evict key2 (least recently used)
      await smallCache.set('key3', successResult);

      expect(await smallCache.get('key1')).toBeDefined();
      expect(await smallCache.get('key3')).toBeDefined();
    });

    it('should report stats', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.maxEntries).toBe(10);
      expect(stats.utilization).toBe(0);
    });
  });

  describe('createNoOpCache', () => {
    it('should never store or retrieve values', async () => {
      const cache = createNoOpCache();
      const result: EmbeddingResult = {
        status: 'success',
        aggregation: 'average',
        vector: [0.1],
        source: { model: 'test', chunks: 1, tokens: 1, checksum: 'x', cached: false, latencyMs: 1 },
      };

      await cache.set('key', result);
      const retrieved = await cache.get('key');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('validateCachedResult', () => {
    it('should validate skipped results', () => {
      const result: EmbeddingResult = { status: 'skipped', reason: 'test', source: {} };
      expect(validateCachedResult(result, 256)).toBe(true);
    });

    it('should validate single vector dimensions', () => {
      const result: EmbeddingResult = {
        status: 'success',
        aggregation: 'average',
        vector: [0.1, 0.2, 0.3],
        source: { model: 'test', chunks: 1, tokens: 1, checksum: 'x', cached: false, latencyMs: 1 },
      };

      expect(validateCachedResult(result, 3)).toBe(true);
      expect(validateCachedResult(result, 5)).toBe(false);
    });

    it('should validate multiple vectors dimensions', () => {
      const result: EmbeddingResult = {
        status: 'success',
        aggregation: 'all',
        vectors: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        source: { model: 'test', chunks: 2, tokens: 2, checksum: 'x', cached: false, latencyMs: 1 },
      };

      expect(validateCachedResult(result, 2)).toBe(true);
      expect(validateCachedResult(result, 3)).toBe(false);
    });
  });
});

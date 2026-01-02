import { describe, expect, it } from 'vitest';
import {
  chunkText,
  estimateTokens,
  getChunkingStats,
  heuristicTokenCount,
  needsChunking,
} from '@/embeddings/chunking.js';

describe('Chunking', () => {
  describe('heuristicTokenCount', () => {
    it('should estimate tokens as chars/4', () => {
      expect(heuristicTokenCount('hello')).toBe(2); // 5 chars / 4 = 1.25 -> 2
      expect(heuristicTokenCount('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(heuristicTokenCount('')).toBe(0);
    });
  });

  describe('chunkText', () => {
    it('should return empty array for empty text', () => {
      expect(chunkText('')).toEqual([]);
      expect(chunkText('   ')).toEqual([]);
    });

    it('should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const chunks = chunkText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.text).toBe(text);
    });

    it('should chunk long text with overlap', () => {
      // Create text that exceeds default chunk size (500 tokens ~ 2000 chars)
      const text = 'This is a sentence. '.repeat(200);
      const chunks = chunkText(text, { size: 100, overlap: 20 });

      expect(chunks.length).toBeGreaterThan(1);

      // Check chunks have content
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.tokens).toBeGreaterThan(0);
      }
    });

    it('should respect maxInputLength', () => {
      const text = 'a'.repeat(10000);
      const chunks = chunkText(text, { maxInputLength: 1000 });

      // Total text should be truncated
      const totalLength = chunks.reduce((sum, c) => sum + c.text.length, 0);
      expect(totalLength).toBeLessThanOrEqual(1000);
    });

    it('should normalize whitespace', () => {
      const text = 'Hello   world.\n\n\n\nTest.';
      const chunks = chunkText(text);

      // All whitespace is collapsed to single spaces for embedding
      expect(chunks[0]?.text).toBe('Hello world. Test.');
    });

    it('should track chunk positions', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkText(text, { size: 10, overlap: 2 });

      for (const chunk of chunks) {
        expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
      }
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'Hello world, this is a test.';
      const tokens = estimateTokens(text);

      expect(tokens).toBe(heuristicTokenCount(text));
    });
  });

  describe('needsChunking', () => {
    it('should return false for short text', () => {
      expect(needsChunking('Hello world', 100)).toBe(false);
    });

    it('should return true for long text', () => {
      const longText = 'word '.repeat(1000);
      expect(needsChunking(longText, 100)).toBe(true);
    });
  });

  describe('getChunkingStats', () => {
    it('should return stats for text', () => {
      const text = 'Hello world, this is a test message.';
      const stats = getChunkingStats(text);

      expect(stats.inputLength).toBe(text.length);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.estimatedChunks).toBeGreaterThanOrEqual(1);
      expect(stats.willTruncate).toBe(false);
    });

    it('should indicate truncation for long text', () => {
      const text = 'a'.repeat(200000);
      const stats = getChunkingStats(text);

      expect(stats.willTruncate).toBe(true);
    });
  });
});

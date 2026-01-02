import { describe, expect, it } from 'vitest';
import {
  aggregateVectors,
  cosineSimilarity,
  dotProduct,
  euclideanDistance,
  getDimensions,
  normalizeVector,
} from '@/embeddings/aggregation.js';

describe('Vector Aggregation', () => {
  describe('aggregateVectors', () => {
    it('should throw for empty array', () => {
      expect(() => aggregateVectors([])).toThrow('Cannot aggregate empty vector array');
    });

    it('should return single vector unchanged for "first" strategy', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const result = aggregateVectors(vectors, 'first');

      expect(result.type).toBe('single');
      if (result.type === 'single') {
        expect(result.vector).toEqual([1, 2, 3]);
        expect(result.dimensions).toBe(3);
      }
    });

    it('should average vectors correctly', () => {
      const vectors = [
        [1, 2, 3],
        [3, 4, 5],
      ];
      const result = aggregateVectors(vectors, 'average');

      expect(result.type).toBe('single');
      if (result.type === 'single') {
        expect(result.vector).toEqual([2, 3, 4]);
      }
    });

    it('should compute max pooling correctly', () => {
      const vectors = [
        [1, 5, 3],
        [4, 2, 6],
      ];
      const result = aggregateVectors(vectors, 'max');

      expect(result.type).toBe('single');
      if (result.type === 'single') {
        expect(result.vector).toEqual([4, 5, 6]);
      }
    });

    it('should return all vectors for "all" strategy', () => {
      const vectors = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const result = aggregateVectors(vectors, 'all');

      expect(result.type).toBe('multiple');
      if (result.type === 'multiple') {
        expect(result.vectors).toEqual(vectors);
        expect(result.dimensions).toBe(2);
      }
    });

    it('should throw for dimension mismatch', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5],
      ];
      expect(() => aggregateVectors(vectors)).toThrow('Vector dimension mismatch');
    });
  });

  describe('normalizeVector', () => {
    it('should normalize to unit length', () => {
      const vector = [3, 4]; // 3^2 + 4^2 = 25, sqrt = 5
      const normalized = normalizeVector(vector);

      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);

      // Check magnitude is 1
      const magnitude = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1);
    });

    it('should handle zero vector', () => {
      const vector = [0, 0, 0];
      const normalized = normalizeVector(vector);

      expect(normalized).toEqual([0, 0, 0]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];

      expect(cosineSimilarity(a, b)).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];

      expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];

      expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
    });

    it('should throw for dimension mismatch', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vector dimension mismatch');
    });
  });

  describe('euclideanDistance', () => {
    it('should return 0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];

      expect(euclideanDistance(a, b)).toBe(0);
    });

    it('should compute correct distance', () => {
      const a = [0, 0];
      const b = [3, 4];

      expect(euclideanDistance(a, b)).toBe(5); // 3-4-5 triangle
    });

    it('should throw for dimension mismatch', () => {
      expect(() => euclideanDistance([1, 2], [1, 2, 3])).toThrow('Vector dimension mismatch');
    });
  });

  describe('dotProduct', () => {
    it('should compute dot product correctly', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];

      expect(dotProduct(a, b)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('should throw for dimension mismatch', () => {
      expect(() => dotProduct([1, 2], [1, 2, 3])).toThrow('Vector dimension mismatch');
    });
  });

  describe('getDimensions', () => {
    it('should return length for single vector', () => {
      expect(getDimensions([1, 2, 3])).toBe(3);
    });

    it('should return dimensions for vector array', () => {
      expect(
        getDimensions([
          [1, 2],
          [3, 4],
        ])
      ).toBe(2);
    });

    it('should return 0 for empty array', () => {
      expect(getDimensions([])).toBe(0);
    });
  });
});

import type { EmbeddingAggregation } from './types.js';

/**
 * Aggregate multiple embedding vectors into a single vector or return all.
 *
 * @param vectors - Array of embedding vectors (must all have same dimensions)
 * @param strategy - Aggregation strategy
 * @returns Aggregated result based on strategy
 */
export function aggregateVectors(
  vectors: number[][],
  strategy: EmbeddingAggregation = 'average'
): AggregationResult {
  if (vectors.length === 0) {
    throw new Error('Cannot aggregate empty vector array');
  }

  // Validate all vectors have same dimensions
  const firstVector = vectors[0];
  if (!firstVector) {
    throw new Error('Cannot aggregate empty vector array');
  }

  const dimensions = firstVector.length;
  for (let i = 1; i < vectors.length; i++) {
    const vec = vectors[i];
    if (!vec || vec.length !== dimensions) {
      throw new Error(
        `Vector dimension mismatch: expected ${dimensions}, got ${vec?.length ?? 0} at index ${i}`
      );
    }
  }

  switch (strategy) {
    case 'average':
      return {
        type: 'single',
        vector: averageVectors(vectors),
        dimensions,
      };

    case 'max':
      return {
        type: 'single',
        vector: maxPoolVectors(vectors),
        dimensions,
      };

    case 'first':
      return {
        type: 'single',
        vector: firstVector,
        dimensions,
      };

    case 'all':
      return {
        type: 'multiple',
        vectors,
        dimensions,
      };

    default: {
      // Exhaustive check
      const _exhaustive: never = strategy;
      throw new Error(`Unknown aggregation strategy: ${_exhaustive}`);
    }
  }
}

/**
 * Result of vector aggregation.
 */
export type AggregationResult =
  | { type: 'single'; vector: number[]; dimensions: number }
  | { type: 'multiple'; vectors: number[][]; dimensions: number };

/**
 * Compute element-wise average of vectors.
 */
function averageVectors(vectors: number[][]): number[] {
  const first = vectors[0];
  if (!first || vectors.length === 1) {
    return first ?? [];
  }

  const dimensions = first.length;
  const count = vectors.length;
  const result: number[] = new Array<number>(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      const val = result[i];
      if (val !== undefined) {
        result[i] = val + (vector[i] ?? 0);
      }
    }
  }

  for (let i = 0; i < dimensions; i++) {
    const val = result[i];
    if (val !== undefined) {
      result[i] = val / count;
    }
  }

  return result;
}

/**
 * Compute element-wise maximum of vectors (max pooling).
 */
function maxPoolVectors(vectors: number[][]): number[] {
  const first = vectors[0];
  if (!first || vectors.length === 1) {
    return first ?? [];
  }

  const dimensions = first.length;
  const result = [...first]; // Start with copy of first vector

  for (let v = 1; v < vectors.length; v++) {
    const vec = vectors[v];
    if (!vec) continue;
    for (let i = 0; i < dimensions; i++) {
      const val = vec[i] ?? 0;
      const curr = result[i] ?? 0;
      if (val > curr) {
        result[i] = val;
      }
    }
  }

  return result;
}

/**
 * Normalize a vector to unit length (L2 normalization).
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((val) => val / magnitude);
}

/**
 * Compute cosine similarity between two vectors.
 * Both vectors should be normalized for accurate results.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dot += aVal * bVal;
    magnitudeA += aVal * aVal;
    magnitudeB += bVal * bVal;
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (magnitude === 0) {
    return 0;
  }

  return dot / magnitude;
}

/**
 * Compute euclidean distance between two vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    const diff = aVal - bVal;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compute dot product of two vectors.
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    result += aVal * bVal;
  }

  return result;
}

/**
 * Get the dimensions of a vector or set of vectors.
 */
export function getDimensions(vectors: number[] | number[][]): number {
  if (vectors.length === 0) {
    return 0;
  }

  const first = vectors[0];

  // Check if it's a single vector or array of vectors
  if (typeof first === 'number') {
    return vectors.length;
  }

  return first?.length ?? 0;
}

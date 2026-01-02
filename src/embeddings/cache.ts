import { createHash } from 'node:crypto';
import type {
  ChunkingConfig,
  EmbeddingAggregation,
  EmbeddingCache,
  EmbeddingInputConfig,
  EmbeddingResult,
  PiiRedactionConfig,
  SafetyConfig,
} from './types.js';

/**
 * Default maximum cache entries.
 */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Default TTL in milliseconds (1 hour).
 */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export interface CacheKeyParams {
  providerKey: string;
  /** Model identifier (may be undefined for custom providers) */
  model?: string;
  dimensions?: number;
  aggregation?: EmbeddingAggregation;
  input?: EmbeddingInputConfig;
  chunking?: ChunkingConfig;
  safety?: SafetyConfig;
  cacheKeySalt?: string;
  content: string;
}

/**
 * Generate a content-addressable cache key.
 * Key is based on content hash and embedding configuration.
 */
export function generateCacheKey(params: CacheKeyParams): string {
  const hash = createHash('sha256');

  const fingerprint = stableStringify({
    providerKey: params.providerKey,
    model: params.model ?? 'provider-default',
    dimensions: params.dimensions ?? 'default',
    aggregation: params.aggregation ?? 'average',
    input: serializeInputConfig(params.input),
    chunking: serializeChunkingConfig(params.chunking),
    safety: serializeSafetyConfig(params.safety),
    cacheKeySalt: params.cacheKeySalt,
  });

  hash.update(fingerprint);
  hash.update('\0'); // Separator
  hash.update(params.content);

  return hash.digest('hex');
}

/**
 * Generate a checksum for content verification.
 */
export function generateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function serializeInputConfig(config?: EmbeddingInputConfig): Record<string, unknown> | undefined {
  if (!config) return undefined;

  return normalizeObject({
    type: config.type ?? 'textContent',
    hasTransform: Boolean(config.transform),
    hasCustomText: Boolean(config.customText),
  });
}

function serializeChunkingConfig(config?: ChunkingConfig): Record<string, unknown> | undefined {
  if (!config) return undefined;

  return normalizeObject({
    size: config.size,
    overlap: config.overlap,
    tokenizer: getTokenizerId(config.tokenizer),
    maxInputLength: config.maxInputLength,
  });
}

function serializeSafetyConfig(config?: SafetyConfig): Record<string, unknown> | undefined {
  if (!config) return undefined;

  return normalizeObject({
    piiRedaction: serializePiiConfig(config.piiRedaction),
    minTextLength: config.minTextLength,
    maxTokens: config.maxTokens,
  });
}

function serializePiiConfig(config?: PiiRedactionConfig): Record<string, unknown> | undefined {
  if (!config) return undefined;

  return normalizeObject({
    email: config.email ?? false,
    phone: config.phone ?? false,
    creditCard: config.creditCard ?? false,
    ssn: config.ssn ?? false,
    ipAddress: config.ipAddress ?? false,
    customPatterns: config.customPatterns?.map((pattern) => `${pattern.source}/${pattern.flags}`),
  });
}

function getTokenizerId(tokenizer: ChunkingConfig['tokenizer']): string {
  if (!tokenizer || tokenizer === 'heuristic') {
    return 'heuristic';
  }

  if (tokenizer === 'tiktoken') {
    return 'tiktoken';
  }

  return 'custom';
}

function stableStringify(value: unknown): string {
  const normalized = normalizeValue(value);
  return stringifyNormalized(normalized);
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeValue(entry))
      .filter((entry) => entry !== undefined);
    return normalized;
  }

  if (typeof value === 'object') {
    return normalizeObject(value as Record<string, unknown>);
  }

  return value;
}

function normalizeObject(value: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    const entry = normalizeValue(value[key]);
    if (entry !== undefined) {
      normalized[key] = entry;
    }
  }

  return normalized;
}

function stringifyNormalized(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stringifyNormalized(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stringifyNormalized(obj[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

/**
 * Cache entry with metadata for LRU and TTL management.
 */
interface CacheEntry {
  value: EmbeddingResult;
  createdAt: number;
  expiresAt: number;
  accessedAt: number;
}

/**
 * In-memory LRU cache with TTL support.
 * Content-addressable: uses content hash as key, not URL.
 */
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    this.cache = new Map();
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.defaultTtlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  }

  async get(key: string): Promise<EmbeddingResult | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const now = Date.now();

    // Check TTL expiration
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access time for LRU
    entry.accessedAt = now;

    return entry.value;
  }

  async set(key: string, value: EmbeddingResult, options?: { ttlMs?: number }): Promise<void> {
    const now = Date.now();
    const ttl = options?.ttlMs ?? this.defaultTtlMs;

    // Enforce max entries with LRU eviction
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      accessedAt: now,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      expired,
      utilization: this.cache.size / this.maxEntries,
    };
  }

  /**
   * Evict expired entries.
   */
  cleanup(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestAccess) {
        oldestAccess = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Maximum allowed entries */
  maxEntries: number;
  /** Number of expired entries (not yet cleaned up) */
  expired: number;
  /** Cache utilization (0-1) */
  utilization: number;
}

/**
 * Validate that a cached result matches expected parameters.
 */
export function validateCachedResult(
  result: EmbeddingResult,
  expectedDimensions?: number
): boolean {
  if (result.status !== 'success') {
    return true; // Skipped results are always valid
  }

  if (!expectedDimensions) {
    return true; // No dimension check required
  }

  if (result.aggregation === 'all') {
    // Check first vector dimensions (all should match)
    const firstVec = result.vectors[0];
    if (!firstVec || result.vectors.length === 0) {
      return false;
    }
    return firstVec.length === expectedDimensions;
  }

  return result.vector.length === expectedDimensions;
}

/**
 * Create a no-op cache that never stores anything.
 * Useful for disabling caching while maintaining interface compatibility.
 */
export function createNoOpCache(): EmbeddingCache {
  return {
    async get(): Promise<undefined> {
      return undefined;
    },
    async set(): Promise<void> {
      // No-op
    },
    async delete(): Promise<boolean> {
      return false;
    },
    async clear(): Promise<void> {
      // No-op
    },
  };
}

/**
 * Default in-memory cache instance.
 */
let defaultCache: InMemoryEmbeddingCache | null = null;

/**
 * Get or create the default cache instance.
 */
export function getDefaultCache(): InMemoryEmbeddingCache {
  if (!defaultCache) {
    defaultCache = new InMemoryEmbeddingCache();
  }
  return defaultCache;
}

/**
 * Reset the default cache (mainly for testing).
 */
export function resetDefaultCache(): void {
  if (defaultCache) {
    defaultCache.clear();
  }
  defaultCache = null;
}

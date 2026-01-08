/**
 * scrapex
 *
 * Modern web scraper with LLM-enhanced extraction,
 * extensible pipeline, and pluggable parsers.
 */

export type {
  BlockType,
  ClassifierContext,
  ClassifierResult,
  ContentBlock,
  ContentBlockClassifier,
  NormalizationMeta,
  NormalizeOptions,
  NormalizeResult,
  TruncateStrategy,
} from './content/index.js';
// Content normalization
export {
  combineClassifiers,
  defaultBlockClassifier,
  normalizeText,
  parseBlocks,
} from './content/index.js';
// Core types and utilities
export type {
  CompletionOptions,
  ContentType,
  EnhancementType,
  ExtractedEntities,
  ExtractedLink,
  ExtractionContext,
  ExtractionSchema,
  ExtractionSchemaType,
  Extractor,
  Fetcher,
  FetchOptions,
  FetchResult,
  LLMProvider,
  ScrapedData,
  ScrapeOptions,
} from './core/index.js';
export {
  createExtractionContext,
  mergeResults,
  ScrapeError,
  type ScrapeErrorCode,
  scrape,
  scrapeHtml,
} from './core/index.js';
export type {
  ChunkingConfig,
  // Cache
  EmbeddingCache,
  EmbeddingCacheConfig,
  EmbeddingInputConfig,
  EmbeddingMetrics,
  // Options
  EmbeddingOptions,
  // Provider types
  EmbeddingProvider,
  EmbeddingProviderConfig,
  // Results
  EmbeddingResult,
  EmbeddingSkipped,
  EmbeddingSource,
  EmbeddingSuccessMultiple,
  EmbeddingSuccessSingle,
  EmbedRequest,
  EmbedResponse,
  HttpEmbeddingConfig,
  OutputConfig,
  ResilienceConfig,
  SafetyConfig,
} from './embeddings/index.js';
// Embeddings
export {
  aggregateVectors,
  // Utilities
  chunkText,
  cosineSimilarity,
  createAzureEmbedding,
  // Providers
  createEmbeddingProvider,
  createHttpEmbedding,
  createHuggingFaceEmbedding,
  createOllamaEmbedding,
  createOpenAIEmbedding,
  createPiiRedactor,
  createTransformersEmbedding,
  // Main functions
  embed,
  embedScrapedData,
  estimateTokens,
  generateEmbeddings,
  InMemoryEmbeddingCache,
  redactPii,
  TRANSFORMERS_MODELS,
} from './embeddings/index.js';
// Extractors
export {
  ContentExtractor,
  createDefaultExtractors,
  FaviconExtractor,
  JsonLdExtractor,
  LinksExtractor,
  MetaExtractor,
  sortExtractors,
} from './extractors/index.js';
// Fetchers
export {
  checkRobotsTxt,
  DEFAULT_TIMEOUT,
  DEFAULT_USER_AGENT,
  defaultFetcher,
  NativeFetcher,
  type RobotsCheckResult,
} from './fetchers/index.js';
// Parsers
export { normalizeFeedItem, RSSParser } from './parsers/index.js';
// Utilities (URL + Feed)
export {
  discoverFeeds,
  // URL utilities
  extractDomain,
  feedToMarkdown,
  feedToText,
  // Feed utilities
  fetchFeed,
  filterByDate,
  getPath,
  getProtocol,
  isExternalUrl,
  isValidUrl,
  matchesUrlPattern,
  normalizeUrl,
  paginateFeed,
  resolveUrl,
} from './utils/index.js';

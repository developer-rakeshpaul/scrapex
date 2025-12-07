/**
 * scrapex v2.0
 *
 * Modern web scraper with LLM-enhanced extraction,
 * extensible pipeline, and pluggable parsers.
 */

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
// URL utilities
export {
  extractDomain,
  getPath,
  getProtocol,
  isExternalUrl,
  isValidUrl,
  matchesUrlPattern,
  normalizeUrl,
  resolveUrl,
} from './utils/index.js';

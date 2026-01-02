import type { CheerioAPI } from 'cheerio';
import type { ContentBlock, NormalizeOptions, NormalizationMeta } from '../content/types.js';
import type { EmbeddingOptions, EmbeddingResult } from '../embeddings/types.js';

/**
 * Content type classification for scraped URLs
 */
export type ContentType =
  | 'article'
  | 'repo'
  | 'docs'
  | 'package'
  | 'video'
  | 'tool'
  | 'product'
  | 'unknown';

/**
 * Extracted link from content
 */
export interface ExtractedLink {
  url: string;
  text: string;
  isExternal: boolean;
}

/**
 * Extracted entities from LLM enhancement
 */
export interface ExtractedEntities {
  people: string[];
  organizations: string[];
  technologies: string[];
  locations: string[];
  concepts: string[];
}

/**
 * Main result of metadata scraping - optimized for LLM consumption
 */
export interface ScrapedData {
  // Identity
  url: string;
  canonicalUrl: string;
  domain: string;

  // Basic metadata
  title: string;
  description: string;
  image?: string;
  favicon?: string;

  // Content (LLM-optimized)
  content: string; // Markdown format
  textContent: string; // Plain text for lower token usage
  excerpt: string; // First ~300 chars for previews
  wordCount: number;

  // Context
  author?: string;
  publishedAt?: string; // ISO date
  modifiedAt?: string; // ISO date
  siteName?: string;
  language?: string;

  // Classification
  contentType: ContentType;
  keywords: string[];

  // Structured data
  jsonLd?: Record<string, unknown>[];

  // Links
  links?: ExtractedLink[];

  // LLM Enhancements (optional)
  summary?: string;
  suggestedTags?: string[];
  entities?: ExtractedEntities;
  extracted?: Record<string, unknown>;

  // Custom extractor results (extensibility)
  custom?: Record<string, unknown>;

  // Embeddings (optional)
  embeddings?: EmbeddingResult;

  // Normalized text (optional)
  normalizedText?: string;
  normalizationMeta?: NormalizationMeta;
  normalizedBlocks?: ContentBlock[];

  // Meta
  scrapedAt: string;
  scrapeTimeMs: number;
  error?: string; // Partial success indicator
}

/**
 * LLM enhancement types
 */
export type EnhancementType = 'summarize' | 'tags' | 'entities' | 'classify';

/**
 * Schema for structured LLM extraction
 */
export type ExtractionSchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'number[]'
  | `${string}?`; // Optional fields

export type ExtractionSchema = Record<string, ExtractionSchemaType>;

/**
 * Forward declaration for LLM provider (defined in llm/types.ts)
 */
export interface LLMProvider {
  readonly name: string;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  completeJSON<T>(prompt: string, schema: unknown): Promise<T>;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Forward declaration for Fetcher (defined in fetchers/types.ts)
 */
export interface Fetcher {
  readonly name: string;
  fetch(url: string, options: FetchOptions): Promise<FetchResult>;
}

export interface FetchOptions {
  timeout?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  headers?: Record<string, string>;
}

/**
 * Forward declaration for Extractor (defined in extractors/types.ts)
 */
export interface Extractor {
  readonly name: string;
  readonly priority?: number;
  extract(context: ExtractionContext): Promise<Partial<ScrapedData>>;
}

/**
 * Shared context passed to all extractors
 */
export interface ExtractionContext {
  // Original inputs
  url: string;
  finalUrl: string;
  html: string;

  // Cheerio instance (lightweight, always available)
  $: CheerioAPI;

  // JSDOM document (lazy-loaded, only when needed)
  getDocument(): Document;

  // Accumulated results from previous extractors
  results: Partial<ScrapedData>;

  // Options passed to scrape()
  options: ScrapeOptions;
}

/**
 * Options for scraping
 */
export interface ScrapeOptions {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** User agent string */
  userAgent?: string;

  /** Whether to extract full content (default: true) */
  extractContent?: boolean;

  /** Maximum content length in characters (default: 50000) */
  maxContentLength?: number;

  /** Custom fetcher (for Puppeteer/Playwright) */
  fetcher?: Fetcher;

  /** Custom extractors to run */
  extractors?: Extractor[];

  /** If true, only run custom extractors (replace defaults) */
  replaceDefaultExtractors?: boolean;

  /** Check robots.txt before scraping (default: false) */
  respectRobots?: boolean;

  /** LLM provider for enhancements */
  llm?: LLMProvider;

  /** LLM enhancement types to run */
  enhance?: EnhancementType[];

  /** Schema for structured LLM extraction */
  extract?: ExtractionSchema;

  /** Embedding generation options */
  embeddings?: EmbeddingOptions;

  /** Text normalization options */
  normalize?: NormalizeOptions;
}

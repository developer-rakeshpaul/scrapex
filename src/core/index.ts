// Types

// Context
export { createExtractionContext, mergeResults } from './context.js';

// Errors
export { ScrapeError, type ScrapeErrorCode } from './errors.js';
// Scrape functions
export { scrape, scrapeHtml } from './scrape.js';
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
} from './types.js';

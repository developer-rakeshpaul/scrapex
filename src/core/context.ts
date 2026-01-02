import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import type { ExtractionContext, ScrapedData, ScrapeOptions } from './types.js';

// Cached JSDOM module for lazy loading
let jsdomModule: typeof import('jsdom') | null = null;

/**
 * Preload JSDOM module (called once during scrape initialization)
 */
export async function preloadJsdom(): Promise<void> {
  if (!jsdomModule) {
    jsdomModule = await import('jsdom');
  }
}

/**
 * Create an extraction context with lazy JSDOM loading.
 *
 * Cheerio is always available for fast DOM queries.
 * JSDOM is only loaded when getDocument() is called (for Readability).
 */
export function createExtractionContext(
  url: string,
  finalUrl: string,
  html: string,
  options: ScrapeOptions
): ExtractionContext {
  // Lazy-loaded JSDOM document
  let document: Document | null = null;

  // Parse HTML with Cheerio (fast, always available)
  const $: CheerioAPI = cheerio.load(html);

  return {
    url,
    finalUrl,
    html,
    $,
    options,
    results: {},

    getDocument(): Document {
      // Use preloaded JSDOM module
      if (!document) {
        if (!jsdomModule) {
          throw new Error('JSDOM not preloaded. Call preloadJsdom() before using getDocument().');
        }
        const dom = new jsdomModule.JSDOM(html, { url: finalUrl });
        document = dom.window.document;
      }
      return document;
    },
  };
}

/**
 * Merge partial results into the context.
 * Only merges non-undefined values to prevent later extractors from
 * overwriting earlier results with undefined.
 */
export function mergeResults(
  context: ExtractionContext,
  extracted: Partial<ScrapedData>
): ExtractionContext {
  // Filter out undefined values to prevent overwriting
  const filtered: Partial<ScrapedData> = {};
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== undefined) {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }

  return {
    ...context,
    results: {
      ...context.results,
      ...filtered,
      // Merge custom fields if both exist
      custom:
        filtered.custom || context.results.custom
          ? { ...context.results.custom, ...filtered.custom }
          : undefined,
    },
  };
}

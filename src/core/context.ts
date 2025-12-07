import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import type { ExtractionContext, ScrapedData, ScrapeOptions } from './types.js';

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
      // Lazy-load JSDOM only when needed (for Readability)
      if (!document) {
        // Dynamic import to avoid loading JSDOM if not needed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { JSDOM } = require('jsdom') as typeof import('jsdom');
        const dom = new JSDOM(html, { url: finalUrl });
        document = dom.window.document;
      }
      return document;
    },
  };
}

/**
 * Merge partial results into the context
 */
export function mergeResults(
  context: ExtractionContext,
  extracted: Partial<ScrapedData>
): ExtractionContext {
  return {
    ...context,
    results: {
      ...context.results,
      ...extracted,
      // Merge custom fields if both exist
      custom:
        extracted.custom || context.results.custom
          ? { ...context.results.custom, ...extracted.custom }
          : undefined,
    },
  };
}

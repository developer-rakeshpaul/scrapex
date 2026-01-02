import { generateEmbeddings } from '@/embeddings/pipeline.js';
import { createDefaultExtractors, sortExtractors } from '@/extractors/index.js';
import { checkRobotsTxt, defaultFetcher } from '@/fetchers/index.js';
import { enhance, extract } from '@/llm/enhancer.js';
import { extractDomain, isValidUrl, normalizeUrl } from '@/utils/url.js';
import { createExtractionContext, mergeResults, preloadJsdom } from './context.js';
import { ScrapeError } from './errors.js';
import type { Extractor, ScrapedData, ScrapeOptions } from './types.js';

/**
 * Scrape a URL and extract metadata and content.
 *
 * @param url - The URL to scrape
 * @param options - Scraping options
 * @returns Scraped data with metadata and content
 *
 * @example
 * ```ts
 * const result = await scrape('https://example.com/article');
 * console.log(result.title, result.content);
 * ```
 */
export async function scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapedData> {
  const startTime = Date.now();

  // Validate URL
  if (!isValidUrl(url)) {
    throw new ScrapeError('Invalid URL provided', 'INVALID_URL');
  }

  // Normalize URL
  const normalizedUrl = normalizeUrl(url);

  // Check robots.txt if requested
  if (options.respectRobots) {
    const robotsResult = await checkRobotsTxt(normalizedUrl, options.userAgent);
    if (!robotsResult.allowed) {
      throw new ScrapeError(
        `URL blocked by robots.txt: ${robotsResult.reason || 'disallowed'}`,
        'ROBOTS_BLOCKED'
      );
    }
  }

  // Fetch the page
  const fetcher = options.fetcher ?? defaultFetcher;
  const fetchResult = await fetcher.fetch(normalizedUrl, {
    timeout: options.timeout,
    userAgent: options.userAgent,
  });

  // Preload JSDOM for content extraction (async dynamic import)
  await preloadJsdom();

  // Create extraction context
  let context = createExtractionContext(
    normalizedUrl,
    fetchResult.finalUrl,
    fetchResult.html,
    options
  );

  // Prepare extractors
  let extractors: Extractor[];
  if (options.replaceDefaultExtractors) {
    extractors = options.extractors ?? [];
  } else {
    const defaults = createDefaultExtractors();
    extractors = options.extractors ? [...defaults, ...options.extractors] : defaults;
  }

  // Sort by priority and run extractors
  extractors = sortExtractors(extractors);

  for (const extractor of extractors) {
    try {
      const extracted = await extractor.extract(context);
      context = mergeResults(context, extracted);
    } catch (error) {
      // Log error but continue with other extractors
      console.error(`Extractor "${extractor.name}" failed:`, error);
      // Store error in results
      context = mergeResults(context, {
        error: context.results.error
          ? `${context.results.error}; ${extractor.name}: ${error instanceof Error ? error.message : String(error)}`
          : `${extractor.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // Build intermediate result for LLM enhancement
  const intermediateResult: ScrapedData = {
    url: normalizedUrl,
    canonicalUrl: context.results.canonicalUrl || fetchResult.finalUrl,
    domain: extractDomain(fetchResult.finalUrl),
    title: context.results.title || '',
    description: context.results.description || '',
    image: context.results.image,
    favicon: context.results.favicon,
    content: context.results.content || '',
    textContent: context.results.textContent || '',
    excerpt: context.results.excerpt || '',
    wordCount: context.results.wordCount || 0,
    author: context.results.author,
    publishedAt: context.results.publishedAt,
    modifiedAt: context.results.modifiedAt,
    siteName: context.results.siteName,
    language: context.results.language,
    contentType: context.results.contentType || 'unknown',
    keywords: context.results.keywords || [],
    jsonLd: context.results.jsonLd,
    links: context.results.links,
    custom: context.results.custom,
    scrapedAt: new Date().toISOString(),
    scrapeTimeMs: 0,
    error: context.results.error,
  };

  // LLM Enhancement
  if (options.llm && options.enhance && options.enhance.length > 0) {
    try {
      const enhanced = await enhance(intermediateResult, options.llm, options.enhance);
      Object.assign(intermediateResult, enhanced);
    } catch (error) {
      console.error('LLM enhancement failed:', error);
      intermediateResult.error = intermediateResult.error
        ? `${intermediateResult.error}; LLM: ${error instanceof Error ? error.message : String(error)}`
        : `LLM: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // LLM Extraction
  if (options.llm && options.extract) {
    try {
      const extracted = await extract(intermediateResult, options.llm, options.extract);
      intermediateResult.extracted = extracted as Record<string, unknown>;
    } catch (error) {
      console.error('LLM extraction failed:', error);
      intermediateResult.error = intermediateResult.error
        ? `${intermediateResult.error}; LLM extraction: ${error instanceof Error ? error.message : String(error)}`
        : `LLM extraction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Embedding Generation (after LLM enhancement so summary/entities are available)
  // Note: generateEmbeddings never throws - it returns EmbeddingSkipped on errors
  if (options.embeddings) {
    intermediateResult.embeddings = await generateEmbeddings(
      intermediateResult,
      options.embeddings
    );
  }

  // Build final result with timing
  const scrapeTimeMs = Date.now() - startTime;

  const result: ScrapedData = {
    ...intermediateResult,
    scrapeTimeMs,
  };

  return result;
}

/**
 * Scrape from raw HTML string (no fetch).
 *
 * @param html - The HTML content
 * @param url - The URL (for resolving relative links)
 * @param options - Scraping options
 * @returns Scraped data with metadata and content
 *
 * @example
 * ```ts
 * const html = await fetchSomehow('https://example.com');
 * const result = await scrapeHtml(html, 'https://example.com');
 * ```
 */
export async function scrapeHtml(
  html: string,
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapedData> {
  const startTime = Date.now();

  // Validate URL
  if (!isValidUrl(url)) {
    throw new ScrapeError('Invalid URL provided', 'INVALID_URL');
  }

  const normalizedUrl = normalizeUrl(url);

  // Preload JSDOM for content extraction (async dynamic import)
  await preloadJsdom();

  // Create extraction context
  let context = createExtractionContext(normalizedUrl, normalizedUrl, html, options);

  // Prepare extractors
  let extractors: Extractor[];
  if (options.replaceDefaultExtractors) {
    extractors = options.extractors ?? [];
  } else {
    const defaults = createDefaultExtractors();
    extractors = options.extractors ? [...defaults, ...options.extractors] : defaults;
  }

  // Sort by priority and run extractors
  extractors = sortExtractors(extractors);

  for (const extractor of extractors) {
    try {
      const extracted = await extractor.extract(context);
      context = mergeResults(context, extracted);
    } catch (error) {
      console.error(`Extractor "${extractor.name}" failed:`, error);
      context = mergeResults(context, {
        error: context.results.error
          ? `${context.results.error}; ${extractor.name}: ${error instanceof Error ? error.message : String(error)}`
          : `${extractor.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const domain = extractDomain(normalizedUrl);

  // Build intermediate result
  const intermediateResult: ScrapedData = {
    url: normalizedUrl,
    canonicalUrl: context.results.canonicalUrl || normalizedUrl,
    domain,
    title: context.results.title || '',
    description: context.results.description || '',
    image: context.results.image,
    favicon: context.results.favicon,
    content: context.results.content || '',
    textContent: context.results.textContent || '',
    excerpt: context.results.excerpt || '',
    wordCount: context.results.wordCount || 0,
    author: context.results.author,
    publishedAt: context.results.publishedAt,
    modifiedAt: context.results.modifiedAt,
    siteName: context.results.siteName,
    language: context.results.language,
    contentType: context.results.contentType || 'unknown',
    keywords: context.results.keywords || [],
    jsonLd: context.results.jsonLd,
    links: context.results.links,
    summary: context.results.summary,
    suggestedTags: context.results.suggestedTags,
    entities: context.results.entities,
    extracted: context.results.extracted,
    custom: context.results.custom,
    scrapedAt: new Date().toISOString(),
    scrapeTimeMs: 0,
    error: context.results.error,
  };

  // LLM Enhancement
  if (options.llm && options.enhance && options.enhance.length > 0) {
    try {
      const enhanced = await enhance(intermediateResult, options.llm, options.enhance);
      Object.assign(intermediateResult, enhanced);
    } catch (error) {
      console.error('LLM enhancement failed:', error);
      intermediateResult.error = intermediateResult.error
        ? `${intermediateResult.error}; LLM: ${error instanceof Error ? error.message : String(error)}`
        : `LLM: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // LLM Extraction
  if (options.llm && options.extract) {
    try {
      const extracted = await extract(intermediateResult, options.llm, options.extract);
      intermediateResult.extracted = extracted as Record<string, unknown>;
    } catch (error) {
      console.error('LLM extraction failed:', error);
      intermediateResult.error = intermediateResult.error
        ? `${intermediateResult.error}; LLM extraction: ${error instanceof Error ? error.message : String(error)}`
        : `LLM extraction: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Embedding Generation (after LLM enhancement so summary/entities are available)
  // Note: generateEmbeddings never throws - it returns EmbeddingSkipped on errors
  if (options.embeddings) {
    intermediateResult.embeddings = await generateEmbeddings(
      intermediateResult,
      options.embeddings
    );
  }

  // Build final result with timing
  const scrapeTimeMs = Date.now() - startTime;

  const result: ScrapedData = {
    ...intermediateResult,
    scrapeTimeMs,
  };

  return result;
}

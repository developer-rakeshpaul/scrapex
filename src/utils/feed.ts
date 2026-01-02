import * as cheerio from 'cheerio';
import { defaultFetcher } from '../fetchers/fetch.js';
import type { Fetcher } from '../fetchers/types.js';
import { RSSParser, type RSSParserOptions } from '../parsers/rss.js';
import type { FeedItem, FeedMeta, ParsedFeed, ParserResult } from '../parsers/types.js';

/**
 * Fetch and parse an RSS/Atom feed from a URL.
 * Uses scrapex's fetcher infrastructure for consistent behavior.
 */
export async function fetchFeed(
  url: string,
  options?: {
    fetcher?: Fetcher;
    timeout?: number;
    userAgent?: string;
    parserOptions?: RSSParserOptions;
  }
): Promise<ParserResult<ParsedFeed, FeedMeta>> {
  const fetcher = options?.fetcher || defaultFetcher;

  const result = await fetcher.fetch(url, {
    timeout: options?.timeout,
    userAgent: options?.userAgent,
    allowedContentTypes: [
      'application/rss+xml',
      'application/atom+xml',
      'application/rdf+xml',
      'application/xml',
      'text/xml',
      'text/html', // Some feeds are served as HTML incorrectly
    ],
  });

  const parser = new RSSParser(options?.parserOptions);
  return parser.parse(result.html, url);
}

/**
 * Detect RSS/Atom feed URLs from HTML.
 * Supports RSS, Atom, and RDF feed types.
 */
export function discoverFeeds(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const feeds: string[] = [];
  const seen = new Set<string>();

  // Selector for all feed types
  const selector = [
    'link[type="application/rss+xml"]',
    'link[type="application/atom+xml"]',
    'link[type="application/rdf+xml"]',
    'link[rel="alternate"][type*="xml"]',
  ].join(', ');

  $(selector).each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const resolved = new URL(href, baseUrl).href;
        if (!seen.has(resolved)) {
          seen.add(resolved);
          feeds.push(resolved);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return feeds;
}

/**
 * Filter feed items by date range.
 * Items without publishedAt are included by default.
 */
export function filterByDate(
  items: FeedItem[],
  options: { after?: Date; before?: Date; includeUndated?: boolean }
): FeedItem[] {
  const { after, before, includeUndated = true } = options;

  return items.filter((item) => {
    if (!item.publishedAt) {
      return includeUndated;
    }

    const date = new Date(item.publishedAt);
    if (after && date < after) return false;
    if (before && date > before) return false;
    return true;
  });
}

/**
 * Convert feed items to markdown for LLM consumption.
 * Uses ISO 8601 date format for consistency across environments.
 */
export function feedToMarkdown(
  feed: ParsedFeed,
  options?: {
    includeContent?: boolean;
    maxItems?: number;
  }
): string {
  const { includeContent = false, maxItems } = options || {};
  const lines = [`# ${feed.title}`, ''];

  if (feed.description) {
    lines.push(feed.description, '');
  }

  const items = maxItems ? feed.items.slice(0, maxItems) : feed.items;

  for (const item of items) {
    lines.push(`## ${item.title}`);

    if (item.publishedAt) {
      // Use ISO date format for consistency (YYYY-MM-DD)
      const date = item.publishedAt.split('T')[0];
      lines.push(`*${date}*`);
    }

    lines.push('');

    if (includeContent && item.content) {
      lines.push(item.content);
    } else if (item.description) {
      lines.push(item.description);
    }

    if (item.link) {
      lines.push(`[Read more](${item.link})`, '');
    } else {
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Extract plain text from feed items for LLM processing.
 * Concatenates title, description, and content.
 */
export function feedToText(
  feed: ParsedFeed,
  options?: {
    maxItems?: number;
    separator?: string;
  }
): string {
  const { maxItems, separator = '\n\n---\n\n' } = options || {};
  const items = maxItems ? feed.items.slice(0, maxItems) : feed.items;

  return items
    .map((item) => {
      const parts = [item.title];
      if (item.description) parts.push(item.description);
      if (item.content) parts.push(item.content);
      return parts.join('\n\n');
    })
    .join(separator);
}

/**
 * Paginate through a feed using rel="next" links (RFC 5005).
 * Returns an async generator that yields each page.
 */
export async function* paginateFeed(
  url: string,
  options?: {
    fetcher?: Fetcher;
    timeout?: number;
    userAgent?: string;
    maxPages?: number;
  }
): AsyncGenerator<ParsedFeed, void, unknown> {
  const { maxPages = 10, ...fetchOptions } = options || {};
  let currentUrl: string | undefined = url;
  let pageCount = 0;

  while (currentUrl && pageCount < maxPages) {
    const result = await fetchFeed(currentUrl, fetchOptions);
    yield result.data;

    currentUrl = result.data.next;
    pageCount++;
  }
}

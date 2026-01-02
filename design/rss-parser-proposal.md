# RSS/Atom Parser Proposal for scrapex

## Overview

Add a built-in RSS/Atom parser to `scrapex/parsers` that handles RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 feeds. This enables scraping and processing syndication feeds with the same ergonomics as the existing Markdown parser, fully integrated with the `scrapex` fetcher infrastructure.

## Motivation

1. **Common use case** - RSS feeds are ubiquitous for content aggregation, monitoring, and LLM pipelines
2. **LLM-ready** - Feed items are already structured, ideal for summarization and classification
3. **Robust Infrastructure** - Leverages `scrapex`'s existing fetcher logic (timeouts, headers, proxies)
4. **No new dependencies** - Uses Cheerio (already a dependency) with `{ xml: true }` mode
5. **Consistency** - Follows existing `SourceParser` patterns

## Proposed API

### Fetcher Updates (`src/fetchers/types.ts`)

To support feeds, `FetchOptions` needs to allow non-HTML content types.

```typescript
export interface FetchOptions {
  // ... existing options
  /**
   * Allowed MIME types.
   * Defaults to HTML/XHTML if undefined.
   */
  allowedContentTypes?: string[];
}
```

**Required Change in `NativeFetcher`:**
Refactor the content-type check to respect `allowedContentTypes` if provided, otherwise default to existing HTML checks.

### Types (`src/parsers/types.ts`)

```typescript
/**
 * RSS/Atom feed item
 */
export interface FeedItem {
  id: string;                    // guid (RSS) or id (Atom)
  title: string;
  link: string;                  // Resolved absolute URL (fallback to id if URL, else empty)
  description?: string;          // summary/description (plain text)
  content?: string;              // full content if available (plain text)
  author?: string;
  publishedAt?: string;          // ISO 8601 date or undefined (never raw strings)
  rawPublishedAt?: string;       // Original date string for debugging/manual parsing
  updatedAt?: string;            // ISO 8601 date or undefined (Atom)
  categories: string[];          // Filtered, no empty strings
  enclosure?: FeedEnclosure;     // podcast/media support
  customFields?: Record<string, string>; // Extracted custom namespace fields
}

/**
 * Media enclosure (podcasts, videos)
 */
export interface FeedEnclosure {
  url: string;                   // Resolved absolute URL
  type?: string;                 // MIME type
  length?: number;               // bytes
}

/**
 * Parsed feed structure
 */
export interface ParsedFeed {
  format: "rss2" | "rss1" | "atom";
  title: string;
  description?: string;
  link: string;                  // Resolved absolute URL
  next?: string;                 // Pagination link (RFC 5005 / Atom rel="next")
  language?: string;
  lastBuildDate?: string;        // ISO 8601 date or undefined
  copyright?: string;            // Channel copyright/rights
  items: FeedItem[];
  customFields?: Record<string, string>; // Extracted custom namespace fields
}

/**
 * Feed metadata
 */
export interface FeedMeta {
  generator?: string;
  ttl?: number;                  // refresh interval in minutes
  image?: {
    url: string;                 // Resolved absolute URL
    title?: string;
    link?: string;
  };
  categories?: string[];
}
```

### Parser Class (`src/parsers/rss.ts`)

```typescript
import * as cheerio from "cheerio";
import type {
  FeedEnclosure,
  FeedItem,
  FeedMeta,
  ParsedFeed,
  ParserResult,
  SourceParser,
} from "./types.js";

export interface RSSParserOptions {
  /**
   * Map of custom field names to CSS selectors or XML tag names.
   * Useful for extracting podcast/media namespace fields.
   * @example { duration: "itunes\\:duration", rating: "media\\:rating" }
   */
  customFields?: Record<string, string>;
}

/**
 * RSS/Atom feed parser.
 * Supports RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 formats.
 *
 * @example
 * ```ts
 * import { RSSParser } from "scrapex/parsers";
 *
 * const parser = new RSSParser();
 * const result = parser.parse(feedXml, "https://example.com/feed.xml");
 *
 * console.log(result.data.title);
 * console.log(result.data.items);
 * ```
 *
 * @example Custom fields extraction
 * ```ts
 * const parser = new RSSParser({
 *   customFields: {
 *     duration: "itunes\\:duration",
 *     explicit: "itunes\\:explicit",
 *   },
 * });
 * const result = parser.parse(podcastXml, url);
 * console.log(result.data.items[0].customFields?.duration);
 * ```
 */
export class RSSParser implements SourceParser<ParsedFeed, FeedMeta> {
  readonly name = "rss";
  private customFields: Record<string, string>;

  constructor(options?: RSSParserOptions) {
    this.customFields = options?.customFields || {};
  }

  canParse(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      lower.includes("<rss") ||
      lower.includes("<feed") ||
      lower.includes("<rdf:rdf")
    );
  }

  parse(content: string, url?: string): ParserResult<ParsedFeed, FeedMeta> {
    // Cheerio's xml: true mode disables HTML entities and structure fixes,
    // effectively preventing many XSS/injection vectors during parsing.
    const $ = cheerio.load(content, { xml: true });

    // Detect format and parse
    if ($("feed").length > 0) {
      return this.parseAtom($, url);
    } else if ($("rdf\\:RDF, RDF").length > 0) {
      return this.parseRSS1($, url);
    } else {
      return this.parseRSS2($, url);
    }
  }

  private parseRSS2(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const channel = $("channel");
    const feedLink = channel.find("> link").text();
    const resolveBase = baseUrl || feedLink;

    const items: FeedItem[] = $("item")
      .map((_, el) => {
        const $item = $(el);
        const itemLink = $item.find("link").text();
        const guid = $item.find("guid").text();
        const pubDate = $item.find("pubDate").text();

        // Resolve link with fallback to guid if it's a URL
        const resolvedLink = this.resolveLink(itemLink, guid, resolveBase);

        return {
          id: guid || itemLink,
          title: $item.find("title").text(),
          link: resolvedLink,
          description: this.parseText($item.find("description")),
          content: this.parseText($item.find("content\\:encoded")),
          author:
            $item.find("author").text() ||
            $item.find("dc\\:creator").text() ||
            undefined,
          publishedAt: this.parseDate(pubDate),
          rawPublishedAt: pubDate || undefined,
          categories: this.parseCategories(
            $item
              .find("category")
              .map((_, c) => $(c).text())
              .get()
          ),
          enclosure: this.parseEnclosure($item.find("enclosure"), resolveBase),
          customFields: this.extractCustomFields($item),
        };
      })
      .get();

    return {
      data: {
        format: "rss2",
        title: channel.find("> title").text(),
        description: channel.find("> description").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        language: channel.find("> language").text() || undefined,
        lastBuildDate: this.parseDate(channel.find("> lastBuildDate").text()),
        copyright: channel.find("> copyright").text() || undefined,
        items,
        customFields: this.extractCustomFields(channel),
      },
      meta: {
        generator: channel.find("> generator").text() || undefined,
        ttl: this.parseNumber(channel.find("> ttl").text()),
        image: this.parseImage(channel.find("> image"), resolveBase),
        categories: this.parseCategories(
          channel
            .find("> category")
            .map((_, c) => $(c).text())
            .get()
        ),
      },
    };
  }

  private parseAtom(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const feed = $("feed");
    const feedLink =
      feed.find('> link[rel="alternate"], > link:not([rel])').attr("href") ||
      "";
    const nextLink = feed.find('> link[rel="next"]').attr("href");
    const resolveBase = baseUrl || feedLink;

    const items: FeedItem[] = $("entry")
      .map((_, el) => {
        const $entry = $(el);
        const entryLink =
          $entry.find('link[rel="alternate"], link:not([rel])').attr("href") ||
          "";
        const entryId = $entry.find("id").text();
        const published = $entry.find("published").text();
        const updated = $entry.find("updated").text();

        // Resolve link with fallback to id if it's a URL
        const resolvedLink = this.resolveLink(entryLink, entryId, resolveBase);

        return {
          id: entryId,
          title: $entry.find("title").text(),
          link: resolvedLink,
          description: this.parseText($entry.find("summary")),
          content: this.parseText($entry.find("content")),
          author: $entry.find("author name").text() || undefined,
          publishedAt: this.parseDate(published),
          rawPublishedAt: published || updated || undefined,
          updatedAt: this.parseDate(updated),
          categories: this.parseCategories(
            $entry
              .find("category")
              .map((_, c) => $(c).attr("term"))
              .get()
          ),
          customFields: this.extractCustomFields($entry),
        };
      })
      .get();

    return {
      data: {
        format: "atom",
        title: feed.find("> title").text(),
        description: feed.find("> subtitle").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        next: nextLink ? this.resolveUrl(nextLink, resolveBase) : undefined,
        language: feed.attr("xml:lang") || undefined,
        lastBuildDate: this.parseDate(feed.find("> updated").text()),
        copyright: feed.find("> rights").text() || undefined,
        items,
        customFields: this.extractCustomFields(feed),
      },
      meta: {
        generator: feed.find("> generator").text() || undefined,
        image: this.parseAtomImage(feed, resolveBase),
        categories: this.parseCategories(
          feed
            .find("> category")
            .map((_, c) => $(c).attr("term"))
            .get()
        ),
      },
    };
  }

  private parseRSS1(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const channel = $("channel");
    const feedLink = channel.find("link").text();
    const resolveBase = baseUrl || feedLink;

    // RSS 1.0 items are siblings of channel, not children
    const items: FeedItem[] = $("item")
      .map((_, el) => {
        const $item = $(el);
        const itemLink = $item.find("link").text();
        const rdfAbout = $item.attr("rdf:about") || "";
        const dcDate = $item.find("dc\\:date").text();

        // Resolve link with fallback to rdf:about
        const resolvedLink = this.resolveLink(itemLink, rdfAbout, resolveBase);

        // Extract dc:subject as categories (RSS 1.0 uses Dublin Core)
        const dcSubjects = $item
          .find("dc\\:subject")
          .map((_, s) => $(s).text())
          .get();

        return {
          id: rdfAbout || itemLink,
          title: $item.find("title").text(),
          link: resolvedLink,
          description: this.parseText($item.find("description")),
          content: this.parseText($item.find("content\\:encoded")),
          author: $item.find("dc\\:creator").text() || undefined,
          publishedAt: this.parseDate(dcDate),
          rawPublishedAt: dcDate || undefined,
          categories: this.parseCategories(dcSubjects),
          customFields: this.extractCustomFields($item),
        };
      })
      .get();

    // Parse RDF image element (sibling of channel)
    const rdfImage = $("image");
    const imageUrl =
      rdfImage.find("url").text() || rdfImage.attr("rdf:resource");

    return {
      data: {
        format: "rss1",
        title: channel.find("title").text(),
        description: channel.find("description").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        language: channel.find("dc\\:language").text() || undefined,
        lastBuildDate: this.parseDate(channel.find("dc\\:date").text()),
        copyright: channel.find("dc\\:rights").text() || undefined,
        items,
        customFields: this.extractCustomFields(channel),
      },
      meta: {
        generator:
          channel.find("admin\\:generatorAgent").attr("rdf:resource") ||
          undefined,
        image: imageUrl
          ? {
              url: this.resolveUrl(imageUrl, resolveBase),
              title: rdfImage.find("title").text() || undefined,
              link:
                this.resolveUrl(rdfImage.find("link").text(), resolveBase) ||
                undefined,
            }
          : undefined,
        categories: this.parseCategories(
          channel
            .find("dc\\:subject")
            .map((_, s) => $(s).text())
            .get()
        ),
      },
    };
  }

  /**
   * Extract custom fields from an element using configured selectors.
   */
  private extractCustomFields(
    $el: cheerio.Cheerio<cheerio.Element>
  ): Record<string, string> | undefined {
    if (Object.keys(this.customFields).length === 0) return undefined;

    const fields: Record<string, string> = {};
    for (const [key, selector] of Object.entries(this.customFields)) {
      const value = $el.find(selector).text().trim();
      if (value) {
        fields[key] = value;
      }
    }

    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  /**
   * Parse date string to ISO 8601 format.
   * Returns undefined if parsing fails (never returns raw strings).
   */
  private parseDate(dateStr: string): string | undefined {
    if (!dateStr?.trim()) return undefined;

    try {
      const date = new Date(dateStr);
      // Check for invalid date
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Parse element text content, returning undefined if empty.
   */
  private parseText(
    $el: cheerio.Cheerio<cheerio.Element>
  ): string | undefined {
    const text = $el.text().trim();
    return text || undefined;
  }

  /**
   * Parse categories/tags, filtering out empty strings.
   */
  private parseCategories(categories: (string | undefined)[]): string[] {
    return categories
      .map((c) => c?.trim())
      .filter((c): c is string => !!c && c.length > 0);
  }

  /**
   * Resolve a URL against a base URL.
   * Only allows https scheme; all other schemes are rejected.
   */
  private resolveUrl(url: string, base?: string): string {
    if (!url?.trim()) return "";

    try {
      const resolved = base ? new URL(url, base) : new URL(url);
      return resolved.protocol === "https:" ? resolved.href : "";
    } catch {
      return "";
    }
  }

  /**
   * Resolve link with fallback to id/guid if primary link is empty and id is a URL.
   * Only allows https scheme; all other schemes are rejected.
   */
  private resolveLink(
    primaryLink: string,
    fallbackId: string,
    base?: string
  ): string {
    // Try primary link first
    if (primaryLink?.trim()) {
      return this.resolveUrl(primaryLink, base);
    }

    // Fallback to id if it looks like a URL
    if (fallbackId?.trim()) {
      try {
        const resolvedId = new URL(fallbackId);
        return resolvedId.protocol === "https:" ? resolvedId.href : "";
      } catch {
        // Not a valid URL, try resolving against base
        return this.resolveUrl(fallbackId, base);
      }
    }

    return "";
  }

  /**
   * Parse enclosure element with URL resolution.
   */
  private parseEnclosure(
    $enc: cheerio.Cheerio<cheerio.Element>,
    baseUrl?: string
  ): FeedEnclosure | undefined {
    const url = $enc.attr("url");
    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
      type: $enc.attr("type") || undefined,
      length: this.parseNumber($enc.attr("length")),
    };
  }

  /**
   * Parse RSS image element with URL resolution.
   */
  private parseImage(
    $img: cheerio.Cheerio<cheerio.Element>,
    baseUrl?: string
  ): FeedMeta["image"] | undefined {
    const url = $img.find("url").text();
    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
      title: $img.find("title").text() || undefined,
      link: this.resolveUrl($img.find("link").text(), baseUrl) || undefined,
    };
  }

  /**
   * Parse Atom logo/icon element with URL resolution.
   */
  private parseAtomImage(
    $feed: cheerio.Cheerio<cheerio.Element>,
    baseUrl?: string
  ): FeedMeta["image"] | undefined {
    const logo = $feed.find("> logo").text();
    const icon = $feed.find("> icon").text();
    const url = logo || icon;

    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
    };
  }

  /**
   * Parse a string to number, returning undefined if invalid.
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }
}
```

### Utility Functions (`src/utils/feed.ts`)

Feed utilities are placed in `src/utils/feed.ts` to maintain separation of concerns:
- **Parser** (`src/parsers/rss.ts`): Pure parsing logic, no I/O
- **Utilities** (`src/utils/feed.ts`): I/O operations using fetcher infrastructure

This follows the existing pattern where parsers are stateless transformers and utilities handle orchestration.

```typescript
import * as cheerio from "cheerio";
import { defaultFetcher } from "../fetchers/fetch.js";
import type { Fetcher } from "../fetchers/types.js";
import type { FeedItem, FeedMeta, ParsedFeed, ParserResult } from "../parsers/types.js";
import { RSSParser, type RSSParserOptions } from "../parsers/rss.js";

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
      "application/rss+xml",
      "application/atom+xml",
      "application/rdf+xml",
      "application/xml",
      "text/xml",
      "text/html", // Some feeds are served as HTML incorrectly
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
  ].join(", ");

  $(selector).each((_, el) => {
    const href = $(el).attr("href");
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
  const lines = [`# ${feed.title}`, ""];

  if (feed.description) {
    lines.push(feed.description, "");
  }

  const items = maxItems ? feed.items.slice(0, maxItems) : feed.items;

  for (const item of items) {
    lines.push(`## ${item.title}`);

    if (item.publishedAt) {
      // Use ISO date format for consistency (YYYY-MM-DD)
      const date = item.publishedAt.split("T")[0];
      lines.push(`*${date}*`);
    }

    lines.push("");

    if (includeContent && item.content) {
      lines.push(item.content);
    } else if (item.description) {
      lines.push(item.description);
    }

    lines.push(`[Read more](${item.link})`, "");
  }

  return lines.join("\n");
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
  const { maxItems, separator = "\n\n---\n\n" } = options || {};
  const items = maxItems ? feed.items.slice(0, maxItems) : feed.items;

  return items
    .map((item) => {
      const parts = [item.title];
      if (item.description) parts.push(item.description);
      if (item.content) parts.push(item.content);
      return parts.join("\n\n");
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
```

### Exports

#### Parser Exports (`src/parsers/index.ts`)

```typescript
// RSS parser (pure parsing, no I/O)
export { RSSParser } from "./rss.js";
export type { RSSParserOptions } from "./rss.js";

export type {
  FeedItem,
  FeedEnclosure,
  ParsedFeed,
  FeedMeta,
} from "./types.js";
```

#### Utility Exports (`src/utils/index.ts`)

```typescript
// Feed utilities (I/O operations)
export {
  fetchFeed,
  discoverFeeds,
  filterByDate,
  feedToMarkdown,
  feedToText,
  paginateFeed,
} from "./feed.js";
```

#### Main Package Export (`src/index.ts`)

```typescript
// Re-export for convenience
export { RSSParser } from "./parsers/index.js";
export {
  fetchFeed,
  discoverFeeds,
  filterByDate,
  feedToMarkdown,
  feedToText,
  paginateFeed,
} from "./utils/index.js";
```

## Usage Examples

> **Import Options**: Examples below use subpath imports (`scrapex/parsers`, `scrapex/utils`) for clarity.
> All exports are also available from the main package: `import { RSSParser, fetchFeed } from "scrapex";`

### Basic Parsing

```typescript
import { RSSParser } from "scrapex/parsers";

const parser = new RSSParser();
// Pass URL for relative link resolution
const result = parser.parse(feedXml, "https://example.com/feed.xml");

console.log(result.data.title);        // "My Blog"
console.log(result.data.items.length); // 10
console.log(result.data.copyright);    // "Copyright 2025"
```

### Fetch and Parse

```typescript
import { fetchFeed } from "scrapex/utils";

const feed = await fetchFeed("https://example.com/feed.xml");

for (const item of feed.data.items) {
  // publishedAt is always ISO format or undefined
  console.log(`${item.title} - ${item.publishedAt}`);

  // rawPublishedAt available for debugging
  if (!item.publishedAt && item.rawPublishedAt) {
    console.warn(`Could not parse date: ${item.rawPublishedAt}`);
  }
}
```

### Podcast/Custom Namespace Fields

```typescript
import { RSSParser } from "scrapex/parsers";
import { fetchFeed } from "scrapex/utils";

// Extract iTunes podcast fields
const parser = new RSSParser({
  customFields: {
    duration: "itunes\\:duration",
    explicit: "itunes\\:explicit",
    episode: "itunes\\:episode",
    season: "itunes\\:season",
  },
});

const result = parser.parse(podcastXml, url);

for (const episode of result.data.items) {
  console.log(`Episode: ${episode.title}`);
  console.log(`Duration: ${episode.customFields?.duration}`);
  console.log(`Season ${episode.customFields?.season}, Ep ${episode.customFields?.episode}`);
}
```

### Pagination (Atom rel="next")

```typescript
import { paginateFeed } from "scrapex/utils";

// Iterate through all pages of a paginated feed
for await (const page of paginateFeed("https://example.com/feed.xml", { maxPages: 5 })) {
  console.log(`Page: ${page.title}`);
  console.log(`Items: ${page.items.length}`);
  console.log(`Next: ${page.next || "none"}`);
}
```

### Discover Feeds from a Page

```typescript
import { scrape } from "scrapex";
import { discoverFeeds, fetchFeed } from "scrapex/utils";

// Scrape a page and find its feeds (RSS, Atom, and RDF)
const page = await scrape("https://example.com");
const feedUrls = discoverFeeds(page.rawHtml, page.url);

// Parse the first feed
if (feedUrls.length > 0) {
  const feed = await fetchFeed(feedUrls[0]);
  console.log(feed.data.items);
}
```

### LLM Integration

```typescript
import { fetchFeed, feedToMarkdown, feedToText } from "scrapex/utils";
import { createOpenAI } from "scrapex/llm";

const feed = await fetchFeed("https://example.com/feed.xml");

// Option 1: Markdown format (structured)
const markdown = feedToMarkdown(feed.data, { maxItems: 5 });

// Option 2: Plain text (lower tokens)
const text = feedToText(feed.data, { maxItems: 5 });

const llm = createOpenAI({ apiKey: "sk-..." });
const summary = await llm.complete({
  prompt: `Summarize these articles:\n\n${markdown}`,
});
```

### Date Filtering

```typescript
import { fetchFeed, filterByDate } from "scrapex/utils";

const feed = await fetchFeed("https://example.com/feed.xml");

// Get items from the last 7 days
const recentItems = filterByDate(feed.data.items, {
  after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  includeUndated: false, // Exclude items without dates
});
```

## Security & Best Practices

### 1. XML External Entity (XXE) Attacks

We use `cheerio` with `{ xml: true }` configuration. Under the hood, this uses `htmlparser2`, which by default **does not** load external entities or DTDs. This protects against file disclosure and SSRF attacks via malicious XML feeds.

**Mitigation**: Do not enable `xmlMode` with options that might allow DTD processing if the underlying parser library changes.

### 2. Content Injection (XSS)

Feed content (description, body) often contains HTML.

**Risk**: A malicious feed could include `<script>` tags or `javascript:` links.

**Mitigation**: The `RSSParser` returns plain text content by default.
- `feedToMarkdown` and `feedToText` use text content, which is safe for LLM consumption.
- If HTML content is needed in the future, consumers **must** sanitize it (e.g., using `dompurify`) before rendering in a browser.
- We explicitly do *not* include raw HTML to avoid accidental XSS vulnerabilities.

### 3. Character Encoding

The core `NativeFetcher` relies on `fetch`'s text decoding (UTF-8).

**Limitation**: XML feeds using other encodings (e.g., ISO-8859-1) without proper `Content-Type` headers may have encoding errors.

**Resolution**: Since `scrapex` targets modern web scraping, we assume UTF-8 or proper headers. Users with legacy feeds should use a custom `Fetcher` that handles `ArrayBuffer` decoding if necessary.

## Implementation Plan

### Phase 1: Fetcher Support
- Update `src/fetchers/types.ts` to include `allowedContentTypes`
- Update `src/fetchers/fetch.ts` to respect this option

### Phase 2: Parser Implementation
- Add new types to `src/parsers/types.ts`
- Implement `RSSParser` class with all features
- Add unit tests for all formats + pagination links

### Phase 3: Utilities & Integration
- Add `fetchFeed`, `paginateFeed` utilities using the updated fetcher
- Add `discoverFeeds`, `filterByDate`, `feedToMarkdown`, `feedToText`
- Add integration tests with real-world feed examples

## File Structure

```
src/
├── index.ts          # Re-exports for convenience
├── fetchers/
│   ├── types.ts      # Add allowedContentTypes to FetchOptions
│   └── fetch.ts      # Update to respect allowedContentTypes
├── parsers/
│   ├── index.ts      # Parser exports (RSSParser, types)
│   ├── types.ts      # Add FeedItem, ParsedFeed, FeedMeta, FeedEnclosure
│   ├── rss.ts        # NEW: RSSParser class (pure parsing, no I/O)
│   ├── markdown.ts   # Existing
│   └── github.ts     # Existing
└── utils/
    ├── index.ts      # Utility exports
    └── feed.ts       # NEW: Feed utilities (fetchFeed, discoverFeeds, etc.)

test/
├── parsers/
│   ├── rss.test.ts   # Unit tests for RSS parser
│   └── fixtures/
│       ├── rss2-basic.xml
│       ├── rss2-content-encoded.xml
│       ├── rss2-enclosures.xml
│       ├── rss2-itunes.xml
│       ├── rss1-rdf.xml
│       ├── rss1-dc-elements.xml
│       ├── atom-basic.xml
│       ├── atom-pagination.xml
│       ├── atom-unsafe-links.xml
│       └── atom-relative-links.xml
└── utils/
    └── feed.test.ts  # Integration tests for feed utilities
```

### Design Rationale

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `RSSParser` | `src/parsers/rss.ts` | Pure parsing logic, transforms XML string → structured data |
| `fetchFeed` | `src/utils/feed.ts` | I/O orchestration using fetcher infrastructure |
| `paginateFeed` | `src/utils/feed.ts` | Async iteration over paginated feeds |
| `discoverFeeds` | `src/utils/feed.ts` | HTML parsing to find feed URLs |
| `filterByDate` | `src/utils/feed.ts` | Post-processing utility |
| `feedToMarkdown` | `src/utils/feed.ts` | Output formatting for LLMs |

This separation ensures:
1. **Testability**: Parser can be unit tested without mocking fetch
2. **Reusability**: Parser works with any string source (file, cache, network)
3. **Consistency**: Utilities use the same fetcher infrastructure as `scrape()`

## Test Coverage

Tests should cover:

1. **RSS 2.0**
   - Basic channel and item parsing
   - `content:encoded` extraction
   - `dc:creator` author fallback
   - Enclosure parsing (podcasts)
   - Category extraction
   - Relative URL resolution
   - Copyright extraction
   - Custom fields (iTunes namespace)

2. **RSS 1.0 (RDF)**
   - RDF namespace handling (`rdf:about`, `rdf:resource`)
   - Dublin Core elements (`dc:date`, `dc:creator`, `dc:subject`, `dc:language`, `dc:rights`)
   - Items as siblings of channel (not children)
   - `admin:generatorAgent` for generator

3. **Atom 1.0**
   - Entry parsing with `id`, `published`, `updated`
   - Link resolution (`rel="alternate"`, default rel)
   - Pagination (`rel="next"`) - RFC 5005
   - Category `term` attribute extraction
   - Subtitle as description
   - Rights as copyright

4. **Edge Cases**
   - Invalid dates return `undefined` (with `rawPublishedAt` preserved)
   - Relative URLs resolved correctly
   - Non-https URLs are dropped (javascript/data/file blocked)
   - Empty categories filtered
   - Missing optional fields handled
   - Malformed XML doesn't throw
   - Link fallback to guid/id when link is empty

5. **Utilities**
   - `discoverFeeds` finds all feed types
   - `filterByDate` with `includeUndated` option
   - `feedToMarkdown` uses ISO dates
   - `paginateFeed` respects `maxPages`
   - `feedToMarkdown` never emits non-https links

## Acceptance Criteria

- [x] `RSSParser` class implementing `SourceParser<ParsedFeed, FeedMeta>`
- [x] Full support for RSS 2.0, RSS 1.0 (RDF), and Atom 1.0
- [x] `fetchFeed()` utility using scrapex fetcher infrastructure
- [x] `discoverFeeds()` for finding feed URLs in HTML (RSS, Atom, RDF)
- [x] `feedToMarkdown()` for LLM-ready output with ISO dates
- [x] `feedToText()` for plain text extraction
- [x] `paginateFeed()` for RFC 5005 pagination
- [x] URL resolution for all links and enclosures
- [x] Only https URLs emitted (non-https dropped)
- [x] Link fallback to guid/id when primary link is empty
- [x] `rawPublishedAt` for debugging unparseable dates
- [x] `copyright` extraction from all feed formats
- [x] `next` pagination link extraction (Atom)
- [x] `customFields` for namespace extension extraction
- [x] Date parsing returns ISO 8601 or undefined (type-safe)
- [x] Category filtering (no empty strings)
- [x] Full TypeScript types exported
- [x] XXE safe by default (Cheerio xml mode)
- [x] `allowedContentTypes` in fetcher for non-HTML content
- [x] Unit tests for each format with fixtures
- [x] Documentation in README

## Review Findings Addressed

| Finding | Severity | Resolution |
|---------|----------|------------|
| parseRSS1 stubbed out | Critical | Fully implemented with RDF namespace handling, Dublin Core elements |
| fetchFeed bypasses fetcher infrastructure | Critical | Uses `defaultFetcher` with `allowedContentTypes` |
| parseDate returns raw strings | High | Returns `undefined` on parse failure; `rawPublishedAt` preserves original |
| Relative URLs not resolved | High | All URLs resolved using base URL from `parse(content, url)` |
| Non-https URLs allowed | High | `resolveUrl` and `resolveLink` enforce https-only URLs |
| Atom content loses HTML | Medium | Simplified to plain text only (safer); HTML support deferred |
| Empty categories included | Medium | `parseCategories()` filters out falsy/empty values |
| toLocaleDateString non-deterministic | Medium | Uses ISO 8601 format (`YYYY-MM-DD`) in `feedToMarkdown()` |
| fetchFeed in wrong location | Medium | Moved to `src/utils/feed.ts` for separation of concerns |
| Character encoding limitation | Low | Documented in Security section; custom Fetcher for legacy feeds |
| XXE attack prevention | Low | Documented; Cheerio xml mode doesn't process DTDs |

## Enhancements Added

| Enhancement | Description |
|-------------|-------------|
| `rawPublishedAt` | Preserves original date string for debugging when ISO parsing fails |
| `copyright` | Extracts copyright/rights from all feed formats |
| `next` pagination | Supports RFC 5005 Atom pagination via `rel="next"` |
| `customFields` | Extensible extraction of namespace fields (iTunes, Media RSS, etc.) |
| `paginateFeed()` | Async generator for iterating through paginated feeds |
| Fetcher integration | Uses scrapex's `defaultFetcher` with `allowedContentTypes` |
| Link fallback | Falls back to guid/id as link when primary link is empty |
| URL scheme allowlist | Only https URLs are emitted; unsafe schemes dropped |
| Security docs | Documented XXE, XSS, and encoding considerations |
| Separation of concerns | Parser in `src/parsers/`, utilities in `src/utils/` |

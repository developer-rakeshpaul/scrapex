# scrapex

Modern web scraper with LLM-enhanced extraction, extensible pipeline, and pluggable parsers.

> **Beta Release**: v1.0.0 is currently in beta. The API is stable but minor changes may occur before the stable release.

## Features

- **LLM-Ready Output** - Content extracted as Markdown, optimized for AI/LLM consumption
- **Provider-Agnostic LLM** - Works with OpenAI, Anthropic, Ollama, LM Studio, or any OpenAI-compatible API
- **Extensible Pipeline** - Pluggable extractors with priority-based execution
- **Smart Extraction** - Uses Mozilla Readability for content, Cheerio for metadata
- **Markdown Parsing** - Parse markdown content, awesome lists, and GitHub repos
- **RSS/Atom Feeds** - Parse RSS 2.0, RSS 1.0 (RDF), and Atom feeds with pagination support
- **TypeScript First** - Full type safety with comprehensive type exports
- **Dual Format** - ESM and CommonJS builds

## Installation

```bash
npm install scrapex@beta
```

### Optional Peer Dependencies

```bash
# For LLM features
npm install openai           # OpenAI/Ollama/LM Studio
npm install @anthropic-ai/sdk  # Anthropic Claude

# For JavaScript-rendered pages
npm install puppeteer
```

## Quick Start

```typescript
import { scrape } from 'scrapex';

const result = await scrape('https://example.com/article');

console.log(result.title);       // "Article Title"
console.log(result.content);     // Markdown content
console.log(result.textContent); // Plain text (lower tokens)
console.log(result.excerpt);     // First ~300 chars
```

## API Reference

### `scrape(url, options?)`

Fetch and extract metadata and content from a URL.

```typescript
import { scrape } from 'scrapex';

const result = await scrape('https://example.com', {
  timeout: 10000,
  userAgent: 'MyBot/1.0',
  extractContent: true,
  maxContentLength: 50000,
  respectRobots: false,
});
```

### `scrapeHtml(html, url, options?)`

Extract from raw HTML without fetching.

```typescript
import { scrapeHtml } from 'scrapex';

const html = await fetchSomehow('https://example.com');
const result = await scrapeHtml(html, 'https://example.com');
```

### Result Object (`ScrapedData`)

```typescript
interface ScrapedData {
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
  content: string;      // Markdown format
  textContent: string;  // Plain text
  excerpt: string;      // ~300 char preview
  wordCount: number;

  // Context
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
  siteName?: string;
  language?: string;

  // Classification
  contentType: 'article' | 'repo' | 'docs' | 'package' | 'video' | 'tool' | 'product' | 'unknown';
  keywords: string[];

  // Structured data
  jsonLd?: Record<string, unknown>[];
  links?: ExtractedLink[];

  // LLM Enhancements (when enabled)
  summary?: string;
  suggestedTags?: string[];
  entities?: ExtractedEntities;
  extracted?: Record<string, unknown>;

  // Meta
  scrapedAt: string;
  scrapeTimeMs: number;
  error?: string;
}
```

## LLM Integration

### Using OpenAI

```typescript
import { scrape } from 'scrapex';
import { createOpenAI } from 'scrapex/llm';

const llm = createOpenAI({ apiKey: 'sk-...' });

const result = await scrape('https://example.com/article', {
  llm,
  enhance: ['summarize', 'tags', 'entities', 'classify'],
});

console.log(result.summary);       // AI-generated summary
console.log(result.suggestedTags); // ['javascript', 'web', ...]
console.log(result.entities);      // { people: [], organizations: [], ... }
```

### Using Anthropic Claude

```typescript
import { AnthropicProvider } from 'scrapex/llm';

const llm = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-haiku-20241022', // or 'claude-sonnet-4-20250514'
});

const result = await scrape(url, { llm, enhance: ['summarize'] });
```

### Using Ollama (Local)

```typescript
import { createOllama } from 'scrapex/llm';

const llm = createOllama({ model: 'llama3.2' });

const result = await scrape(url, { llm, enhance: ['summarize'] });
```

### Using LM Studio (Local)

```typescript
import { createLMStudio } from 'scrapex/llm';

const llm = createLMStudio({ model: 'local-model' });

const result = await scrape(url, { llm, enhance: ['summarize'] });
```

### Structured Extraction

Extract specific data using a schema:

```typescript
const result = await scrape('https://example.com/product', {
  llm,
  extract: {
    productName: 'string',
    price: 'number',
    features: 'string[]',
    inStock: 'boolean',
    sku: 'string?', // optional
  },
});

console.log(result.extracted);
// { productName: "Widget", price: 29.99, features: [...], inStock: true }
```

## Custom Extractors

Create custom extractors to add domain-specific extraction logic:

```typescript
import { scrape, type Extractor, type ExtractionContext } from 'scrapex';

const recipeExtractor: Extractor = {
  name: 'recipe',
  priority: 60, // Higher = runs earlier

  async extract(context: ExtractionContext) {
    const { $ } = context;

    return {
      custom: {
        ingredients: $('.ingredients li').map((_, el) => $(el).text()).get(),
        cookTime: $('[itemprop="cookTime"]').attr('content'),
        servings: $('[itemprop="recipeYield"]').text(),
      },
    };
  },
};

const result = await scrape('https://example.com/recipe', {
  extractors: [recipeExtractor],
});

console.log(result.custom?.ingredients);
```

### Replacing Default Extractors

```typescript
const result = await scrape(url, {
  replaceDefaultExtractors: true,
  extractors: [myCustomExtractor],
});
```

## Markdown Parsing

Parse markdown content:

```typescript
import { MarkdownParser, extractListLinks, groupByCategory } from 'scrapex/parsers';

// Parse any markdown
const parser = new MarkdownParser();
const result = parser.parse(markdownContent);

console.log(result.data.title);
console.log(result.data.sections);
console.log(result.data.links);
console.log(result.data.codeBlocks);

// Extract links from markdown lists and group by category
const links = extractListLinks(markdownContent);
const grouped = groupByCategory(links);

grouped.forEach((categoryLinks, category) => {
  console.log(`${category}: ${categoryLinks.length} links`);
});
```

### GitHub Utilities

```typescript
import {
  isGitHubRepo,
  parseGitHubUrl,
  toRawUrl,
} from 'scrapex/parsers';

isGitHubRepo('https://github.com/owner/repo');
// true

parseGitHubUrl('https://github.com/facebook/react');
// { owner: 'facebook', repo: 'react' }

toRawUrl('https://github.com/owner/repo');
// 'https://raw.githubusercontent.com/owner/repo/main/README.md'
```

## RSS/Atom Feed Parsing

Parse RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 feeds:

```typescript
import { RSSParser } from 'scrapex';

const parser = new RSSParser();
const result = parser.parse(feedXml, 'https://example.com/feed.xml');

console.log(result.data.format);  // 'rss2' | 'rss1' | 'atom'
console.log(result.data.title);   // Feed title
console.log(result.data.items);   // Array of feed items
```

### Feed Item Structure

```typescript
interface FeedItem {
  id: string;
  title: string;
  link: string;
  description?: string;
  content?: string;
  author?: string;
  publishedAt?: string;      // ISO 8601
  rawPublishedAt?: string;   // Original date string
  updatedAt?: string;        // Atom only
  categories: string[];
  enclosure?: FeedEnclosure; // Podcast/media attachments
  customFields?: Record<string, string>;
}
```

### Fetching and Parsing Feeds

```typescript
import { fetchFeed, paginateFeed } from 'scrapex';

// Fetch and parse in one call
const result = await fetchFeed('https://example.com/feed.xml');
console.log(result.data.items);

// Paginate through feeds with rel="next" links (Atom)
for await (const page of paginateFeed('https://example.com/atom')) {
  console.log(`Page with ${page.data.items.length} items`);
}
```

### Discovering Feeds in HTML

```typescript
import { discoverFeeds } from 'scrapex';

const html = await fetch('https://example.com').then(r => r.text());
const feedUrls = discoverFeeds(html, 'https://example.com');
// ['https://example.com/feed.xml', 'https://example.com/atom.xml']
```

### Filtering by Date

```typescript
import { RSSParser, filterByDate } from 'scrapex';

const parser = new RSSParser();
const result = parser.parse(feedXml);

const recentItems = filterByDate(result.data.items, {
  after: new Date('2024-01-01'),
  before: new Date('2024-12-31'),
  includeUndated: false,
});
```

### Converting to Markdown/Text

```typescript
import { RSSParser, feedToMarkdown, feedToText } from 'scrapex';

const parser = new RSSParser();
const result = parser.parse(feedXml);

// Convert to markdown (great for LLM consumption)
const markdown = feedToMarkdown(result.data, { maxItems: 10 });

// Convert to plain text
const text = feedToText(result.data);
```

### Custom Fields (Podcast/Media)

Extract custom namespace fields like iTunes podcast tags:

```typescript
const parser = new RSSParser({
  customFields: {
    duration: 'itunes\\:duration',
    explicit: 'itunes\\:explicit',
    rating: 'media\\:rating',
  },
});

const result = parser.parse(podcastXml);
const item = result.data.items[0];

console.log(item.customFields?.duration);  // '10:00'
console.log(item.customFields?.explicit);  // 'no'
```

### Security

The RSS parser enforces strict URL security:

- **HTTPS-only URLs (RSS parser only)**: The RSS/Atom parser (`RSSParser`) resolves all links to HTTPS only. Non-HTTPS URLs (http, javascript, data, file) are rejected and returned as empty strings. This is specific to feed parsing to prevent malicious links in untrusted feeds.
- **XML Mode**: Feeds are parsed with Cheerio's `{ xml: true }` mode, which disables HTML entity processing and prevents XSS vectors.

> **Note**: The public URL utilities (`resolveUrl`, `isValidUrl`, etc.) accept both `http:` and `https:` URLs. Protocol-relative URLs (e.g., `//example.com/path`) are resolved against the base URL's protocol by the standard `URL` constructor.

## URL Utilities

```typescript
import {
  isValidUrl,
  normalizeUrl,
  extractDomain,
  resolveUrl,
  isExternalUrl,
} from 'scrapex';

isValidUrl('https://example.com');
// true

normalizeUrl('https://example.com/page?utm_source=twitter');
// 'https://example.com/page' (tracking params removed)

extractDomain('https://www.example.com/path');
// 'example.com'

resolveUrl('/path', 'https://example.com/page');
// 'https://example.com/path'

isExternalUrl('https://other.com', 'example.com');
// true
```

## Error Handling

```typescript
import { scrape, ScrapeError } from 'scrapex';

try {
  const result = await scrape('https://example.com');
} catch (error) {
  if (error instanceof ScrapeError) {
    console.log(error.code);       // 'FETCH_FAILED' | 'TIMEOUT' | 'INVALID_URL' | ...
    console.log(error.statusCode); // HTTP status if available
    console.log(error.isRetryable()); // true for network errors
  }
}
```

Error codes:
- `FETCH_FAILED` - Network request failed
- `TIMEOUT` - Request timed out
- `INVALID_URL` - URL is malformed
- `BLOCKED` - Access denied (403)
- `NOT_FOUND` - Page not found (404)
- `ROBOTS_BLOCKED` - Blocked by robots.txt
- `PARSE_ERROR` - HTML parsing failed
- `LLM_ERROR` - LLM provider error
- `VALIDATION_ERROR` - Schema validation failed

## Robots.txt

```typescript
import { scrape, checkRobotsTxt } from 'scrapex';

// Check before scraping
const check = await checkRobotsTxt('https://example.com/path');
if (check.allowed) {
  const result = await scrape('https://example.com/path');
}

// Or let scrape() handle it
const result = await scrape('https://example.com/path', {
  respectRobots: true, // Throws if blocked
});
```

## Built-in Extractors

| Extractor | Priority | Description |
|-----------|----------|-------------|
| `MetaExtractor` | 100 | OG, Twitter, meta tags |
| `JsonLdExtractor` | 80 | JSON-LD structured data |
| `ContentExtractor` | 50 | Readability + Turndown |
| `FaviconExtractor` | 40 | Favicon discovery |
| `LinksExtractor` | 30 | Content link extraction |

## Configuration

### Options

```typescript
interface ScrapeOptions {
  timeout?: number;              // Default: 10000ms
  userAgent?: string;            // Custom user agent
  extractContent?: boolean;      // Default: true
  maxContentLength?: number;     // Default: 50000 chars
  fetcher?: Fetcher;             // Custom fetcher
  extractors?: Extractor[];      // Additional extractors
  replaceDefaultExtractors?: boolean;
  respectRobots?: boolean;       // Check robots.txt
  llm?: LLMProvider;             // LLM provider
  enhance?: EnhancementType[];   // LLM enhancements
  extract?: ExtractionSchema;    // Structured extraction
}
```

### Enhancement Types

```typescript
type EnhancementType =
  | 'summarize'  // Generate summary
  | 'tags'       // Extract keywords/tags
  | 'entities'   // Extract named entities
  | 'classify';  // Classify content type
```

## Requirements

- Node.js 20+
- TypeScript 5.0+ (for type imports)

## License

MIT

## Author

Rakesh Paul - [binaryroute](https://binaryroute.com/authors/rk-paul/)

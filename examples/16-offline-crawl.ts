/**
 * 16-offline-crawl.ts
 *
 * Demonstrates a fully offline crawl using a custom Fetcher and scrapex's built-in
 * link extraction + URL utilities.
 *
 * Why this example exists:
 * - Shows how to plug a custom fetcher into `scrape()`
 * - Makes examples deterministic (no network required)
 * - Demonstrates link filtering, normalization, and a simple breadth-first crawl
 *
 * Run: npx tsx examples/16-offline-crawl.ts
 */

import {
  ScrapeError,
  type Fetcher,
  type FetchOptions,
  type FetchResult,
  normalizeUrl,
  scrape,
} from '../src/index.js';

type SiteFixture = Record<string, string>;

class MapFetcher implements Fetcher {
  readonly name = 'map-fetcher';

  constructor(private readonly fixtures: SiteFixture) {}

  async fetch(url: string, _options: FetchOptions = {}): Promise<FetchResult> {
    const normalized = normalizeUrl(url);
    const html = this.fixtures[normalized];
    if (!html) {
      throw new ScrapeError(`Fixture not found for URL: ${normalized}`, 'NOT_FOUND', 404);
    }

    return {
      html,
      finalUrl: normalized,
      statusCode: 200,
      contentType: 'text/html; charset=utf-8',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
  }
}

const FIXTURES: SiteFixture = {
  'https://local.test/': `
    <!doctype html>
    <html>
      <head>
        <title>Home</title>
        <meta name="description" content="A tiny offline site for scrapex examples." />
      </head>
      <body>
        <article>
          <h1>Home</h1>
          <p>Welcome. Follow the links to crawl the site.</p>
          <p>
            <a href="/about">About</a>
            <a href="/docs/getting-started">Docs</a>
            <a href="https://external.example.com">External Link</a>
          </p>
        </article>
      </body>
    </html>
  `,
  'https://local.test/about': `
    <!doctype html>
    <html>
      <head>
        <title>About</title>
        <meta name="description" content="About this offline fixture site." />
      </head>
      <body>
        <main>
          <h1>About</h1>
          <p>This page links back to <a href="/">Home</a> and to <a href="/docs">Docs</a>.</p>
        </main>
      </body>
    </html>
  `,
  'https://local.test/docs': `
    <!doctype html>
    <html>
      <head>
        <title>Docs</title>
        <meta name="description" content="Documentation index." />
      </head>
      <body>
        <article>
          <h1>Docs</h1>
          <p>Start here: <a href="/docs/getting-started">Getting Started</a></p>
          <p>Back: <a href="/">Home</a></p>
        </article>
      </body>
    </html>
  `,
  'https://local.test/docs/getting-started': `
    <!doctype html>
    <html>
      <head>
        <title>Getting Started</title>
        <meta name="description" content="Getting started guide." />
      </head>
      <body>
        <article>
          <h1>Getting Started</h1>
          <p>This page exists to show link extraction and crawling.</p>
          <p>Next: <a href="/docs/advanced">Advanced</a></p>
          <p>Back: <a href="/docs">Docs</a></p>
        </article>
      </body>
    </html>
  `,
  'https://local.test/docs/advanced': `
    <!doctype html>
    <html>
      <head>
        <title>Advanced</title>
        <meta name="description" content="Advanced guide." />
      </head>
      <body>
        <article>
          <h1>Advanced</h1>
          <p>This is the last page in our tiny offline crawl.</p>
          <p>Back: <a href="/docs/getting-started">Getting Started</a></p>
        </article>
      </body>
    </html>
  `,
};

interface CrawlPage {
  url: string;
  title: string;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
}

async function crawl(startUrl: string, maxPages = 10): Promise<CrawlPage[]> {
  const fetcher = new MapFetcher(FIXTURES);
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(startUrl)];
  const pages: CrawlPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift();
    if (!next) break;

    const url = normalizeUrl(next);
    if (visited.has(url)) continue;
    visited.add(url);

    const data = await scrape(url, {
      fetcher,
      maxContentLength: 5000,
    });

    const internal = (data.links ?? []).filter((l) => !l.isExternal).map((l) => l.url);
    const external = (data.links ?? []).filter((l) => l.isExternal).map((l) => l.url);

    pages.push({
      url: data.url,
      title: data.title,
      wordCount: data.wordCount,
      internalLinks: internal.length,
      externalLinks: external.length,
    });

    for (const link of internal) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  return pages;
}

async function main() {
  console.log('=== Offline Crawl (Custom Fetcher) ===\n');

  const pages = await crawl('https://local.test/', 25);

  console.log(`Crawled pages: ${pages.length}\n`);
  pages.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2, '0')}. ${p.title} — ${p.url}`);
    console.log(
      `    words=${p.wordCount} internalLinks=${p.internalLinks} externalLinks=${p.externalLinks}`
    );
  });

  console.log('\nTip: This example does not use the network; it demonstrates how to build');
  console.log('a deterministic crawler by injecting a custom `fetcher` into scrapex.\n');
}

main().catch(console.error);

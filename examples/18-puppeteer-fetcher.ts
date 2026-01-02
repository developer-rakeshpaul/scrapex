/**
 * 18-puppeteer-fetcher.ts
 *
 * Demonstrates scraping a JavaScript-rendered page by providing a custom Fetcher
 * implemented with Puppeteer (optional peer dependency).
 *
 * Install peer dependency:
 *   npm install puppeteer
 *
 * Run:
 *   npx tsx examples/18-puppeteer-fetcher.ts
 */

import { ScrapeError, type Fetcher, type FetchOptions, type FetchResult, scrape } from '../src/index.js';

class PuppeteerFetcher implements Fetcher {
  readonly name = 'puppeteer';

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    let puppeteer: any;
    try {
      const imported: any = await import('puppeteer');
      puppeteer = imported?.launch ? imported : imported?.default;
    } catch {
      throw new ScrapeError(
        'Missing peer dependency "puppeteer". Run: npm install puppeteer',
        'FETCH_FAILED'
      );
    }

    const { timeout = 30_000, userAgent } = options;

    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      if (userAgent) {
        await page.setUserAgent(userAgent);
      }

      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout });
      const html = await page.content();

      return {
        html,
        finalUrl: page.url(),
        statusCode: response?.status?.() ?? 200,
        contentType: response?.headers?.()['content-type'] ?? 'text/html',
        headers: response?.headers?.() ?? undefined,
      };
    } finally {
      await browser.close();
    }
  }
}

async function main() {
  console.log('=== Puppeteer Fetcher Example ===\n');

  // This page requires JavaScript to render the quotes.
  const url = 'https://quotes.toscrape.com/js/';

  const data = await scrape(url, {
    fetcher: new PuppeteerFetcher(),
    timeout: 30_000,
    maxContentLength: 10_000,
  });

  console.log('Title:', data.title);
  console.log('Excerpt:', data.excerpt);
  console.log('Links found:', data.links?.length ?? 0);
  console.log('Scrape time:', data.scrapeTimeMs, 'ms');
}

main().catch(console.error);

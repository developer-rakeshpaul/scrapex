/**
 * 16-custom-fetcher-retry-cache.ts
 *
 * Demonstrates a custom Fetcher that adds:
 * - Simple in-memory caching
 * - Retry with exponential backoff for retryable failures
 *
 * Run: npx tsx examples/16-custom-fetcher-retry-cache.ts
 */

import {
  ScrapeError,
  type Fetcher,
  type FetchOptions,
  type FetchResult,
  defaultFetcher,
  scrape,
} from '../src/index.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CacheEntry {
  createdAt: number;
  result: FetchResult;
}

class RetryingCachingFetcher implements Fetcher {
  readonly name = 'retry-cache';
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: Fetcher,
    private readonly config: {
      ttlMs: number;
      maxRetries: number;
      baseDelayMs: number;
    }
  ) {}

  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.createdAt < this.config.ttlMs) {
      return cached.result;
    }

    let attempt = 0;
    let lastError: unknown = undefined;

    while (attempt <= this.config.maxRetries) {
      try {
        const result = await this.inner.fetch(url, options);
        this.cache.set(url, { createdAt: Date.now(), result });
        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        const scrapeError = ScrapeError.from(error);
        const shouldRetry =
          scrapeError.isRetryable() || (scrapeError.code === 'BLOCKED' && scrapeError.statusCode === 429);

        if (!shouldRetry || attempt > this.config.maxRetries) {
          throw error;
        }

        const delay = this.config.baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

async function main() {
  console.log('=== Custom Fetcher: Retry + Cache ===\n');

  const fetcher = new RetryingCachingFetcher(defaultFetcher, {
    ttlMs: 60_000,
    maxRetries: 2,
    baseDelayMs: 250,
  });

  const url = 'https://quotes.toscrape.com';

  console.log('First scrape (network):');
  const first = await scrape(url, { fetcher, timeout: 15_000 });
  console.log(`  title="${first.title}" time=${first.scrapeTimeMs}ms`);

  console.log('\nSecond scrape (cached fetch):');
  const second = await scrape(url, { fetcher, timeout: 15_000 });
  console.log(`  title="${second.title}" time=${second.scrapeTimeMs}ms`);

  console.log('\nNotes:');
  console.log('- Caching happens at the fetch layer (HTML), before extraction runs.');
  console.log('- Retry is useful for transient errors and occasional 429 responses.\n');
}

main().catch(console.error);


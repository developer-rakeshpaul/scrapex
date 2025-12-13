/**
 * 14-batch-scraping.ts
 *
 * Scrape multiple URLs efficiently with rate limiting and error handling.
 *
 * Run: npx tsx examples/14-batch-scraping.ts
 */

import { type ScrapedData, ScrapeError, scrape } from '../src/index.js';

// Utility: Sleep for a given number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Result type for batch operations
interface BatchResult {
  url: string;
  success: boolean;
  data?: ScrapedData;
  error?: string;
}

async function main() {
  console.log('=== Batch Scraping Example ===\n');

  // Sample URLs to scrape - using practice sites designed for scraping
  const urls = [
    'https://books.toscrape.com',
    'https://quotes.toscrape.com',
    'https://httpstat.us/404', // Will fail - for error handling demo
    'https://books.toscrape.com/catalogue/category/books/mystery_3/index.html',
  ];

  // Example 1: Simple concurrent scraping
  console.log('--- Concurrent Scraping (Promise.all) ---');

  const concurrentResults = await Promise.allSettled(urls.map((url) => scrape(url)));

  concurrentResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`✓ ${urls[i]}: ${result.value.title}`);
    } else {
      console.log(`✗ ${urls[i]}: ${result.reason.message}`);
    }
  });

  // Example 2: Rate-limited scraping
  console.log('\n--- Rate-Limited Scraping ---');

  async function scrapeWithRateLimit(
    urls: string[],
    delayMs: number = 1000
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const url of urls) {
      try {
        console.log(`  Scraping: ${url}`);
        const data = await scrape(url, { timeout: 10000 });
        results.push({ url, success: true, data });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: (error as Error).message,
        });
      }

      // Wait between requests
      if (urls.indexOf(url) < urls.length - 1) {
        await sleep(delayMs);
      }
    }

    return results;
  }

  const rateLimitedResults = await scrapeWithRateLimit(urls.slice(0, 2), 500);
  console.log('Results:', rateLimitedResults.length);

  // Example 3: Concurrent with limit (batch processing)
  console.log('\n--- Batched Concurrent Scraping ---');

  async function scrapeInBatches(
    urls: string[],
    batchSize: number = 3,
    delayBetweenBatches: number = 1000
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}...`);

      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          const data = await scrape(url, { timeout: 10000 });
          return { url, data };
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push({
            url: result.value.url,
            success: true,
            data: result.value.data,
          });
        } else {
          // Extract URL from error if possible
          results.push({
            url: 'unknown',
            success: false,
            error: result.reason.message,
          });
        }
      });

      // Delay between batches
      if (i + batchSize < urls.length) {
        await sleep(delayBetweenBatches);
      }
    }

    return results;
  }

  const batchResults = await scrapeInBatches(urls, 2, 500);
  console.log('Total processed:', batchResults.length);
  console.log('Successful:', batchResults.filter((r) => r.success).length);
  console.log('Failed:', batchResults.filter((r) => !r.success).length);

  // Example 4: Progress tracking
  console.log('\n--- Progress Tracking ---');

  async function scrapeWithProgress(
    urls: string[],
    onProgress: (current: number, total: number, url: string) => void
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) {
        continue;
      }
      onProgress(i + 1, urls.length, url);

      try {
        const data = await scrape(url, { timeout: 10000 });
        results.push({ url, success: true, data });
      } catch (error) {
        results.push({ url, success: false, error: (error as Error).message });
      }

      await sleep(300); // Small delay
    }

    return results;
  }

  await scrapeWithProgress(urls.slice(0, 3), (current, total, url) => {
    const percent = Math.round((current / total) * 100);
    console.log(`  [${percent}%] ${current}/${total}: ${url}`);
  });

  // Example 5: Retry failed URLs
  console.log('\n--- Retry Failed URLs ---');

  async function scrapeWithRetries(urls: string[], maxRetries: number = 2): Promise<BatchResult[]> {
    let remaining = [...urls];
    const results: BatchResult[] = [];
    let attempt = 0;

    while (remaining.length > 0 && attempt < maxRetries) {
      attempt++;
      console.log(`  Attempt ${attempt}: ${remaining.length} URLs`);

      const failed: string[] = [];

      for (const url of remaining) {
        try {
          const data = await scrape(url, { timeout: 5000 });
          results.push({ url, success: true, data });
        } catch (error) {
          if (error instanceof ScrapeError && error.isRetryable()) {
            failed.push(url);
          } else {
            results.push({ url, success: false, error: (error as Error).message });
          }
        }
        await sleep(200);
      }

      remaining = failed;
    }

    // Mark remaining as failed
    for (const url of remaining) {
      results.push({ url, success: false, error: 'Max retries exceeded' });
    }

    return results;
  }

  const retryResults = await scrapeWithRetries(urls.slice(0, 2));
  console.log('Final results:', retryResults.length);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`
Batch scraping patterns:

1. Promise.all - Fast but no rate limiting
2. Sequential with delay - Respectful but slow
3. Batched - Balance of speed and rate limiting
4. Progress tracking - User feedback
5. Retry logic - Handle transient failures

Choose based on:
- Target site's rate limits
- Network reliability
- Number of URLs
- User experience needs
  `);
}

main().catch(console.error);

/**
 * 02-scrape-options.ts
 *
 * Demonstrates all available scrape configuration options.
 *
 * Run: npx tsx examples/02-scrape-options.ts
 */

import { scrape } from '../src/index.js';

async function main() {
  console.log('=== Scrape Options Example ===\n');

  // Full options example
  // Using quotes.toscrape.com - a practice site with quotes and authors
  const result = await scrape('https://quotes.toscrape.com', {
    // Request timeout in milliseconds (default: 10000)
    timeout: 15000,

    // Custom User-Agent header
    userAgent: 'MyScraperBot/1.0 (+https://example.com/bot)',

    // Whether to extract full page content (default: true)
    // Set to false for faster metadata-only scraping
    extractContent: true,

    // Maximum content length in characters (default: 50000)
    // Useful for limiting token usage with LLMs
    maxContentLength: 10000,

    // Check robots.txt before scraping (default: false)
    // Throws ScrapeError if blocked
    respectRobots: false,
  });

  console.log('Title:', result.title);
  console.log('Content length:', result.content.length, 'chars');
  console.log('Scrape time:', result.scrapeTimeMs, 'ms');

  // Example: Metadata-only scraping (faster)
  console.log('\n--- Metadata-Only Scraping ---');
  const metadataOnly = await scrape('https://quotes.toscrape.com', {
    extractContent: false,
  });
  console.log('Title:', metadataOnly.title);
  console.log('Description:', metadataOnly.description);
  console.log('Content extracted:', metadataOnly.content.length > 0 ? 'Yes' : 'No');

  // Example: Limited content for token optimization
  console.log('\n--- Limited Content ---');
  const limited = await scrape('https://quotes.toscrape.com', {
    maxContentLength: 500,
  });
  console.log('Content length:', limited.content.length, 'chars');

  // Example: Short timeout for fast-fail
  console.log('\n--- Short Timeout ---');
  try {
    await scrape('https://httpstat.us/200?sleep=5000', {
      timeout: 2000,
    });
  } catch (error) {
    console.log('Timeout triggered as expected:', (error as Error).message);
  }
}

main().catch(console.error);

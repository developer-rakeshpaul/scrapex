/**
 * 12-error-handling.ts
 *
 * Handle errors gracefully when scraping.
 * Demonstrates ScrapeError, error codes, and retry patterns.
 *
 * Run: npx tsx examples/12-error-handling.ts
 */

import { ScrapeError, scrape } from '../src/index.js';

async function main() {
  console.log('=== Error Handling Example ===\n');

  // Example 1: Basic error handling
  console.log('--- Basic Error Handling ---');

  try {
    await scrape('https://httpstat.us/404');
  } catch (error) {
    if (error instanceof ScrapeError) {
      console.log('ScrapeError caught!');
      console.log('  Code:', error.code);
      console.log('  Message:', error.message);
      console.log('  Status Code:', error.statusCode);
      console.log('  Is Retryable:', error.isRetryable());
    }
  }

  // Example 2: Different error types
  console.log('\n--- Error Types ---');

  const errorTests = [
    { url: 'https://httpstat.us/404', desc: 'Not Found (404)' },
    { url: 'https://httpstat.us/403', desc: 'Forbidden (403)' },
    { url: 'https://httpstat.us/500', desc: 'Server Error (500)' },
    { url: 'not-a-valid-url', desc: 'Invalid URL' },
    { url: 'https://httpstat.us/200?sleep=15000', desc: 'Timeout', timeout: 2000 },
  ];

  for (const test of errorTests) {
    try {
      await scrape(test.url, { timeout: test.timeout || 5000 });
      console.log(`${test.desc}: Success (unexpected)`);
    } catch (error) {
      if (error instanceof ScrapeError) {
        console.log(`${test.desc}:`);
        console.log(`  Code: ${error.code}, Retryable: ${error.isRetryable()}`);
      } else {
        console.log(`${test.desc}: ${(error as Error).message}`);
      }
    }
  }

  // Example 3: Error codes reference
  console.log('\n--- Error Codes Reference ---');
  console.log(`
ScrapeError codes:
  FETCH_FAILED     - Network request failed (retryable)
  TIMEOUT          - Request timed out (retryable)
  INVALID_URL      - URL is malformed
  BLOCKED          - Access denied (HTTP 403)
  NOT_FOUND        - Page not found (HTTP 404)
  ROBOTS_BLOCKED   - Blocked by robots.txt
  PARSE_ERROR      - HTML parsing failed
  LLM_ERROR        - LLM provider error
  VALIDATION_ERROR - Schema validation failed
  `);

  // Example 4: Retry pattern
  console.log('--- Retry Pattern ---');

  async function scrapeWithRetry(url: string, maxRetries = 3): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`  Attempt ${attempt}/${maxRetries}...`);
        return await scrape(url, { timeout: 3000 });
      } catch (error) {
        lastError = error as Error;

        if (error instanceof ScrapeError && error.isRetryable()) {
          console.log(`  Failed (${error.code}), will retry...`);
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
          // Non-retryable error, fail immediately
          throw error;
        }
      }
    }

    throw lastError;
  }

  try {
    // This will retry on timeout
    await scrapeWithRetry('https://httpstat.us/200?sleep=10000');
  } catch (error) {
    console.log('  All retries failed:', (error as Error).message);
  }

  // Example 5: Graceful degradation
  console.log('\n--- Graceful Degradation ---');

  async function scrapeSafely(url: string) {
    try {
      const result = await scrape(url, { timeout: 5000 });
      return {
        success: true,
        data: result,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: {
          code: error instanceof ScrapeError ? error.code : 'UNKNOWN',
          message: (error as Error).message,
        },
      };
    }
  }

  const safeResult = await scrapeSafely('https://example.com');
  console.log('Safe scrape result:');
  console.log('  Success:', safeResult.success);
  console.log('  Title:', safeResult.data?.title || 'N/A');

  const failedResult = await scrapeSafely('https://httpstat.us/500');
  console.log('\nFailed scrape result:');
  console.log('  Success:', failedResult.success);
  console.log('  Error:', failedResult.error?.code);

  // Example 6: LLM enhancement errors
  console.log('\n--- LLM Enhancement Errors ---');
  console.log(`
LLM enhancements can fail without failing the entire scrape:

const result = await scrape(url, {
  llm: provider,
  enhance: ['summarize', 'entities'],
});

// Check if enhancements succeeded
if (result.summary) {
  console.log('Summary:', result.summary);
} else {
  console.log('Summary generation failed');
}

// The error field indicates partial failures
if (result.error) {
  console.log('Some enhancements failed:', result.error);
}
  `);
}

main().catch(console.error);

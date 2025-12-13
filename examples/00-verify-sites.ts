/**
 * 00-verify-sites.ts
 *
 * Quick verification script to test scrapex against practice sites.
 * Use this to verify the library is working correctly.
 *
 * Run: npx tsx examples/00-verify-sites.ts
 */

import { scrape } from '../src/index.js';

interface TestResult {
  site: string;
  success: boolean;
  title?: string;
  links?: number;
  time?: number;
  error?: string;
}

const TEST_SITES = [
  {
    name: 'Books to Scrape',
    url: 'https://books.toscrape.com',
    description: 'Fake bookstore with products, categories, pagination',
  },
  {
    name: 'Quotes to Scrape',
    url: 'https://quotes.toscrape.com',
    description: 'Quotes with authors, tags, pagination',
  },
  {
    name: 'Books - Mystery Category',
    url: 'https://books.toscrape.com/catalogue/category/books/mystery_3/index.html',
    description: 'Category page with filtered products',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    description: 'Real site with simple HTML structure',
  },
  {
    name: 'Example.com',
    url: 'https://example.com',
    description: 'Simple reference page',
  },
];

async function testSite(url: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await scrape(url, {
      timeout: 15000,
      maxContentLength: 10000,
    });

    return {
      site: url,
      success: true,
      title: result.title?.slice(0, 50) || '(no title)',
      links: result.links?.length || 0,
      time: Date.now() - start,
    };
  } catch (error) {
    return {
      site: url,
      success: false,
      error: (error as Error).message.slice(0, 50),
      time: Date.now() - start,
    };
  }
}

async function main() {
  console.log('=== Scrapex Site Verification ===\n');
  console.log('Testing against practice and demo sites...\n');

  const results: TestResult[] = [];

  for (const site of TEST_SITES) {
    process.stdout.write(`Testing ${site.name}... `);
    const result = await testSite(site.url);
    results.push(result);

    if (result.success) {
      console.log(`✓ (${result.time}ms)`);
    } else {
      console.log(`✗ ${result.error}`);
    }
  }

  // Summary
  console.log('\n--- Results Summary ---\n');

  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (passed.length > 0) {
    console.log('\n--- Successful Scrapes ---');
    passed.forEach((r) => {
      console.log(`  ${r.site}`);
      console.log(`    Title: ${r.title}`);
      console.log(`    Links: ${r.links}`);
      console.log(`    Time: ${r.time}ms`);
    });
  }

  if (failed.length > 0) {
    console.log('\n--- Failed Scrapes ---');
    failed.forEach((r) => {
      console.log(`  ${r.site}`);
      console.log(`    Error: ${r.error}`);
    });
  }

  // Feature verification
  console.log('\n--- Feature Verification ---');

  const booksSite = results.find((r) => r.site.includes('books.toscrape.com') && r.success);
  if (booksSite?.links && booksSite.links > 0) {
    console.log('✓ Link extraction working');
  }

  const quoteSite = results.find((r) => r.site.includes('quotes.toscrape.com') && r.success);
  if (quoteSite?.title) {
    console.log('✓ Title extraction working');
  }

  console.log('\n--- Available Practice Sites ---');
  TEST_SITES.forEach((site) => {
    console.log(`  ${site.url}`);
    console.log(`    ${site.description}`);
  });

  // Only fail if primary test sites (toscrape) failed
  const primarySitesFailed = failed.some((r) => r.site.includes('toscrape.com'));
  if (primarySitesFailed || passed.length === 0) {
    console.log('\n⚠ Primary test sites failed - check network connection');
    process.exit(1);
  }
}

main().catch(console.error);

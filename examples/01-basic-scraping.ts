/**
 * 01-basic-scraping.ts
 *
 * Basic web scraping with scrapex.
 * Demonstrates the simplest usage pattern for extracting metadata and content.
 *
 * Run: npx tsx examples/01-basic-scraping.ts
 */

import { scrape } from '../src/index.js';

async function main() {
  console.log('=== Basic Scraping Example ===\n');

  // Simple scrape - just pass a URL
  // Using books.toscrape.com - a practice site designed for web scraping
  const result = await scrape('https://books.toscrape.com');

  // Access basic metadata
  console.log('Title:', result.title);
  console.log('Description:', result.description);
  console.log('URL:', result.url);
  console.log('Canonical URL:', result.canonicalUrl);
  console.log('Domain:', result.domain);

  // Access content
  console.log('\n--- Content ---');
  console.log('Excerpt:', result.excerpt);
  console.log('Word Count:', result.wordCount);
  console.log('Content Type:', result.contentType);

  // Content is available in two formats:
  // - content: Markdown format (better for display/LLMs)
  // - textContent: Plain text (lower token usage)
  console.log('\nMarkdown Content (first 200 chars):');
  console.log(`${result.content.slice(0, 200)}...`);

  // Access optional metadata (may be undefined)
  console.log('\n--- Optional Metadata ---');
  console.log('Author:', result.author || 'N/A');
  console.log('Published:', result.publishedAt || 'N/A');
  console.log('Language:', result.language || 'N/A');
  console.log('Site Name:', result.siteName || 'N/A');
  console.log('Favicon:', result.favicon || 'N/A');
  console.log('Image:', result.image || 'N/A');

  // Access extracted links
  console.log('\n--- Links ---');
  console.log('Total links:', result.links?.length || 0);
  result.links?.slice(0, 5).forEach((link) => {
    console.log(`  - ${link.text}: ${link.url} ${link.isExternal ? '(external)' : ''}`);
  });

  // JSON-LD structured data (if present)
  if (result.jsonLd && result.jsonLd.length > 0) {
    console.log('\n--- JSON-LD Data ---');
    console.log(JSON.stringify(result.jsonLd, null, 2));
  }

  // Scraping metadata
  console.log('\n--- Scrape Info ---');
  console.log('Scraped At:', result.scrapedAt);
  console.log(`Scrape Time: ${result.scrapeTimeMs}ms`);
}

main().catch(console.error);

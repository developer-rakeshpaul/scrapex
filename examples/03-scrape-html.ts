/**
 * 03-scrape-html.ts
 *
 * Scrape from raw HTML string instead of fetching from URL.
 * Useful when you've already fetched HTML via other means (Puppeteer, etc.)
 *
 * Run: npx tsx examples/03-scrape-html.ts
 */

import { scrapeHtml } from '../src/index.js';

async function main() {
  console.log('=== Scrape HTML Example ===\n');

  // Sample HTML content
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>My Blog Post</title>
      <meta name="description" content="A great article about web scraping">
      <meta name="author" content="John Doe">
      <meta property="og:title" content="My Blog Post - OG Title">
      <meta property="og:image" content="https://example.com/image.jpg">
      <link rel="canonical" href="https://example.com/blog/my-post">
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "My Blog Post",
          "author": { "@type": "Person", "name": "John Doe" },
          "datePublished": "2024-01-15"
        }
      </script>
    </head>
    <body>
      <article>
        <h1>My Blog Post</h1>
        <p>This is the main content of the article. It discusses various topics
        related to web scraping and data extraction techniques.</p>
        <p>Web scraping is a powerful technique for gathering data from websites.
        With the right tools, you can extract structured information from any page.</p>
        <h2>Key Points</h2>
        <ul>
          <li>Always respect robots.txt</li>
          <li>Handle errors gracefully</li>
          <li>Use rate limiting</li>
        </ul>
        <a href="https://example.com/related">Related Article</a>
        <a href="https://external.com/resource">External Resource</a>
      </article>
    </body>
    </html>
  `;

  // Scrape from HTML string
  // Second parameter is the base URL (used for resolving relative URLs)
  const result = await scrapeHtml(html, 'https://example.com/blog/my-post');

  console.log('--- Basic Metadata ---');
  console.log('Title:', result.title);
  console.log('Description:', result.description);
  console.log('Author:', result.author);
  console.log('Canonical URL:', result.canonicalUrl);
  console.log('Language:', result.language);

  console.log('\n--- OG Data ---');
  console.log('OG Image:', result.image);

  console.log('\n--- Content ---');
  console.log('Excerpt:', result.excerpt);
  console.log('Word Count:', result.wordCount);
  console.log('\nMarkdown Content:');
  console.log(result.content);

  console.log('\n--- JSON-LD ---');
  if (result.jsonLd) {
    console.log(JSON.stringify(result.jsonLd, null, 2));
  }

  console.log('\n--- Links ---');
  result.links?.forEach((link) => {
    console.log(`  - ${link.text}: ${link.url} ${link.isExternal ? '(external)' : ''}`);
  });

  // Use case: Testing custom extractors
  console.log('\n--- Use Case: Scraping Pre-fetched HTML ---');
  console.log('This is useful when:');
  console.log('  - HTML was fetched via Puppeteer/Playwright for JS rendering');
  console.log('  - HTML comes from a cache or database');
  console.log('  - Testing extractors with sample HTML');
}

main().catch(console.error);

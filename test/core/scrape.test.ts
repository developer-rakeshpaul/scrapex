import { describe, expect, it } from 'vitest';
import { scrape, scrapeHtml } from '@/core/scrape.js';
import { ScrapeError } from '@/core/errors.js';
import type { Fetcher, FetchResult } from '@/fetchers/types.js';

// Sample HTML for testing
const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page Title</title>
  <meta name="description" content="Test page description">
  <meta property="og:title" content="OG Title">
  <meta property="og:description" content="OG Description">
  <meta property="og:image" content="https://example.com/image.jpg">
  <meta name="author" content="Test Author">
  <meta name="keywords" content="test, page, keywords">
  <link rel="canonical" href="https://example.com/canonical">
  <link rel="icon" href="/favicon.ico">
</head>
<body>
  <article>
    <h1>Main Heading</h1>
    <p>This is the main content of the test page. It contains enough text to be considered meaningful content for extraction purposes.</p>
    <p>Here is another paragraph with more content to ensure we have sufficient text for the content extractor to work with.</p>
    <a href="https://external.com/link">External Link</a>
    <a href="/internal/page">Internal Link</a>
  </article>
</body>
</html>
`;

// Mock fetcher for testing
const createMockFetcher = (html: string, finalUrl?: string): Fetcher => ({
  fetch: async (url: string): Promise<FetchResult> => ({
    html,
    finalUrl: finalUrl ?? url,
    statusCode: 200,
  }),
});

describe('scrapeHtml', () => {
  it('should extract basic metadata from HTML', async () => {
    const result = await scrapeHtml(sampleHtml, 'https://example.com/page');

    expect(result.title).toBe('OG Title'); // OG title takes priority
    expect(result.description).toBe('OG Description');
    expect(result.image).toBe('https://example.com/image.jpg');
    expect(result.author).toBe('Test Author');
    expect(result.canonicalUrl).toBe('https://example.com/canonical');
    expect(result.language).toBe('en');
    expect(result.keywords).toEqual(['test', 'page', 'keywords']);
  });

  it('should extract domain from URL', async () => {
    const result = await scrapeHtml(sampleHtml, 'https://www.example.com/page');
    expect(result.domain).toBe('example.com');
  });

  it('should extract text content', async () => {
    const result = await scrapeHtml(sampleHtml, 'https://example.com/page');
    expect(result.textContent).toContain('main content');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('should extract links', async () => {
    const result = await scrapeHtml(sampleHtml, 'https://example.com/page');
    expect(result.links).toBeDefined();
    expect(result.links).toContainEqual(
      expect.objectContaining({ url: 'https://external.com/link', isExternal: true })
    );
  });

  it('should include scrape timing', async () => {
    const result = await scrapeHtml(sampleHtml, 'https://example.com/page');
    expect(result.scrapedAt).toBeDefined();
    expect(result.scrapeTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should normalize the URL', async () => {
    const result = await scrapeHtml(
      sampleHtml,
      'https://example.com/page?utm_source=test&valid=1'
    );
    expect(result.url).not.toContain('utm_source');
    expect(result.url).toContain('valid=1');
  });

  it('should throw for invalid URLs', async () => {
    await expect(scrapeHtml(sampleHtml, 'not-a-valid-url')).rejects.toThrow(ScrapeError);
    await expect(scrapeHtml(sampleHtml, 'ftp://example.com')).rejects.toThrow('Invalid URL');
  });
});

describe('scrape', () => {
  it('should fetch and extract from URL', async () => {
    const mockFetcher = createMockFetcher(sampleHtml, 'https://example.com/final');

    const result = await scrape('https://example.com/page', {
      fetcher: mockFetcher,
    });

    expect(result.url).toBe('https://example.com/page');
    expect(result.canonicalUrl).toBe('https://example.com/canonical');
    expect(result.title).toBe('OG Title');
  });

  it('should handle redirect (finalUrl different from requested)', async () => {
    const mockFetcher = createMockFetcher(sampleHtml, 'https://example.com/redirected');

    const result = await scrape('https://example.com/original', {
      fetcher: mockFetcher,
    });

    expect(result.url).toBe('https://example.com/original');
    // Domain should be extracted from final URL
    expect(result.domain).toBe('example.com');
  });

  it('should throw for invalid URLs', async () => {
    await expect(scrape('invalid-url')).rejects.toThrow(ScrapeError);
    await expect(scrape('')).rejects.toThrow('Invalid URL');
  });

  it('should use custom extractors', async () => {
    const mockFetcher = createMockFetcher(sampleHtml);
    const customExtracted = { custom: 'data' };

    const result = await scrape('https://example.com', {
      fetcher: mockFetcher,
      extractors: [
        {
          name: 'custom',
          priority: 50,
          extract: async () => ({ custom: customExtracted }),
        },
      ],
    });

    expect(result.custom).toEqual(customExtracted);
  });

  it('should replace default extractors when specified', async () => {
    const mockFetcher = createMockFetcher(sampleHtml);

    const result = await scrape('https://example.com', {
      fetcher: mockFetcher,
      replaceDefaultExtractors: true,
      extractors: [
        {
          name: 'minimal',
          priority: 100,
          extract: async () => ({ title: 'Custom Title' }),
        },
      ],
    });

    expect(result.title).toBe('Custom Title');
    // Other fields should be empty since we replaced extractors
    expect(result.description).toBe('');
  });

  it('should continue on extractor errors', async () => {
    const mockFetcher = createMockFetcher(sampleHtml);

    const result = await scrape('https://example.com', {
      fetcher: mockFetcher,
      extractors: [
        {
          name: 'failing',
          priority: 150,
          extract: async () => {
            throw new Error('Extractor failed');
          },
        },
      ],
    });

    // Should still have results from default extractors
    expect(result.title).toBeTruthy();
    // Error should be recorded
    expect(result.error).toContain('failing');
  });
});

describe('scrapeHtml with minimal HTML', () => {
  it('should handle HTML without meta tags', async () => {
    const minimalHtml = '<html><head><title>Simple</title></head><body><p>Content</p></body></html>';
    const result = await scrapeHtml(minimalHtml, 'https://example.com');

    expect(result.title).toBe('Simple');
    expect(result.description).toBe('');
    expect(result.contentType).toBe('unknown');
  });

  it('should handle empty HTML', async () => {
    const result = await scrapeHtml('', 'https://example.com');
    expect(result.title).toBe('');
    expect(result.content).toBe('');
  });
});

describe('JSON-LD extraction', () => {
  it('should extract JSON-LD data', async () => {
    const htmlWithJsonLd = `
      <html>
      <head>
        <title>Article</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "JSON-LD Headline",
          "author": {"@type": "Person", "name": "JSON Author"},
          "datePublished": "2024-01-01"
        }
        </script>
      </head>
      <body><p>Content</p></body>
      </html>
    `;

    const result = await scrapeHtml(htmlWithJsonLd, 'https://example.com');
    expect(result.jsonLd).toBeDefined();
    expect(result.jsonLd?.[0]).toMatchObject({
      '@type': 'Article',
      headline: 'JSON-LD Headline',
    });
  });
});

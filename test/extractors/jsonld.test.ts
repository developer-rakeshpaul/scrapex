import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import type { ExtractionContext } from '@/core/types.js';
import { JsonLdExtractor } from '@/extractors/jsonld.js';

function createContext(html: string, url = 'https://example.com'): ExtractionContext {
  const $ = cheerio.load(html);
  return {
    url,
    finalUrl: url,
    html,
    $,
    getDocument: () => {
      throw new Error('getDocument should not be called');
    },
    results: {},
    options: {},
  };
}

describe('JsonLdExtractor', () => {
  const extractor = new JsonLdExtractor();

  it('should have correct name and priority', () => {
    expect(extractor.name).toBe('jsonld');
    expect(extractor.priority).toBe(80);
  });

  describe('JSON-LD extraction', () => {
    it('should extract JSON-LD from script tag', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Test Article"
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.jsonLd).toHaveLength(1);
      expect(result.jsonLd?.[0]).toMatchObject({
        '@type': 'Article',
        headline: 'Test Article',
      });
    });

    it('should handle multiple JSON-LD blocks', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">{"@type": "Article", "headline": "One"}</script>
            <script type="application/ld+json">{"@type": "Organization", "name": "Org"}</script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.jsonLd).toHaveLength(2);
    });

    it('should handle JSON-LD arrays', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            [
              {"@type": "Article", "headline": "Article One"},
              {"@type": "Article", "headline": "Article Two"}
            ]
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.jsonLd).toHaveLength(2);
    });

    it('should skip invalid JSON', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">invalid json{</script>
            <script type="application/ld+json">{"@type": "Valid"}</script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.jsonLd).toHaveLength(1);
    });

    it('should return empty object when no JSON-LD', async () => {
      const html = '<html><head></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.jsonLd).toBeUndefined();
    });
  });

  describe('Article metadata extraction', () => {
    it('should extract article metadata', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Article",
              "headline": "Test Headline",
              "description": "Test description",
              "author": {"@type": "Person", "name": "John Doe"},
              "datePublished": "2024-01-15",
              "dateModified": "2024-02-01",
              "image": "https://example.com/image.jpg"
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('Test Headline');
      expect(result.description).toBe('Test description');
      expect(result.author).toBe('John Doe');
      expect(result.publishedAt).toBe('2024-01-15');
      expect(result.modifiedAt).toBe('2024-02-01');
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    it('should handle author as string', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {"@type": "Article", "author": "Jane Doe"}
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.author).toBe('Jane Doe');
    });

    it('should handle multiple authors', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Test",
              "author": [
                {"@type": "Person", "name": "Author One"},
                {"@type": "Person", "name": "Author Two"}
              ]
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.author).toBe('Author One, Author Two');
    });

    it('should handle image as object', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Article",
              "image": {"@type": "ImageObject", "url": "https://example.com/image.jpg"}
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    it('should handle image array', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Test",
              "image": ["https://example.com/first.jpg", "https://example.com/second.jpg"]
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.image).toBe('https://example.com/first.jpg');
    });
  });

  describe('Organization extraction', () => {
    it('should extract site name from Organization', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {"@type": "Organization", "name": "My Organization"}
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.siteName).toBe('My Organization');
    });
  });

  describe('Product extraction', () => {
    it('should extract product metadata', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Test Product",
              "description": "Product description",
              "image": "https://example.com/product.jpg"
            }
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('Test Product');
      expect(result.description).toBe('Product description');
      expect(result.image).toBe('https://example.com/product.jpg');
    });
  });

  describe('Keywords extraction', () => {
    it('should extract keywords as string', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {"@type": "Article", "keywords": "javascript, typescript, nodejs"}
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.keywords).toEqual(['javascript', 'typescript', 'nodejs']);
    });

    it('should extract keywords as array', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {"@type": "Article", "keywords": ["javascript", "typescript"]}
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.keywords).toEqual(['javascript', 'typescript']);
    });

    it('should deduplicate keywords from multiple JSON-LD blocks', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">{"keywords": "javascript, typescript"}</script>
            <script type="application/ld+json">{"keywords": "typescript, nodejs"}</script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.keywords).toEqual(['javascript', 'typescript', 'nodejs']);
    });
  });

  describe('@type handling', () => {
    it('should handle @type as array', async () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
            {"@type": ["Article", "NewsArticle"], "headline": "News"}
            </script>
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('News');
    });
  });
});

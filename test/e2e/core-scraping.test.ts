/**
 * Core Scraping - Documentation Examples & Real-World Validation
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExtractionContext, Extractor, ScrapedData } from '@/index.js';
import {
  checkRobotsTxt,
  createDefaultExtractors,
  ScrapeError,
  scrape,
  scrapeHtml,
} from '@/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures');

const messyBlogPost = readFileSync(path.join(fixturesDir, 'messy-blog-post.html'), 'utf8');
const quickStartHtml = readFileSync(path.join(fixturesDir, 'quick-start.html'), 'utf8');
const articleFixture = readFileSync(path.join(fixturesDir, 'article-real-world.html'), 'utf8');

function applyBaseUrl(html: string, baseUrl: string): string {
  return html.replace(/\{\{BASE_URL\}\}/g, baseUrl);
}

describe('Core Scraping (from docs & real-world)', () => {
  let serverBaseUrl = '';
  let serverClose: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      if (req.url.startsWith('/article')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(applyBaseUrl(articleFixture, serverBaseUrl));
        return;
      }

      if (req.url.startsWith('/blocked')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(applyBaseUrl(articleFixture, serverBaseUrl));
        return;
      }

      if (req.url.startsWith('/redirect')) {
        res.writeHead(302, { Location: '/article' });
        res.end();
        return;
      }

      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('User-agent: *\nDisallow: /blocked\n');
        return;
      }

      if (req.url.startsWith('/image')) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from([137, 80, 78, 71]));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const { port } = server.address() as AddressInfo;
    serverBaseUrl = `http://127.0.0.1:${port}`;

    serverClose = () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
  });

  afterAll(async () => {
    if (serverClose) {
      await serverClose();
    }
  });

  describe('scrape() - Quick Start examples', () => {
    it('scrapes a URL and returns expected fields', async () => {
      const result = await scrape('https://example.com');

      expect(result.url).toBe('https://example.com/');
      expect(result.domain).toBe('example.com');
      expect(typeof result.canonicalUrl).toBe('string');
      expect(typeof result.title).toBe('string');
      expect(typeof result.description).toBe('string');
      expect(typeof result.content).toBe('string');
      expect(typeof result.wordCount).toBe('number');
      expect(typeof result.contentType).toBe('string');
    });

    it('supports timeout and userAgent options', async () => {
      const result = await scrape('https://example.com', {
        timeout: 15000,
        userAgent: 'MyBot/1.0',
        maxContentLength: 100000,
      });

      expect(result.url).toBe('https://example.com/');
      expect(result.title).toBeDefined();
    });
  });

  describe('scrapeHtml() - Real World Scenarios', () => {
    it('extracts main content while ignoring sidebars, ads, and navs', async () => {
      const result = await scrapeHtml(messyBlogPost, 'https://example.com/blog/messy');

      // 1. Metadata preference check (OG > Title)
      expect(result.title).toBe('The Real Title');
      expect(result.description).toBe('The actual summary of the article.');
      // Author might include "By " prefix depending on extraction logic
      expect(result.author).toContain('Jane Doe');
      expect(result.publishedAt).toContain('2023-10-27');

      // 2. Content extraction check
      // Should contain the main paragraph
      expect(result.textContent).toContain('This is the primary content of the article');
      // Should contain the list items
      expect(result.textContent).toContain('Point 1');
      // Should NOT contain sidebar text
      expect(result.textContent).not.toContain('Related Posts');
      // Should NOT contain footer text
      expect(result.textContent).not.toContain('Example Corp');
      // Should NOT contain scripts/ads (ideal scenario, depends on readability)
      expect(result.textContent).not.toContain('document.write');
    });

    it('resolves relative links in the main content', async () => {
      const result = await scrapeHtml(messyBlogPost, 'https://example.com/blog/messy');

      const links = result.links || [];
      // Look for the inline content link
      const articleLink = links.find((l) => l.url.includes('wiki/article'));

      expect(articleLink).toBeDefined();
      expect(articleLink?.url).toBe('https://example.com/wiki/article');
    });
  });

  describe('scrapeHtml() - Quick Start examples', () => {
    it('scrapes from HTML string', async () => {
      const result = await scrapeHtml(quickStartHtml, 'https://example.com/page');
      expect(result.title).toBe('My Page');
      expect(result.description).toBe('Page description');
    });
  });

  describe('scrapeHtml() - API doc examples', () => {
    it('extracts real-world metadata, JSON-LD, and content links', async () => {
      const html = applyBaseUrl(articleFixture, 'https://example.com');
      const result = await scrapeHtml(html, 'https://example.com/blog/deep-dive');

      expect(result.title).toBe('Deep Dive: Web Scraping');
      expect(result.description).toBe('A practical guide to scraping modern websites.');
      expect(result.canonicalUrl).toBe('https://example.com/blog/deep-dive');
      expect(result.author).toBe('Alex Doe');
      expect(result.image).toBe('https://example.com/assets/cover.png');
      expect(result.keywords).toEqual(expect.arrayContaining(['scraping', 'web', 'data']));
      expect(Array.isArray(result.jsonLd)).toBe(true);

      const links = result.links ?? [];
      const contentLink = links.find((l) => l.url === 'https://example.com/blog/tools');
      const externalLink = links.find((l) => l.url === 'https://external.example.org/guide');

      expect(contentLink?.isExternal).toBe(false);
      expect(externalLink?.isExternal).toBe(true);
      expect(links.find((l) => l.url === 'https://example.com/home')).toBeUndefined();
    });

    it('extracts title, description, and links', async () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>My Article</title>
  <meta name="description" content="Article description">
</head>
<body>
  <article>
    <h1>Article Title</h1>
    <p>Article content goes here...</p>
    <a href="/other-page">Related Article</a>
  </article>
</body>
</html>
      `;

      const result = await scrapeHtml(html, 'https://example.com/article');

      expect(result.title).toBe('My Article');
      expect(result.description).toBe('Article description');

      expect(result.links).toBeDefined();
      const otherPageLink = result.links?.find((l) => l.url.includes('other-page'));
      expect(otherPageLink?.url).toBe('https://example.com/other-page');
    });

    it('works with custom extractors', async () => {
      class PriceExtractor implements Extractor {
        readonly name = 'price';
        readonly priority = 50;

        async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
          const { $ } = context;
          const price = $('.price').text();
          return { custom: { price } };
        }
      }

      const html = `
        <html>
          <body>
            <div class="price">$29.99</div>
          </body>
        </html>
      `;

      const result = await scrapeHtml(html, 'https://example.com', {
        extractors: [...createDefaultExtractors(), new PriceExtractor()],
      });

      expect(result.custom?.price).toBe('$29.99');
    });
  });

  describe('Error handling - API doc examples', () => {
    it('throws ScrapeError with proper error codes', async () => {
      try {
        await scrape('https://this-domain-definitely-does-not-exist-12345.com', {
          timeout: 5000,
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof ScrapeError) {
          expect(error.code).toBeDefined();
          expect(typeof error.message).toBe('string');
          expect(typeof error.isRetryable()).toBe('boolean');
        } else {
          throw error;
        }
      }
    });
  });

  describe('scrape() with options - API doc examples', () => {
    it('supports all documented options', async () => {
      const result = await scrape('https://example.com', {
        timeout: 10000,
        userAgent: 'MyBot/1.0',
        respectRobots: true,
      });

      expect(result.url).toBeDefined();
      expect(result.title).toBeDefined();
    });
  });

  describe('scrape() - local server scenarios', () => {
    it('follows redirects and extracts content from the final response', async () => {
      const result = await scrape(`${serverBaseUrl}/redirect`);

      expect(result.url).toBe(`${serverBaseUrl}/redirect`);
      expect(result.canonicalUrl).toBe(`${serverBaseUrl}/blog/deep-dive`);
      expect(result.title).toBe('Deep Dive: Web Scraping');
    });

    it('rejects non-HTML content types', async () => {
      try {
        await scrape(`${serverBaseUrl}/image`);
        expect.fail('Should have thrown a parse error');
      } catch (error) {
        if (error instanceof ScrapeError) {
          expect(error.code).toBe('PARSE_ERROR');
        } else {
          throw error;
        }
      }
    });

    it('checks robots.txt before scraping when enabled', async () => {
      const robots = await checkRobotsTxt(`${serverBaseUrl}/blocked`);
      expect(robots.allowed).toBe(false);

      try {
        await scrape(`${serverBaseUrl}/blocked`, { respectRobots: true });
        expect.fail('Should have thrown a robots error');
      } catch (error) {
        if (error instanceof ScrapeError) {
          expect(error.code).toBe('ROBOTS_BLOCKED');
        } else {
          throw error;
        }
      }
    });
  });

  describe('ScrapedData result fields', () => {
    it('contains all documented fields', async () => {
      const result = await scrape('https://example.com');

      expect(typeof result.url).toBe('string');
      expect(typeof result.canonicalUrl).toBe('string');
      expect(typeof result.domain).toBe('string');
      expect(typeof result.title).toBe('string');
      expect(typeof result.description).toBe('string');
      expect(typeof result.content).toBe('string');
      expect(typeof result.textContent).toBe('string');
      expect(typeof result.excerpt).toBe('string');
      expect(typeof result.wordCount).toBe('number');
      expect(typeof result.contentType).toBe('string');
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(typeof result.scrapedAt).toBe('string');
      expect(typeof result.scrapeTimeMs).toBe('number');
    });
  });
});

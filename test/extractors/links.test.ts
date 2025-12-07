import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { LinksExtractor } from '@/extractors/links.js';
import type { ExtractionContext } from '@/core/types.js';

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

describe('LinksExtractor', () => {
  const extractor = new LinksExtractor();

  it('should have correct name and priority', () => {
    expect(extractor.name).toBe('links');
    expect(extractor.priority).toBe(30);
  });

  describe('link extraction', () => {
    it('should extract links from content', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://external.com/page">External Link</a>
              <a href="/internal/page">Internal Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(2);
    });

    it('should mark external links correctly', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://other.com/page">External</a>
              <a href="https://example.com/page">Internal</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      const external = result.links?.find((l) => l.url.includes('other.com'));
      const internal = result.links?.find((l) => l.url.includes('example.com'));

      expect(external?.isExternal).toBe(true);
      expect(internal?.isExternal).toBe(false);
    });

    it('should resolve relative URLs', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="/relative/path">Relative Link</a>
              <a href="./another/path">Another Relative</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(
        createContext(html, 'https://example.com/page/')
      );
      expect(result.links?.some((l) => l.url === 'https://example.com/relative/path')).toBe(true);
    });

    it('should extract link text', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/link">Link Text Here</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links?.[0]?.text).toBe('Link Text Here');
    });

    it('should fallback to title attribute for text', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/link" title="Title Text"></a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      // Falls back to title attribute when text is empty
      expect(result.links).toHaveLength(1);
      expect(result.links?.[0]?.text).toBe('Title Text');
    });
  });

  describe('link filtering', () => {
    it('should skip anchor links', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="#section">Anchor Link</a>
              <a href="https://example.com/real">Real Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
      expect(result.links?.[0]?.url).not.toContain('#');
    });

    it('should skip javascript links', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="javascript:void(0)">JS Link</a>
              <a href="https://example.com/real">Real Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });

    it('should skip mailto and tel links', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="mailto:test@example.com">Email</a>
              <a href="tel:+1234567890">Phone</a>
              <a href="https://example.com/real">Real Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });

    it('should skip links with very short text', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/a">X</a>
              <a href="https://example.com/b">Longer Text</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
      expect(result.links?.[0]?.text).toBe('Longer Text');
    });

    it('should deduplicate links', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/page">Link One</a>
              <a href="https://example.com/page">Link Two</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });
  });

  describe('navigation filtering', () => {
    it('should skip links in nav elements', async () => {
      const html = `
        <html>
          <body>
            <nav>
              <a href="https://example.com/nav">Nav Link</a>
            </nav>
            <article>
              <a href="https://example.com/content">Content Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
      expect(result.links?.[0]?.url).toContain('content');
    });

    it('should skip links in header elements', async () => {
      const html = `
        <html>
          <body>
            <header>
              <a href="https://example.com/header">Header Link</a>
            </header>
            <article>
              <a href="https://example.com/content">Content Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });

    it('should skip links in footer elements', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/content">Content Link</a>
            </article>
            <footer>
              <a href="https://example.com/footer">Footer Link</a>
            </footer>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });

    it('should skip links in elements with nav-like classes', async () => {
      const html = `
        <html>
          <body>
            <div class="navigation-menu">
              <a href="https://example.com/menu">Menu Link</a>
            </div>
            <article>
              <a href="https://example.com/content">Content Link</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });
  });

  describe('content area detection', () => {
    it('should prefer links in article tag', async () => {
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/article">Article Link</a>
            </article>
            <aside>
              <a href="https://example.com/aside">Aside Link</a>
            </aside>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
      expect(result.links?.[0]?.url).toContain('article');
    });

    it('should prefer links in main tag', async () => {
      const html = `
        <html>
          <body>
            <main>
              <a href="https://example.com/main">Main Link</a>
            </main>
            <aside>
              <a href="https://example.com/aside">Aside Link</a>
            </aside>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });

    it('should fallback to body if no article/main', async () => {
      const html = `
        <html>
          <body>
            <div>
              <a href="https://example.com/div">Div Link</a>
            </div>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(1);
    });
  });

  describe('limits', () => {
    it('should limit text length to 200 characters', async () => {
      const longText = 'A'.repeat(300);
      const html = `
        <html>
          <body>
            <article>
              <a href="https://example.com/link">${longText}</a>
            </article>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.links?.[0]?.text.length).toBe(200);
    });

    it('should limit to 100 links', async () => {
      const links = Array.from(
        { length: 150 },
        (_, i) => `<a href="https://example.com/link${i}">Link ${i}</a>`
      ).join('');
      const html = `<html><body><article>${links}</article></body></html>`;
      const result = await extractor.extract(createContext(html));
      expect(result.links).toHaveLength(100);
    });
  });
});

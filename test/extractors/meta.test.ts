import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { MetaExtractor } from '@/extractors/meta.js';
import type { ExtractionContext } from '@/core/types.js';

// Helper to create extraction context
function createContext(html: string, url = 'https://example.com'): ExtractionContext {
  const $ = cheerio.load(html);
  return {
    url,
    finalUrl: url,
    html,
    $,
    getDocument: () => {
      throw new Error('getDocument should not be called in MetaExtractor');
    },
    results: {},
    options: {},
  };
}

describe('MetaExtractor', () => {
  const extractor = new MetaExtractor();

  it('should have correct name and priority', () => {
    expect(extractor.name).toBe('meta');
    expect(extractor.priority).toBe(100);
  });

  describe('title extraction', () => {
    it('should extract og:title as primary', async () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
            <meta property="og:title" content="OG Title">
            <meta name="twitter:title" content="Twitter Title">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('OG Title');
    });

    it('should fallback to twitter:title', async () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
            <meta name="twitter:title" content="Twitter Title">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('Twitter Title');
    });

    it('should fallback to <title> tag', async () => {
      const html = '<html><head><title>Page Title</title></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.title).toBe('Page Title');
    });
  });

  describe('description extraction', () => {
    it('should extract og:description as primary', async () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Meta description">
            <meta property="og:description" content="OG description">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.description).toBe('OG description');
    });

    it('should fallback to meta description', async () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Meta description">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.description).toBe('Meta description');
    });
  });

  describe('image extraction', () => {
    it('should extract og:image', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:image" content="https://example.com/image.jpg">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    it('should fallback to twitter:image', async () => {
      const html = `
        <html>
          <head>
            <meta name="twitter:image" content="https://example.com/twitter.jpg">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.image).toBe('https://example.com/twitter.jpg');
    });
  });

  describe('author extraction', () => {
    it('should extract author from meta tag', async () => {
      const html = '<html><head><meta name="author" content="John Doe"></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.author).toBe('John Doe');
    });

    it('should extract author from article:author', async () => {
      const html = '<html><head><meta property="article:author" content="Jane Doe"></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.author).toBe('Jane Doe');
    });
  });

  describe('canonical URL extraction', () => {
    it('should extract from link[rel=canonical]', async () => {
      const html = `
        <html>
          <head>
            <link rel="canonical" href="https://example.com/canonical">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.canonicalUrl).toBe('https://example.com/canonical');
    });

    it('should fallback to og:url', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:url" content="https://example.com/og-url">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.canonicalUrl).toBe('https://example.com/og-url');
    });

    it('should fallback to finalUrl', async () => {
      const html = '<html><head></head></html>';
      const result = await extractor.extract(
        createContext(html, 'https://example.com/final')
      );
      expect(result.canonicalUrl).toBe('https://example.com/final');
    });
  });

  describe('date extraction', () => {
    it('should extract published date', async () => {
      const html = `
        <html>
          <head>
            <meta property="article:published_time" content="2024-01-15T10:00:00Z">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.publishedAt).toBe('2024-01-15T10:00:00Z');
    });

    it('should extract from time element', async () => {
      const html = `
        <html>
          <body>
            <time datetime="2024-01-15">Published Date</time>
          </body>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.publishedAt).toBe('2024-01-15');
    });

    it('should extract modified date', async () => {
      const html = `
        <html>
          <head>
            <meta property="article:modified_time" content="2024-02-01T12:00:00Z">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.modifiedAt).toBe('2024-02-01T12:00:00Z');
    });
  });

  describe('language extraction', () => {
    it('should extract from html lang attribute', async () => {
      const html = '<html lang="en-US"><head></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.language).toBe('en-US');
    });

    it('should fallback to og:locale', async () => {
      const html = '<html><head><meta property="og:locale" content="fr_FR"></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.language).toBe('fr_FR');
    });
  });

  describe('keywords extraction', () => {
    it('should extract and split keywords', async () => {
      const html = `
        <html>
          <head>
            <meta name="keywords" content="javascript, typescript, nodejs">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.keywords).toEqual(['javascript', 'typescript', 'nodejs']);
    });

    it('should return empty array when no keywords', async () => {
      const html = '<html><head></head></html>';
      const result = await extractor.extract(createContext(html));
      expect(result.keywords).toEqual([]);
    });
  });

  describe('site name extraction', () => {
    it('should extract og:site_name', async () => {
      const html = `
        <html>
          <head>
            <meta property="og:site_name" content="My Site">
          </head>
        </html>
      `;
      const result = await extractor.extract(createContext(html));
      expect(result.siteName).toBe('My Site');
    });
  });
});

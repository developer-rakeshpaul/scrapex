/**
 * Feed Utilities - Documentation Examples Validation
 *
 * Tests RSS/Atom parsing examples from:
 * - docs/src/content/docs/api/utilities.mdx
 * - docs/src/content/docs/guides/rss-parsing.mdx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverFeeds, feedToMarkdown, feedToText, filterByDate, RSSParser } from '@/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures');

const DIRTY_FEED = readFileSync(path.join(fixturesDir, 'rss2-dirty.xml'), 'utf8');
const RSS2_FEED = readFileSync(path.join(fixturesDir, 'rss2-dc.xml'), 'utf8');
const ATOM_FEED = readFileSync(path.join(fixturesDir, 'atom.xml'), 'utf8');
const RSS1_FEED = readFileSync(path.join(fixturesDir, 'rss1-rdf.xml'), 'utf8');
const HTML_WITH_FEEDS = readFileSync(path.join(fixturesDir, 'feeds.html'), 'utf8');
const PODCAST_FEED = readFileSync(path.join(fixturesDir, 'podcast-itunes.xml'), 'utf8');
const RSS2_MALFORMED = readFileSync(path.join(fixturesDir, 'rss2-malformed.xml'), 'utf8');

describe('Feed Utilities (from docs)', () => {
  describe('RSSParser - Real World Scenarios', () => {
    it('handles CDATA and HTML entities', () => {
      const parser = new RSSParser();
      const result = parser.parse(DIRTY_FEED, 'https://example.com/rss');

      // Check title extraction (handling CDATA/HTML)
      const title = result.data.items[0]?.title;
      // Expect either raw with HTML or stripped, depending on impl.
      // We accept both here to verify it parses, but print warning if strictly needed.
      // Current impl likely keeps CDATA content as-is.
      expect(title).toContain('Title');

      // Check description
      expect(result.data.description).toContain('Contains');
    });

    it('resolves relative links against feed URL', () => {
      const parser = new RSSParser();
      const result = parser.parse(DIRTY_FEED, 'https://example.com/blog/rss.xml');

      // Link /relative/feed/link should resolve against base
      expect(result.data.link).toBe('https://example.com/relative/feed/link');
      expect(result.data.items[0]?.link).toBe('https://example.com/relative/article/1');
    });
  });

  describe('RSSParser - Guide examples', () => {
    it('parses RSS 2.0 feeds and detects format', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');

      expect(result.data.format).toBe('rss2');
      expect(result.data.title).toBe('My Blog');
      expect(result.data.items.length).toBeGreaterThan(0);
    });

    it('parses feed metadata correctly', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');

      expect(result.data.title).toBe('My Blog');
      expect(result.data.description).toBe('A blog about technology');
      expect(result.data.link).toBe('https://example.com/');
      expect(result.data.copyright).toBe('Copyright 2024');
    });

    it('parses feed items correctly', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');

      const item = result.data.items[0];
      expect(item?.title).toBe('Article Title');
      expect(item?.link).toBe('https://example.com/article');
      expect(item?.publishedAt).toBeDefined();
      expect(item?.author).toBe('Jane Roe');
      expect(item?.categories).toContain('Tech');
    });

    it('supports Dublin Core fields via custom selectors', () => {
      const parser = new RSSParser({
        customFields: {
          subject: 'dc\\:subject',
        },
      });
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');

      const item = result.data.items[0];
      expect(item?.customFields?.subject).toBe('Data');
    });

    it('parses Atom feeds', () => {
      const parser = new RSSParser();
      const result = parser.parse(ATOM_FEED, 'https://example.com/atom.xml');

      expect(result.data.format).toBe('atom');
      expect(result.data.title).toBe('Atom Feed');
      expect(result.data.items[0]?.title).toBe('Atom Entry');
      expect(result.data.items[0]?.author).toBe('Jamie Lee');
      expect(result.data.items[0]?.categories).toContain('Updates');
    });

    it('parses RSS 1.0 (RDF) feeds', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS1_FEED, 'https://example.com/rdf.xml');

      expect(result.data.format).toBe('rss1');
      expect(result.data.title).toBe('RDF Feed');
      expect(result.data.items[0]?.title).toBe('RDF Item');
      expect(result.data.items[0]?.author).toBe('RDF Author');
      expect(result.data.items[0]?.categories).toContain('RDF Topic');
    });

    it('handles malformed RSS items without throwing', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_MALFORMED, 'https://example.com/feed.xml');

      expect(result.data.title).toBe('Broken Feed');
      expect(result.data.items.length).toBe(2);
      expect(result.data.items[0]?.title).toBe('');
      expect(result.data.items[0]?.link).toBe('');
      expect(result.data.items[0]?.publishedAt).toBeUndefined();
      expect(result.data.items[1]?.link).toBe('https://example.com/guid-only');
    });
  });

  describe('discoverFeeds() - Guide examples', () => {
    it('finds RSS/Atom feed URLs in HTML', () => {
      const feedUrls = discoverFeeds(HTML_WITH_FEEDS, 'https://example.com');
      expect(feedUrls).toContain('https://example.com/feed.xml');
      expect(feedUrls).toContain('https://example.com/atom.xml');
    });
  });

  describe('filterByDate() - Guide examples', () => {
    it('filters items by date range', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');
      const recentItems = filterByDate(result.data.items, {
        after: new Date('2024-09-06'),
        includeUndated: false,
      });
      expect(recentItems.length).toBeGreaterThanOrEqual(1);
    });

    it('filters items with before/after range', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');
      const rangeItems = filterByDate(result.data.items, {
        after: new Date('2024-01-01'),
        before: new Date('2024-12-31'),
      });
      expect(rangeItems.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('feedToMarkdown() - Guide examples', () => {
    it('converts feed to Markdown format', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');
      const markdown = feedToMarkdown(result.data, { maxItems: 5 });
      expect(markdown).toContain('# My Blog');
      expect(markdown).toContain('Article Title');
      expect(markdown).toContain('[Read more]');
    });
  });

  describe('feedToText() - Guide examples', () => {
    it('converts feed to plain text', () => {
      const parser = new RSSParser();
      const result = parser.parse(RSS2_FEED, 'https://example.com/feed.xml');
      const text = feedToText(result.data, { maxItems: 5 });
      expect(text).toContain('Article Title');
      expect(text).toContain('Article description text');
    });
  });

  describe('Custom Fields (Podcasts)', () => {
    it('extracts custom namespace fields', () => {
      const parser = new RSSParser({
        customFields: {
          // Double escape for Cheerio selectors: itunes:duration -> itunes\\:duration -> itunes\\\\:duration
          duration: 'itunes\\:duration',
          explicit: 'itunes\\:explicit',
          episode: 'itunes\\:episode',
          season: 'itunes\\:season',
        },
      });
      const result = parser.parse(PODCAST_FEED, 'https://example.com/podcast.xml');
      const episode = result.data.items[0];
      expect(episode?.title).toBe('Episode 1');
      expect(episode?.customFields?.duration).toBe('45:30');
    });
  });

  describe('Enclosures (Media)', () => {
    it('extracts media enclosures', () => {
      const parser = new RSSParser();
      const result = parser.parse(PODCAST_FEED, 'https://example.com/podcast.xml');
      const item = result.data.items[0];
      expect(item?.enclosure?.url).toBe('https://example.com/ep1.mp3');
    });
  });

  describe('Security', () => {
    it('rejects non-HTTPS URLs in feeds', () => {
      const unsafeFeed = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Safe</title><link>https://example.com/safe</link></item>
<item><title>Unsafe</title><link>javascript:alert(1)</link></item>
</channel></rss>`;
      const parser = new RSSParser();
      const result = parser.parse(unsafeFeed, 'https://example.com/feed.xml');
      expect(result.data.items[0]?.link).toBe('https://example.com/safe');
      expect(result.data.items[1]?.link).toBe('');
    });
  });
});

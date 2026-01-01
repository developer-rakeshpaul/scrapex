import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RSSParser } from '../../src/parsers/rss.js';
import { 
  fetchFeed, 
  discoverFeeds, 
  filterByDate, 
  feedToMarkdown, 
  feedToText, 
  paginateFeed 
} from '../../src/utils/feed.js';
import { NativeFetcher } from '../../src/fetchers/fetch.js';
import type { FetchResult } from '../../src/fetchers/types.js';

// Read fixtures
const fixturesDir = path.join(__dirname, '../fixtures');
const rss2Content = fs.readFileSync(path.join(fixturesDir, 'rss2-basic.xml'), 'utf-8');
const atomContent = fs.readFileSync(path.join(fixturesDir, 'atom-basic.xml'), 'utf-8');
const atomUnsafeContent = fs.readFileSync(path.join(fixturesDir, 'atom-unsafe-links.xml'), 'utf-8');
const rss1Content = fs.readFileSync(path.join(fixturesDir, 'rss1-basic.xml'), 'utf-8');

describe('RSSParser', () => {
  it('should parse RSS 2.0 feeds', () => {
    const parser = new RSSParser();
    expect(parser.canParse(rss2Content)).toBe(true);
    
    const result = parser.parse(rss2Content, 'https://example.com/feed.xml');
    const { data } = result;

    expect(data.format).toBe('rss2');
    expect(data.title).toBe('Scrapex RSS 2.0 Test');
    expect(data.link).toBe('https://example.com/'); // Normalized
    expect(data.copyright).toBe('Copyright 2024');
    expect(data.items).toHaveLength(2);

    const item1 = data.items[0];
    expect(item1.title).toBe('RSS Item 1');
    expect(item1.link).toBe('https://example.com/item1');
    expect(item1.description).toBe('This is a short description.');
    expect(item1.content).toBe('This is the full content.');
    expect(item1.author).toBe('John Doe');
    expect(item1.categories).toEqual(['Tech', 'News']);
    expect(item1.enclosure).toEqual({
      url: 'https://example.com/podcast.mp3',
      length: 123456,
      type: 'audio/mpeg'
    });

    const item2 = data.items[1];
    expect(item2.author).toBe('Jane Smith'); // dc:creator fallback
    expect(item2.id).toBe('abc-123'); // guid
  });

  it('should parse Atom feeds', () => {
    const parser = new RSSParser();
    expect(parser.canParse(atomContent)).toBe(true);

    const result = parser.parse(atomContent, 'https://example.com/atom');
    const { data } = result;

    expect(data.format).toBe('atom');
    expect(data.title).toBe('Scrapex Atom Test');
    expect(data.next).toBe('https://example.com/atom?page=2');
    
    const item = data.items[0];
    expect(item.title).toBe('Atom Entry 1');
    expect(item.id).toBe('urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a');
    expect(item.publishedAt).toBe('2024-09-06T16:45:00.000Z');
    expect(item.categories).toEqual(['Atom', 'Testing']);
  });

  it('should parse RSS 1.0 (RDF) feeds', () => {
    const parser = new RSSParser();
    expect(parser.canParse(rss1Content)).toBe(true);

    const result = parser.parse(rss1Content);
    const { data } = result;

    expect(data.format).toBe('rss1');
    expect(data.title).toBe('Scrapex RSS 1.0 Test');
    
    const item = data.items[0];
    expect(item.title).toBe('RSS 1.0 Item');
    expect(item.link).toBe('https://example.com/item1');
    expect(item.categories).toEqual(['RDF Category']); // dc:subject
  });

  it('should drop non-https links', () => {
    const parser = new RSSParser();
    const result = parser.parse(atomUnsafeContent, 'https://example.com/atom');
    const { data } = result;

    expect(data.link).toBe('https://example.com/atom');
    expect(data.items[0].link).toBe('');
    expect(data.items[1].link).toBe('');
  });

  it('should resolve protocol-relative URLs to HTTPS when base is HTTPS', () => {
    const protocolRelativeXml = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <link>//example.com/</link>
          <item>
            <title>Item with protocol-relative link</title>
            <link>//example.com/article</link>
          </item>
        </channel>
      </rss>
    `;

    const parser = new RSSParser();
    const result = parser.parse(protocolRelativeXml, 'https://example.com/feed.xml');
    const { data } = result;

    // Protocol-relative URLs should resolve to HTTPS (base URL protocol)
    expect(data.link).toBe('https://example.com/');
    expect(data.items[0].link).toBe('https://example.com/article');
  });

  it('should drop protocol-relative URLs when base is HTTP (resolves to non-HTTPS)', () => {
    const protocolRelativeXml = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <link>//example.com/</link>
          <item>
            <title>Item</title>
            <link>//example.com/article</link>
          </item>
        </channel>
      </rss>
    `;

    const parser = new RSSParser();
    // When base URL is HTTP, protocol-relative URLs resolve to HTTP, which is then dropped
    const result = parser.parse(protocolRelativeXml, 'http://example.com/feed.xml');
    const { data } = result;

    // These should be empty because they resolve to HTTP, not HTTPS
    expect(data.link).toBe('');
    expect(data.items[0].link).toBe('');
  });
  it('should extract custom fields', () => {
    const customXml = `
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <title>Podcast</title>
          <item>
            <title>Episode 1</title>
            <itunes:duration>10:00</itunes:duration>
            <itunes:explicit>no</itunes:explicit>
          </item>
        </channel>
      </rss>
    `;

    const parser = new RSSParser({
      customFields: {
        duration: 'itunes\\:duration',
        explicit: 'itunes\\:explicit'
      }
    });

    const result = parser.parse(customXml);
    const item = result.data.items[0];

    expect(item.customFields).toEqual({
      duration: '10:00',
      explicit: 'no'
    });
  });
});

describe('Feed Utilities', () => {
  it('should discover feeds in HTML', () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
          <link rel="alternate" type="application/atom+xml" href="https://example.com/atom" />
        </head>
      </html>
    `;
    const feeds = discoverFeeds(html, 'https://example.com');
    expect(feeds).toEqual([
      'https://example.com/feed.xml',
      'https://example.com/atom'
    ]);
  });

  it('should filter items by date', () => {
    const items = [
      { title: 'New', publishedAt: '2024-01-01T00:00:00Z', link: '', id: '', categories: [] },
      { title: 'Old', publishedAt: '2023-01-01T00:00:00Z', link: '', id: '', categories: [] },
      { title: 'Undated', link: '', id: '', categories: [] },
    ];

    const filtered = filterByDate(items, {
      after: new Date('2023-12-31'),
      includeUndated: false
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('New');

    const withUndated = filterByDate(items, {
      after: new Date('2023-12-31'),
      includeUndated: true
    });
    expect(withUndated).toHaveLength(2);
  });

  it('should convert feed to markdown', () => {
    const parser = new RSSParser();
    const result = parser.parse(rss2Content);
    const markdown = feedToMarkdown(result.data, { maxItems: 1 });

    expect(markdown).toContain('# Scrapex RSS 2.0 Test');
    expect(markdown).toContain('## RSS Item 1');
    expect(markdown).toContain('*2024-09-06*');
    expect(markdown).toContain('This is a short description.');
    expect(markdown).not.toContain('RSS Item 2');
  });

  it('should not emit non-https links in markdown', () => {
    const parser = new RSSParser();
    const result = parser.parse(atomUnsafeContent, 'https://example.com/atom');
    const markdown = feedToMarkdown(result.data);

    expect(markdown).not.toContain('javascript:');
    expect(markdown).not.toContain('data:');
    expect(markdown).not.toContain('file:');
  });

  it('should fetch and parse feeds', async () => {
    const mockFetcher = {
      name: 'mock',
      fetch: vi.fn().mockResolvedValue({
        html: rss2Content,
        finalUrl: 'https://example.com/feed.xml',
        statusCode: 200,
        contentType: 'application/rss+xml'
      } as FetchResult)
    };

    const result = await fetchFeed('https://example.com/feed.xml', {
      fetcher: mockFetcher
    });

    expect(mockFetcher.fetch).toHaveBeenCalledWith('https://example.com/feed.xml', expect.objectContaining({
      allowedContentTypes: expect.arrayContaining(['application/rss+xml'])
    }));
    expect(result.data.title).toBe('Scrapex RSS 2.0 Test');
  });

  it('should paginate feeds', async () => {
    const mockFetcher = {
      name: 'mock',
      fetch: vi.fn()
        .mockResolvedValueOnce({
          html: atomContent, // Has next link
          finalUrl: 'https://example.com/atom',
          statusCode: 200,
          contentType: 'application/atom+xml'
        } as FetchResult)
        .mockResolvedValueOnce({
          html: atomContent.replace('rel="next"', 'rel="prev"'), // No next link
          finalUrl: 'https://example.com/atom?page=2',
          statusCode: 200,
          contentType: 'application/atom+xml'
        } as FetchResult)
    };

    const pages = [];
    for await (const page of paginateFeed('https://example.com/atom', { fetcher: mockFetcher })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(mockFetcher.fetch).toHaveBeenCalledTimes(2);
    expect(mockFetcher.fetch).toHaveBeenNthCalledWith(2, 'https://example.com/atom?page=2', expect.any(Object));
  });
});

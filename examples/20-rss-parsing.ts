/**
 * 20-rss-parsing.ts
 *
 * Parse RSS/Atom feeds using the built-in RSSParser and feed utilities.
 *
 * Run: npx tsx examples/20-rss-parsing.ts
 */

import {
  discoverFeeds,
  feedToMarkdown,
  fetchFeed,
  filterByDate,
  normalizeFeedItem,
  RSSParser,
} from '../src/index.js';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <link>https://example.com/</link>
    <description>Sample RSS feed for scrapex</description>
    <language>en-us</language>
    <item>
      <title>First Post</title>
      <link>https://example.com/posts/1</link>
      <guid>https://example.com/posts/1</guid>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <category>News</category>
      <description>A short description for the first post.</description>
      <content:encoded><![CDATA[<p>Full content for the <strong>first</strong> post.</p>]]></content:encoded>
      <enclosure url="https://example.com/media/episode1.mp3" type="audio/mpeg" length="12345" />
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/posts/2</link>
      <guid>https://example.com/posts/2</guid>
      <pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate>
      <category>Updates</category>
      <description>Another short description.</description>
    </item>
  </channel>
</rss>
`;

async function main() {
  console.log('=== RSS Parsing Example ===\n');

  // Example 1: Parse from raw XML
  const parser = new RSSParser();
  const parsed = parser.parse(SAMPLE_RSS, 'https://example.com/feed.xml');

  console.log('Feed:', parsed.data.title);
  console.log('Format:', parsed.data.format);
  console.log('Items:', parsed.data.items.length);
  console.log('First item:', {
    title: parsed.data.items[0]?.title,
    link: parsed.data.items[0]?.link,
    publishedAt: parsed.data.items[0]?.publishedAt,
    enclosure: parsed.data.items[0]?.enclosure?.url,
  });

  if (parsed.data.items[0]) {
    const normalized = await normalizeFeedItem(parsed.data.items[0], {
      removeBoilerplate: true,
      mode: 'full',
    });
    console.log('\n--- Normalized First Item ---');
    console.log(normalized.text);
  }

  console.log('\n--- Markdown Preview ---');
  console.log(feedToMarkdown(parsed.data, { maxItems: 2 }));

  // Example 2: Discover feed URLs from HTML
  const html = `
    <html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
        <link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml" />
      </head>
    </html>
  `;

  const feeds = discoverFeeds(html, 'https://example.com/blog');
  console.log('\nDiscovered feeds:', feeds);

  // Example 3: Fetch a live feed (optional)
  if (process.env.FEED_URL) {
    console.log('\n--- Fetching Live Feed ---');
    const result = await fetchFeed(process.env.FEED_URL, { timeout: 10_000 });
    const recent = filterByDate(result.data.items, {
      after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    console.log('Feed:', result.data.title);
    console.log('Total items:', result.data.items.length);
    console.log('Items in last 7 days:', recent.length);
  }
}

main().catch(console.error);

import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type {
  FeedEnclosure,
  FeedItem,
  FeedMeta,
  ParsedFeed,
  ParserResult,
  SourceParser,
} from "./types.js";

export interface RSSParserOptions {
  /**
   * Map of custom field names to CSS selectors or XML tag names.
   * Useful for extracting podcast/media namespace fields.
   * @example { duration: "itunes\:duration", rating: "media\:rating" }
   */
  customFields?: Record<string, string>;
}

/**
 * RSS/Atom feed parser.
 * Supports RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 formats.
 *
 * @example
 * ```ts
 * import { RSSParser } from 'scrapex/parsers';
 *
 * const parser = new RSSParser();
 * const result = parser.parse(feedXml, 'https://example.com/feed.xml');
 *
 * console.log(result.data.title);
 * console.log(result.data.items);
 * ```
 */
export class RSSParser implements SourceParser<ParsedFeed, FeedMeta> {
  readonly name = "rss";
  private customFields: Record<string, string>;

  constructor(options?: RSSParserOptions) {
    this.customFields = options?.customFields || {};
  }

  canParse(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      lower.includes("<rss") ||
      lower.includes("<feed") ||
      lower.includes("<rdf:rdf")
    );
  }

  parse(content: string, url?: string): ParserResult<ParsedFeed, FeedMeta> {
    // Cheerio's xml: true mode disables HTML entities and structure fixes,
    // effectively preventing many XSS/injection vectors during parsing.
    const $ = cheerio.load(content, { xml: true });

    // Detect format and parse
    if ($("feed").length > 0) {
      return this.parseAtom($, url);
    } else if ($("rdf\\:RDF, RDF").length > 0) {
      return this.parseRSS1($, url);
    } else {
      return this.parseRSS2($, url);
    }
  }

  private parseRSS2(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const channel = $("channel");
    const feedLink = channel.find("> link").text();
    const resolveBase = baseUrl || feedLink;

    const items: FeedItem[] = $("item")
      .map((_, el) => {
        const $item = $(el);
        const itemLink = $item.find("link").text();
        const guid = $item.find("guid").text();
        const pubDate = $item.find("pubDate").text();

        // Resolve link with fallback to guid if it's a URL
        const resolvedLink = this.resolveLink(itemLink, guid, resolveBase);

        return {
          id: guid || itemLink,
          title: $item.find("title").text(),
          link: resolvedLink,
          description: this.parseText($item.find("description")),
          content: this.parseContentEncoded($item.find("content\\:encoded")),
          author:
            $item.find("author").text() ||
            $item.find("dc\\:creator").text() ||
            undefined,
          publishedAt: this.parseDate(pubDate),
          rawPublishedAt: pubDate || undefined,
          categories: this.parseCategories(
            $item
              .find("category")
              .map((_, c) => $(c).text())
              .get()
          ),
          enclosure: this.parseEnclosure($item.find("enclosure"), resolveBase),
          customFields: this.extractCustomFields($item),
        };
      })
      .get();

    return {
      data: {
        format: "rss2",
        title: channel.find("> title").text(),
        description: channel.find("> description").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        language: channel.find("> language").text() || undefined,
        lastBuildDate: this.parseDate(channel.find("> lastBuildDate").text()),
        copyright: channel.find("> copyright").text() || undefined,
        items,
        customFields: this.extractCustomFields(channel),
      },
      meta: {
        generator: channel.find("> generator").text() || undefined,
        ttl: this.parseNumber(channel.find("> ttl").text()),
        image: this.parseImage(channel.find("> image"), resolveBase),
        categories: this.parseCategories(
          channel
            .find("> category")
            .map((_, c) => $(c).text())
            .get()
        ),
      },
    };
  }

  private parseAtom(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const feed = $("feed");
    const feedLink =
      feed.find('> link[rel="alternate"], > link:not([rel])').attr("href") ||
      "";
    const nextLink = feed.find('> link[rel="next"]').attr("href");
    const resolveBase = baseUrl || feedLink;

    const items: FeedItem[] = $("entry")
      .map((_, el) => {
        const $entry = $(el);
        const entryLink =
          $entry.find('link[rel="alternate"], link:not([rel])').attr("href") ||
          "";
        const entryId = $entry.find("id").text();
        const published = $entry.find("published").text();
        const updated = $entry.find("updated").text();

        // Resolve link with fallback to id if it's a URL
        const resolvedLink = this.resolveLink(entryLink, entryId, resolveBase);

        return {
          id: entryId,
          title: $entry.find("title").text(),
          link: resolvedLink,
          description: this.parseText($entry.find("summary")),
          content: this.parseText($entry.find("content")),
          author: $entry.find("author name").text() || undefined,
          publishedAt: this.parseDate(published),
          rawPublishedAt: published || updated || undefined,
          updatedAt: this.parseDate(updated),
          categories: this.parseCategories(
            $entry
              .find("category")
              .map((_, c) => $(c).attr("term"))
              .get()
          ),
          customFields: this.extractCustomFields($entry),
        };
      })
      .get();

    return {
      data: {
        format: "atom",
        title: feed.find("> title").text(),
        description: feed.find("> subtitle").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        next: nextLink ? this.resolveUrl(nextLink, resolveBase) : undefined,
        language: feed.attr("xml:lang") || undefined,
        lastBuildDate: this.parseDate(feed.find("> updated").text()),
        copyright: feed.find("> rights").text() || undefined,
        items,
        customFields: this.extractCustomFields(feed),
      },
      meta: {
        generator: feed.find("> generator").text() || undefined,
        image: this.parseAtomImage(feed, resolveBase),
        categories: this.parseCategories(
          feed
            .find("> category")
            .map((_, c) => $(c).attr("term"))
            .get()
        ),
      },
    };
  }

  private parseRSS1(
    $: cheerio.CheerioAPI,
    baseUrl?: string
  ): ParserResult<ParsedFeed, FeedMeta> {
    const channel = $("channel");
    const feedLink = channel.find("link").text();
    const resolveBase = baseUrl || feedLink;

    // RSS 1.0 items are siblings of channel, not children
    const items: FeedItem[] = $("item")
      .map((_, el) => {
        const $item = $(el);
        const itemLink = $item.find("link").text();
        const rdfAbout = $item.attr("rdf:about") || "";
        const dcDate = $item.find("dc\\:date").text();

        // Resolve link with fallback to rdf:about
        const resolvedLink = this.resolveLink(itemLink, rdfAbout, resolveBase);

        // Extract dc:subject as categories (RSS 1.0 uses Dublin Core)
        const dcSubjects = $item
          .find("dc\\:subject")
          .map((_, s) => $(s).text())
          .get();

        return {
          id: rdfAbout || itemLink,
          title: $item.find("title").text(),
          link: resolvedLink,
          description: this.parseText($item.find("description")),
          content: this.parseContentEncoded($item.find("content\\:encoded")),
          author: $item.find("dc\\:creator").text() || undefined,
          publishedAt: this.parseDate(dcDate),
          rawPublishedAt: dcDate || undefined,
          categories: this.parseCategories(dcSubjects),
          customFields: this.extractCustomFields($item),
        };
      })
      .get();

    // Parse RDF image element (sibling of channel)
    const rdfImage = $("image");
    const imageUrl =
      rdfImage.find("url").text() || rdfImage.attr("rdf:resource");

    return {
      data: {
        format: "rss1",
        title: channel.find("title").text(),
        description: channel.find("description").text() || undefined,
        link: this.resolveUrl(feedLink, resolveBase),
        language: channel.find("dc\\:language").text() || undefined,
        lastBuildDate: this.parseDate(channel.find("dc\\:date").text()),
        copyright: channel.find("dc\\:rights").text() || undefined,
        items,
        customFields: this.extractCustomFields(channel),
      },
      meta: {
        generator:
          channel.find("admin\\:generatorAgent").attr("rdf:resource") ||
          undefined,
        image: imageUrl
          ? {
              url: this.resolveUrl(imageUrl, resolveBase),
              title: rdfImage.find("title").text() || undefined,
              link:
                this.resolveUrl(rdfImage.find("link").text(), resolveBase) ||
                undefined,
            }
          : undefined,
        categories: this.parseCategories(
          channel
            .find("dc\\:subject")
            .map((_, s) => $(s).text())
            .get()
        ),
      },
    };
  }

  /**
   * Extract custom fields from an element using configured selectors.
   */
  private extractCustomFields(
    $el: cheerio.Cheerio<Element>
  ): Record<string, string> | undefined {
    if (Object.keys(this.customFields).length === 0) return undefined;

    const fields: Record<string, string> = {};
    for (const [key, selector] of Object.entries(this.customFields)) {
      const value = $el.find(selector).text().trim();
      if (value) {
        fields[key] = value;
      }
    }

    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  /**
   * Parse date string to ISO 8601 format.
   * Returns undefined if parsing fails (never returns raw strings).
   */
  private parseDate(dateStr: string): string | undefined {
    if (!dateStr?.trim()) return undefined;

    try {
      const date = new Date(dateStr);
      // Check for invalid date
      if (Number.isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    } catch {
      return undefined;
    }
  }

  /**
   * Parse element text content, returning undefined if empty.
   */
  private parseText($el: cheerio.Cheerio<Element>): string | undefined {
    const text = $el.text().trim();
    return text || undefined;
  }

  /**
   * Parse content:encoded, stripping HTML tags from CDATA content.
   */
  private parseContentEncoded($el: cheerio.Cheerio<Element>): string | undefined {
    const raw = $el.text().trim();
    if (!raw) return undefined;
    return raw.replace(/<[^>]+>/g, "").trim() || undefined;
  }

  /**
   * Parse categories/tags, filtering out empty strings.
   */
  private parseCategories(categories: (string | undefined)[]): string[] {
    return categories
      .map((c) => c?.trim())
      .filter((c): c is string => !!c && c.length > 0);
  }

  /**
   * Resolve a URL against a base URL.
   * Only allows https scheme; all other schemes are rejected.
   */
  private resolveUrl(url: string, base?: string): string {
    if (!url?.trim()) return "";

    try {
      const resolved = base ? new URL(url, base) : new URL(url);
      return resolved.protocol === "https:" ? resolved.href : "";
    } catch {
      return "";
    }
  }

  /**
   * Resolve link with fallback to id/guid if primary link is empty and id is a URL.
   * Only allows https scheme; all other schemes are rejected.
   */
  private resolveLink(
    primaryLink: string,
    fallbackId: string,
    base?: string
  ): string {
    // Try primary link first
    if (primaryLink?.trim()) {
      return this.resolveUrl(primaryLink, base);
    }

    // Fallback to id if it looks like a URL
    if (fallbackId?.trim()) {
      try {
        const resolvedId = new URL(fallbackId);
        return resolvedId.protocol === "https:" ? resolvedId.href : "";
      } catch {
        // Not a valid URL, try resolving against base
        return this.resolveUrl(fallbackId, base);
      }
    }

    return "";
  }

  /**
   * Parse enclosure element with URL resolution.
   */
  private parseEnclosure(
    $enc: cheerio.Cheerio<Element>,
    baseUrl?: string
  ): FeedEnclosure | undefined {
    const url = $enc.attr("url");
    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
      type: $enc.attr("type") || undefined,
      length: this.parseNumber($enc.attr("length")),
    };
  }

  /**
   * Parse RSS image element with URL resolution.
   */
  private parseImage(
    $img: cheerio.Cheerio<Element>,
    baseUrl?: string
  ): FeedMeta["image"] | undefined {
    const url = $img.find("url").text();
    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
      title: $img.find("title").text() || undefined,
      link: this.resolveUrl($img.find("link").text(), baseUrl) || undefined,
    };
  }

  /**
   * Parse Atom logo/icon element with URL resolution.
   */
  private parseAtomImage(
    $feed: cheerio.Cheerio<Element>,
    baseUrl?: string
  ): FeedMeta["image"] | undefined {
    const logo = $feed.find("> logo").text();
    const icon = $feed.find("> icon").text();
    const url = logo || icon;

    if (!url) return undefined;

    return {
      url: this.resolveUrl(url, baseUrl),
    };
  }

  /**
   * Parse a string to number, returning undefined if invalid.
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? undefined : num;
  }
}

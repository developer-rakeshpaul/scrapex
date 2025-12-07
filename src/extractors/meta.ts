import type { ExtractionContext, Extractor, ScrapedData } from '@/core/types.js';

/**
 * Extracts metadata from HTML meta tags, Open Graph, and Twitter cards.
 * Runs first to provide basic metadata for other extractors.
 */
export class MetaExtractor implements Extractor {
  readonly name = 'meta';
  readonly priority = 100; // High priority - runs first

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;

    // Helper to get meta content by name or property
    const getMeta = (nameOrProperty: string): string | undefined => {
      const value =
        $(`meta[name="${nameOrProperty}"]`).attr('content') ||
        $(`meta[property="${nameOrProperty}"]`).attr('content') ||
        $(`meta[itemprop="${nameOrProperty}"]`).attr('content');
      return value?.trim() || undefined;
    };

    // Title (priority: og:title > twitter:title > <title>)
    const title =
      getMeta('og:title') || getMeta('twitter:title') || $('title').first().text().trim() || '';

    // Description (priority: og:description > twitter:description > meta description)
    const description =
      getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';

    // Image (priority: og:image > twitter:image)
    const image =
      getMeta('og:image') || getMeta('twitter:image') || getMeta('twitter:image:src') || undefined;

    // Canonical URL
    const canonicalUrl =
      $('link[rel="canonical"]').attr('href') || getMeta('og:url') || context.finalUrl;

    // Author
    const author =
      getMeta('author') ||
      getMeta('article:author') ||
      getMeta('twitter:creator') ||
      $('[rel="author"]').first().text().trim() ||
      undefined;

    // Site name
    const siteName = getMeta('og:site_name') || getMeta('application-name') || undefined;

    // Published/Modified dates
    const publishedAt =
      getMeta('article:published_time') ||
      getMeta('datePublished') ||
      getMeta('date') ||
      $('time[datetime]').first().attr('datetime') ||
      undefined;

    const modifiedAt = getMeta('article:modified_time') || getMeta('dateModified') || undefined;

    // Language
    const language =
      $('html').attr('lang') || getMeta('og:locale') || getMeta('language') || undefined;

    // Keywords
    const keywordsRaw = getMeta('keywords') || getMeta('article:tag') || '';
    const keywords = keywordsRaw
      ? keywordsRaw
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    return {
      title,
      description,
      image,
      canonicalUrl,
      author,
      siteName,
      publishedAt,
      modifiedAt,
      language,
      keywords,
    };
  }
}

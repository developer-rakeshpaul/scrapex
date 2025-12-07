import type { ExtractionContext, Extractor, ScrapedData } from '@/core/types.js';
import { resolveUrl } from '@/utils/url.js';

/**
 * Extracts favicon URL from the page.
 * Checks multiple sources in order of preference.
 */
export class FaviconExtractor implements Extractor {
  readonly name = 'favicon';
  readonly priority = 70;

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $, finalUrl } = context;

    // Check various favicon link relations in order of preference
    const faviconSelectors = [
      'link[rel="icon"][type="image/svg+xml"]', // SVG (best quality)
      'link[rel="icon"][sizes="192x192"]',
      'link[rel="icon"][sizes="180x180"]',
      'link[rel="icon"][sizes="128x128"]',
      'link[rel="icon"][sizes="96x96"]',
      'link[rel="apple-touch-icon"][sizes="180x180"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"][sizes="32x32"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
    ];

    for (const selector of faviconSelectors) {
      const href = $(selector).first().attr('href');
      if (href) {
        return {
          favicon: resolveUrl(finalUrl, href),
        };
      }
    }

    // Fallback: try /favicon.ico
    try {
      const url = new URL(finalUrl);
      return {
        favicon: `${url.protocol}//${url.host}/favicon.ico`,
      };
    } catch {
      return {};
    }
  }
}

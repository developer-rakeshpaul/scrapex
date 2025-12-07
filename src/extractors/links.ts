import type { ExtractedLink, ExtractionContext, Extractor, ScrapedData } from '@/core/types.js';
import { extractDomain, isExternalUrl, isValidUrl, resolveUrl } from '@/utils/url.js';

/**
 * Extracts links from the page content.
 * Filters out navigation/footer links and focuses on content links.
 */
export class LinksExtractor implements Extractor {
  readonly name = 'links';
  readonly priority = 30; // Runs last

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $, finalUrl } = context;
    const links: ExtractedLink[] = [];
    const seen = new Set<string>();

    // Extract links from main content area (article, main, or body)
    const contentArea = $('article, main, [role="main"]').first();
    const container = contentArea.length > 0 ? contentArea : $('body');

    // Skip links in navigation, header, footer, sidebar
    const skipSelectors =
      'nav, header, footer, aside, [role="navigation"], [class*="nav"], [class*="footer"], [class*="header"], [class*="sidebar"], [class*="menu"]';

    container.find('a[href]').each((_, el) => {
      const $el = $(el);

      // Skip if inside navigation/footer elements
      if ($el.closest(skipSelectors).length > 0) {
        return;
      }

      const href = $el.attr('href');
      if (!href) return;

      // Skip anchors, javascript, mailto, tel
      if (
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }

      // Resolve relative URLs
      const resolvedUrl = resolveUrl(href, finalUrl);
      if (!resolvedUrl || !isValidUrl(resolvedUrl)) return;

      // Skip duplicates
      if (seen.has(resolvedUrl)) return;
      seen.add(resolvedUrl);

      // Get link text
      const text = $el.text().trim() || $el.attr('title') || $el.attr('aria-label') || '';

      // Skip empty or very short link text (likely icons)
      if (text.length < 2) return;

      const baseDomain = extractDomain(finalUrl);
      links.push({
        url: resolvedUrl,
        text: text.slice(0, 200), // Limit text length
        isExternal: isExternalUrl(resolvedUrl, baseDomain),
      });
    });

    return {
      links: links.slice(0, 100), // Limit to 100 links
    };
  }
}

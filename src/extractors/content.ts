import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ContentType, ExtractionContext, Extractor, ScrapedData } from '@/core/types.js';

// Initialize Turndown with sensible defaults
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// Remove script, style, and other noise
turndown.remove(['script', 'style', 'noscript', 'iframe', 'nav', 'footer']);

/**
 * Extracts main content using Mozilla Readability.
 * Converts HTML to Markdown for LLM consumption.
 */
export class ContentExtractor implements Extractor {
  readonly name = 'content';
  readonly priority = 50; // Medium priority - runs after meta

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { options } = context;

    // Skip if content extraction is disabled
    if (options.extractContent === false) {
      return {};
    }

    // Use JSDOM for Readability (lazy-loaded)
    const document = context.getDocument();
    const clonedDoc = document.cloneNode(true) as Document;

    // Run Readability
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (!article || !article.content) {
      // Fallback: extract body text
      return this.extractFallback(context);
    }

    // Convert to markdown
    let content = turndown.turndown(article.content);

    // Truncate if needed
    const maxLength = options.maxContentLength ?? 50000;
    if (content.length > maxLength) {
      content = `${content.slice(0, maxLength)}\n\n[Content truncated...]`;
    }

    // Plain text content
    const textContent = (article.textContent ?? '').trim();

    // Create excerpt
    const excerpt = this.createExcerpt(textContent);

    // Word count
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;

    // Detect content type
    const contentType = this.detectContentType(context);

    return {
      content,
      textContent,
      excerpt: article.excerpt || excerpt,
      wordCount,
      contentType,
      // Readability may provide better values than meta tags
      title: article.title || undefined,
      author: article.byline || undefined,
      siteName: article.siteName || undefined,
    };
  }

  private extractFallback(context: ExtractionContext): Partial<ScrapedData> {
    const { $ } = context;

    // Try to get body content
    const bodyHtml = $('body').html() || '';
    const content = turndown.turndown(bodyHtml);
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();

    return {
      content: content.slice(0, context.options.maxContentLength ?? 50000),
      textContent,
      excerpt: this.createExcerpt(textContent),
      wordCount: textContent.split(/\s+/).filter(Boolean).length,
      contentType: 'unknown',
    };
  }

  private createExcerpt(text: string, maxLength = 300): string {
    if (text.length <= maxLength) {
      return text;
    }
    // Try to break at word boundary
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}...`;
  }

  private detectContentType(context: ExtractionContext): ContentType {
    const { $, finalUrl } = context;
    const url = finalUrl.toLowerCase();

    // GitHub repo
    if (url.includes('github.com') && !url.includes('/blob/') && !url.includes('/issues/')) {
      const repoMeta = $('meta[property="og:type"]').attr('content');
      if (repoMeta === 'object' || url.match(/github\.com\/[^/]+\/[^/]+\/?$/)) {
        return 'repo';
      }
    }

    // npm package
    if (url.includes('npmjs.com/package/')) {
      return 'package';
    }

    // PyPI package
    if (url.includes('pypi.org/project/')) {
      return 'package';
    }

    // Documentation sites
    if (
      url.includes('/docs/') ||
      url.includes('.readthedocs.') ||
      url.includes('/documentation/')
    ) {
      return 'docs';
    }

    // Video platforms
    if (url.includes('youtube.com') || url.includes('vimeo.com') || url.includes('youtu.be')) {
      return 'video';
    }

    // Product pages (heuristic)
    const hasPrice = $('[class*="price"], [data-price], [itemprop="price"]').length > 0;
    const hasAddToCart = $('[class*="cart"], [class*="buy"], button:contains("Add")').length > 0;
    if (hasPrice || hasAddToCart) {
      return 'product';
    }

    // Article detection (Open Graph type)
    const ogType = $('meta[property="og:type"]').attr('content')?.toLowerCase();
    if (ogType === 'article' || ogType === 'blog' || ogType === 'news') {
      return 'article';
    }

    // Article heuristics
    const hasArticleTag = $('article').length > 0;
    const hasDateline = $('time[datetime], [class*="date"], [class*="byline"]').length > 0;
    if (hasArticleTag && hasDateline) {
      return 'article';
    }

    return 'unknown';
  }
}

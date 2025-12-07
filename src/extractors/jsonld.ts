import type { ExtractionContext, Extractor, ScrapedData } from '@/core/types.js';

/**
 * Extracts JSON-LD structured data from the page.
 * Also extracts additional metadata from structured data.
 */
export class JsonLdExtractor implements Extractor {
  readonly name = 'jsonld';
  readonly priority = 80; // After meta, before content

  async extract(context: ExtractionContext): Promise<Partial<ScrapedData>> {
    const { $ } = context;
    const jsonLd: Record<string, unknown>[] = [];

    // Find all JSON-LD scripts
    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (!content) return;

      try {
        const parsed = JSON.parse(content);
        // Handle both single objects and arrays
        if (Array.isArray(parsed)) {
          jsonLd.push(...parsed);
        } else if (typeof parsed === 'object' && parsed !== null) {
          jsonLd.push(parsed);
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });

    if (jsonLd.length === 0) {
      return {};
    }

    // Extract useful metadata from JSON-LD
    const metadata = this.extractMetadata(jsonLd);

    return {
      jsonLd,
      ...metadata,
    };
  }

  private extractMetadata(jsonLd: Record<string, unknown>[]): Partial<ScrapedData> {
    const result: Partial<ScrapedData> = {};

    for (const item of jsonLd) {
      const type = this.getType(item);

      // Extract from Article/BlogPosting/NewsArticle
      if (type?.match(/Article|BlogPosting|NewsArticle|WebPage/i)) {
        result.title = result.title || this.getString(item, 'headline', 'name');
        result.description = result.description || this.getString(item, 'description');
        result.author = result.author || this.getAuthor(item);
        result.publishedAt = result.publishedAt || this.getString(item, 'datePublished');
        result.modifiedAt = result.modifiedAt || this.getString(item, 'dateModified');
        result.image = result.image || this.getImage(item);
      }

      // Extract from Organization
      if (type === 'Organization') {
        result.siteName = result.siteName || this.getString(item, 'name');
      }

      // Extract from Product
      if (type === 'Product') {
        result.title = result.title || this.getString(item, 'name');
        result.description = result.description || this.getString(item, 'description');
        result.image = result.image || this.getImage(item);
      }

      // Extract from SoftwareApplication
      if (type === 'SoftwareApplication') {
        result.title = result.title || this.getString(item, 'name');
        result.description = result.description || this.getString(item, 'description');
      }

      // Extract keywords from any type
      const keywords = this.getKeywords(item);
      if (keywords.length > 0) {
        result.keywords = [...(result.keywords || []), ...keywords];
      }
    }

    // Deduplicate keywords
    if (result.keywords) {
      result.keywords = [...new Set(result.keywords)];
    }

    return result;
  }

  private getType(item: Record<string, unknown>): string | undefined {
    const type = item['@type'];
    if (typeof type === 'string') return type;
    if (Array.isArray(type)) return type[0] as string;
    return undefined;
  }

  private getString(item: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = item[key];
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null && '@value' in value) {
        return String((value as { '@value': unknown })['@value']);
      }
    }
    return undefined;
  }

  private getAuthor(item: Record<string, unknown>): string | undefined {
    const author = item.author;
    if (typeof author === 'string') return author;
    // Check array BEFORE object since typeof [] === 'object'
    if (Array.isArray(author)) {
      const names = author
        .map((a) =>
          typeof a === 'string' ? a : this.getString(a as Record<string, unknown>, 'name')
        )
        .filter(Boolean);
      return names.join(', ') || undefined;
    }
    if (typeof author === 'object' && author !== null) {
      const authorObj = author as Record<string, unknown>;
      return this.getString(authorObj, 'name') || undefined;
    }
    return undefined;
  }

  private getImage(item: Record<string, unknown>): string | undefined {
    const image = item.image;
    if (typeof image === 'string') return image;
    // Check array BEFORE object since typeof [] === 'object'
    if (Array.isArray(image) && image.length > 0) {
      return this.getImage({ image: image[0] });
    }
    if (typeof image === 'object' && image !== null) {
      const imageObj = image as Record<string, unknown>;
      return this.getString(imageObj, 'url', 'contentUrl') || undefined;
    }
    return undefined;
  }

  private getKeywords(item: Record<string, unknown>): string[] {
    const keywords = item.keywords;
    if (typeof keywords === 'string') {
      return keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
    }
    if (Array.isArray(keywords)) {
      return keywords.filter((k): k is string => typeof k === 'string');
    }
    return [];
  }
}

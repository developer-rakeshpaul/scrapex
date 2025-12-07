import type { Extractor } from '@/core/types.js';
import { ContentExtractor } from './content.js';
import { FaviconExtractor } from './favicon.js';
import { JsonLdExtractor } from './jsonld.js';
import { LinksExtractor } from './links.js';
import { MetaExtractor } from './meta.js';

export { ContentExtractor } from './content.js';
export { FaviconExtractor } from './favicon.js';
export { JsonLdExtractor } from './jsonld.js';
export { LinksExtractor } from './links.js';
// Export all extractors
export { MetaExtractor } from './meta.js';

/**
 * Default extractors in priority order.
 * Higher priority runs first.
 */
export function createDefaultExtractors(): Extractor[] {
  return [
    new MetaExtractor(), // priority: 100
    new JsonLdExtractor(), // priority: 80
    new FaviconExtractor(), // priority: 70
    new ContentExtractor(), // priority: 50
    new LinksExtractor(), // priority: 30
  ];
}

/**
 * Sort extractors by priority (higher first).
 */
export function sortExtractors(extractors: Extractor[]): Extractor[] {
  return [...extractors].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

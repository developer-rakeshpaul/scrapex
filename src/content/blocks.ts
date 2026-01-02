import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import type { BlockType, ContentBlock } from './types.js';

/**
 * Default selectors to drop before block parsing.
 */
export const DEFAULT_DROP_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'canvas',
  '[hidden]',
  '[aria-hidden="true"]',
];

/**
 * Selectors for block type detection.
 */
const BLOCK_TYPE_SELECTORS: Record<string, BlockType> = {
  'nav, [role="navigation"]': 'nav',
  'footer, [role="contentinfo"]': 'footer',
  'aside.promo, .advertisement, .ad, [data-ad]': 'promo',
  '.legal, .disclaimer, .terms, .copyright': 'legal',
  'blockquote, q': 'quote',
  'pre, code': 'code',
  table: 'table',
  'ul, ol, dl, li, dt, dd': 'list',
  'figure, img, video, audio, picture': 'media',
  figcaption: 'paragraph',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  p: 'paragraph',
};

/**
 * Parse HTML into content blocks.
 */
export function parseBlocks(
  $: CheerioAPI,
  options: {
    dropSelectors?: string[];
    maxBlocks?: number;
    includeHtml?: boolean;
  } = {}
): ContentBlock[] {
  const { dropSelectors = [], maxBlocks = 2000, includeHtml = false } = options;
  const blocks: ContentBlock[] = [];

  const rootHtml = $.root().html() || '';
  const $root = cheerio.load(rootHtml);

  // Remove unwanted elements
  const allDropSelectors = [...DEFAULT_DROP_SELECTORS, ...dropSelectors];
  $root(allDropSelectors.join(', ')).remove();

  // Find content container
  const contentArea = $root('article, main, [role="main"], .content, #content').first();
  const container = contentArea.length > 0 ? contentArea : $root('body');

  // Process block-level elements.
  // Note: find('*') can be expensive on very large DOMs; maxBlocks provides a hard stop.
  container.find('*').each((_, el) => {
    if (blocks.length >= maxBlocks) {
      return false;
    }
    const $el = $root(el);
    const tagName = el.tagName?.toLowerCase();

    if (!tagName) {
      return;
    }

    // Determine block type
    let type: BlockType = 'unknown';
    let level: 1 | 2 | 3 | 4 | 5 | 6 | undefined;

    // Check structural types first
    for (const [selector, blockType] of Object.entries(BLOCK_TYPE_SELECTORS)) {
      if ($el.is(selector)) {
        type = blockType;
        break;
      }
    }

    // Extract heading level
    const headingMatch = tagName.match(/^h([1-6])$/);
    if (headingMatch?.[1]) {
      type = 'heading';
      level = Number.parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    }

    // Skip non-block elements
    if (
      type === 'unknown' &&
      !['p', 'div', 'section', 'article', 'li', 'dt', 'dd', 'figcaption'].includes(tagName)
    ) {
      return;
    }

    // Get text content
    const text = $el.text().trim();
    if (!text) {
      return;
    }

    // Avoid duplicates from nested elements by preferring the most granular blocks
    // Include li, dt, dd so list containers (ul, ol, dl) are skipped in favor of their items
    const hasBlockChildren =
      $el.find('p, h1, h2, h3, h4, h5, h6, ul, ol, li, dt, dd, blockquote, pre, table').length > 0;
    if (hasBlockChildren) {
      return; // Skip containers, process children instead
    }

    // Build block
    const parentTags = $el
      .parents()
      .map((_, p) => p.tagName?.toLowerCase())
      .get()
      .reverse();
    const block: ContentBlock = {
      type: type === 'unknown' ? 'paragraph' : type,
      text,
      ...(level && { level }),
      context: {
        parentTags,
        depth: parentTags.length,
      },
    };

    if (includeHtml) {
      block.html = $el.html() || undefined;
    }

    // Add attrs for media
    if (type === 'media') {
      const img = $el.is('img') ? $el : $el.find('img').first();
      if (img.length) {
        const alt = img.attr('alt');
        const src = img.attr('src');
        block.attrs = {};
        if (alt) block.attrs.alt = alt;
        if (src) block.attrs.src = src;
      } else {
        const video = $el.is('video') ? $el : $el.find('video').first();
        if (video.length) {
          // Only the first <source> is captured for video elements.
          const src = video.attr('src') || video.find('source').first().attr('src');
          const poster = video.attr('poster');
          block.attrs = {};
          if (src) block.attrs.src = src;
          if (poster) block.attrs.poster = poster;
        }
      }
    }

    blocks.push(block);
  });

  return blocks;
}

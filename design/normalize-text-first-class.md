# NormalizeText as a First-Class Scrape Feature

## Summary

Introduce a first-class `normalize` option to `scrape()` that produces consistent, boilerplate-free, embedding-ready text directly in `ScrapedData`. The feature adds a block classification gate between extraction and normalization, enabling custom or default filtering logic across sites without requiring callers to wire separate utilities.

## Goals

- Provide a single, consistent normalization path for UI display, embeddings, and LLM workflows.
- Expose a block classifier hook to gate extracted content blocks before normalization.
- Preserve current behavior when `normalize` is not used.
- Keep output structured (blocks + meta) for debugging and analytics when enabled.

## Non-Goals

- Replace Readability or remove existing `content` / `textContent` fields.
- Provide site-specific heuristics; defaults remain site-agnostic.
- Implement language detection beyond optional hints.

---

## Proposed API (Implemented)

### New Types (`src/content/types.ts`)

```ts
/**
 * Block type classification for content blocks.
 */
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'quote'
  | 'table'
  | 'code'
  | 'media'
  | 'nav'
  | 'footer'
  | 'promo'
  | 'legal'
  | 'unknown';

/**
 * A classified content block extracted from HTML.
 */
export interface ContentBlock {
  /** Block type classification */
  type: BlockType;
  /** Plain text content */
  text: string;
  /** Heading level (1-6) when type is 'heading' */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Original HTML (unsafe; sanitize before rendering). Unset by default. */
  html?: string;
  /** Additional attributes (e.g., alt text, href) */
  attrs?: Record<string, string>;
  /** Optional structural context from DOM */
  context?: {
    parentTags?: string[];
    depth?: number;
  };
}

/**
 * Result of block classification.
 */
export interface ClassifierResult {
  /** Whether to include this block in normalized output */
  accept: boolean;
  /** Relevance score (0-1) for ranking in summary mode */
  score?: number;
  /** Classification label for analytics/debugging */
  label?: string;
}

/**
 * Context provided to block classifiers.
 */
export interface ClassifierContext {
  /** Zero-based index of block in array */
  index: number;
  /** Total number of blocks */
  totalBlocks: number;
  /** Source URL (for domain-specific rules) */
  url?: string;
  /** Parent tag chain (e.g., ['body', 'main', 'aside']) */
  parentTags?: string[];
  /** Nesting depth in DOM */
  depth?: number;
}

/**
 * Block classifier function signature.
 * Supports both sync and async classifiers (for LLM-based classification).
 */
export type ContentBlockClassifier = (
  block: ContentBlock,
  context: ClassifierContext
) => ClassifierResult | Promise<ClassifierResult>;

/**
 * Truncation strategy for maxChars limit.
 */
export type TruncateStrategy = 'sentence' | 'word' | 'char';

/**
 * Options for text normalization.
 */
export interface NormalizeOptions {
  /** Output mode: 'summary' uses scores to rank blocks, 'full' keeps all accepted */
  mode?: 'summary' | 'full';
  /** Maximum characters in output (applied after normalization) */
  maxChars?: number;
  /** Minimum characters required (skips normalization if content too short) */
  minChars?: number;
  /** Maximum blocks to process (default: 2000) */
  maxBlocks?: number;
  /** How to truncate when maxChars exceeded (default: 'sentence') */
  truncate?: TruncateStrategy;
  /** CSS selectors to drop before block parsing */
  dropSelectors?: string[];
  /** Apply default boilerplate removal (default: true) */
  removeBoilerplate?: boolean;
  /** Decode HTML entities (default: true) */
  decodeEntities?: boolean;
  /** Normalize Unicode to NFC (default: true) */
  normalizeUnicode?: boolean;
  /** Preserve paragraph breaks as double newlines (default: true) */
  preserveLineBreaks?: boolean;
  /** Strip markdown-style links, keep text (default: true) */
  stripLinks?: boolean;
  /** Include original HTML in blocks (default: false) */
  includeHtml?: boolean;
  /** Language hint for future i18n support */
  languageHint?: string;
  /** Custom block classifier (overrides default when provided) */
  blockClassifier?: ContentBlockClassifier;
  /** Include blocks array in output for debugging (default: false) */
  debug?: boolean;
}

/**
 * Metadata about the normalization process.
 */
export interface NormalizationMeta {
  /** Character count of normalized text */
  charCount: number;
  /** Estimated token count (chars/4 heuristic) */
  tokenEstimate: number;
  /** Detected or hinted language */
  language: string;
  /** Whether boilerplate removal was applied */
  boilerplateRemoved: boolean;
  /** Whether a classifier (custom or default) was used */
  classifierUsed: boolean;
  /** Content hash for deduplication (SHA-256, first 32 chars) */
  hash: string;
  /** Normalization time in milliseconds */
  extractionTimeMs: number;
  /** Number of blocks before classification */
  blocksTotal: number;
  /** Number of blocks accepted after classification */
  blocksAccepted: number;
  /** Whether output was truncated */
  truncated: boolean;
}

/**
 * Result of normalizeText() standalone function.
 */
export interface NormalizeResult {
  /** Normalized plain text output */
  text: string;
  /** Normalization metadata */
  meta: NormalizationMeta;
  /** Classified blocks (only when debug: true) */
  blocks?: ContentBlock[];
}
```

### ScrapeOptions Addition (`src/core/types.ts`)

```ts
export interface ScrapeOptions {
  // ... existing fields ...

  /** Text normalization options */
  normalize?: NormalizeOptions;
}
```

### ScrapedData Additions (`src/core/types.ts`)

```ts
export interface ScrapedData {
  // ... existing fields ...

  /** Normalized text output (when normalize option used) */
  normalizedText?: string;
  /** Normalization metadata (when normalize option used) */
  normalizationMeta?: NormalizationMeta;
  /** Classified blocks for debugging (when normalize.debug: true) */
  normalizedBlocks?: ContentBlock[];
}
```

---

## Default Classifier (Site-Agnostic)

```ts
// src/content/classifier.ts

import type { ContentBlock, ContentBlockClassifier, ClassifierResult } from './types.js';

/**
 * Default site-agnostic block classifier.
 * Filters navigation, footers, boilerplate, and short fragments.
 */
export const defaultBlockClassifier: ContentBlockClassifier = (
  block: ContentBlock
): ClassifierResult => {
  const text = (block.text || '').trim();
  const lowerText = text.toLowerCase().slice(0, 1000); // limit regex input

  // Empty blocks
  if (!text) {
    return { accept: false, label: 'empty' };
  }

  // Structural boilerplate
  if (block.type === 'nav') return { accept: false, label: 'nav' };
  if (block.type === 'footer') return { accept: false, label: 'footer' };
  if (block.type === 'legal') return { accept: false, label: 'legal' };
  if (block.type === 'promo') return { accept: false, label: 'promo' };

  // Generic boilerplate phrases (not site-specific)
  const boilerplatePatterns = [
    /\b(subscribe|sign up|newsletter|notifications|follow us)\b/i,
    /\b(sponsored|advertis(e|ement|ing)|promotion|partner content)\b/i,
    /\b(read more|keep reading|continue reading|see more)\b/i,
    /\b(cookie policy|privacy policy|terms of service|all rights reserved)\b/i,
    /\b(share on|share this|tweet this|pin it)\b/i,
    /\b(comments?|leave a reply|join the discussion)\b/i,
  ];

  if (boilerplatePatterns.some((re) => re.test(lowerText))) {
    return { accept: false, label: 'boilerplate' };
  }

  // Very short fragments (likely UI elements or captions)
  const isShort = text.length < 20;
  const endsWithPunct = /[.!?]\s*$/.test(text);
  if (isShort && block.type !== 'heading' && block.type !== 'list' && !endsWithPunct) {
    return { accept: false, label: 'too-short' };
  }

  // Media credits/captions
  if (/\b(photo by|image:|credit:|source:)\b/i.test(lowerText) && text.length < 120) {
    return { accept: false, label: 'media-credit' };
  }

  // Calculate relevance score based on block characteristics
  let score = 0.5;

  // Headings are important
  if (block.type === 'heading') {
    score = block.level === 1 ? 0.9 : block.level === 2 ? 0.8 : 0.7;
  }

  // Longer paragraphs are typically more substantive
  if (block.type === 'paragraph') {
    score = Math.min(0.9, 0.5 + text.length / 1000);
  }

  // Quotes and code are often important
  if (block.type === 'quote' || block.type === 'code') {
    score = 0.7;
  }

  return { accept: true, label: 'content', score };
};

/**
 * Create a classifier that combines multiple classifiers.
 * First classifier to reject wins; scores are averaged.
 */
export function combineClassifiers(
  ...classifiers: ContentBlockClassifier[]
): ContentBlockClassifier {
  // AND semantics: first rejection wins. For OR, wrap with a custom helper.
  return async (block, context) => {
    const results: ClassifierResult[] = [];

    for (const classifier of classifiers) {
      const result = await classifier(block, context);
      if (!result.accept) {
        return result; // Early exit on rejection
      }
      results.push(result);
    }

    const scores = results.map((result) => result.score).filter((score) => score !== undefined);
    const avgScore =
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : undefined;

    return {
      accept: true,
      score: avgScore,
      label: results.map((result) => result.label).filter(Boolean).join('+') || 'content',
    };
  };
}
```

---

## Block Parser Implementation

```ts
// src/content/blocks.ts

import type { CheerioAPI } from 'cheerio';
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

  // Remove unwanted elements
  const allDropSelectors = [...DEFAULT_DROP_SELECTORS, ...dropSelectors];
  $(allDropSelectors.join(', ')).remove();

  // Find content container
  const contentArea = $('article, main, [role="main"], .content, #content').first();
  const container = contentArea.length > 0 ? contentArea : $('body');

  // Process block-level elements.
  // Note: find('*') can be expensive on very large DOMs; maxBlocks provides a hard stop.
  container.find('*').each((_, el) => {
    if (blocks.length >= maxBlocks) {
      return false;
    }
    const $el = $(el);
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
    const hasBlockChildren =
      $el.find('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table').length > 0;
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
        block.attrs = {
          alt: img.attr('alt') || '',
          src: img.attr('src') || '',
        };
      }
    }

    blocks.push(block);
  });

  return blocks;
}
```

---

## Normalizer Implementation

```ts
// src/content/normalizer.ts

import { createHash } from 'node:crypto';
import type {
  ClassifierContext,
  ContentBlock,
  ContentBlockClassifier,
  NormalizeOptions,
  NormalizeResult,
  NormalizationMeta,
} from './types.js';
import { defaultBlockClassifier } from './classifier.js';

/**
 * Normalize text with optional HTML entity decoding and Unicode normalization.
 */
function normalizeString(
  text: string,
  options: Pick<
    NormalizeOptions,
    'decodeEntities' | 'normalizeUnicode' | 'preserveLineBreaks' | 'stripLinks'
  >
): string {
  let result = text;

  // Decode HTML entities
  if (options.decodeEntities !== false) {
    result = result
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
        String.fromCharCode(Number.parseInt(code, 16))
      );
  }

  // Strip markdown links, keep text
  if (options.stripLinks !== false) {
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  // Normalize Unicode
  if (options.normalizeUnicode !== false) {
    result = result.normalize('NFC');
  }

  // Collapse whitespace
  result = result.replace(/[ \t]+/g, ' ');

  // Handle line breaks
  if (options.preserveLineBreaks !== false) {
    result = result.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  } else {
    result = result.replace(/\n+/g, ' ');
  }

  return result.trim();
}

/**
 * Truncate text at natural boundaries.
 */
function truncateText(
  text: string,
  maxChars: number,
  strategy: 'sentence' | 'word' | 'char'
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  let truncated = text.slice(0, maxChars);

  if (strategy === 'sentence') {
    const sentenceEnd = truncated.lastIndexOf('. ');
    const questionEnd = truncated.lastIndexOf('? ');
    const exclamEnd = truncated.lastIndexOf('! ');
    const lastBoundary = Math.max(sentenceEnd, questionEnd, exclamEnd);

    if (lastBoundary > maxChars * 0.5) {
      truncated = truncated.slice(0, lastBoundary + 1);
    }
  } else if (strategy === 'word') {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.8) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  return { text: truncated.trim(), truncated: true };
}

/**
 * Generate content hash for deduplication.
 * Use at least 128-bit output to reduce collision risk at scale.
 */
function generateHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/**
 * Normalize content blocks into clean text.
 */
export async function normalizeText(
  blocks: ContentBlock[],
  options: NormalizeOptions = {},
  url?: string
): Promise<NormalizeResult> {
  const startTime = Date.now();
  const {
    mode = 'full',
    maxChars,
    minChars,
    truncate = 'sentence',
    removeBoilerplate = true,
    debug = false,
  } = options;

  const classifier: ContentBlockClassifier | undefined =
    options.blockClassifier ?? (removeBoilerplate ? defaultBlockClassifier : undefined);

  let classifiedBlocks: Array<ContentBlock & { score?: number; label?: string }> = [];

  if (classifier) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block) continue;

      const context: ClassifierContext = {
        index: i,
        totalBlocks: blocks.length,
        url,
        parentTags: block.context?.parentTags,
        depth: block.context?.depth,
      };

      const result = await classifier(block, context);

      if (result.accept) {
        classifiedBlocks.push({
          ...block,
          score: result.score,
          label: result.label,
        });
      }
    }
  } else {
    classifiedBlocks = blocks.map((block) => ({ ...block }));
  }

  if (mode === 'summary') {
    classifiedBlocks.sort((a, b) => (b.score ?? 0.5) - (a.score ?? 0.5));
  }

  const textParts = classifiedBlocks.map((block) => {
    let text = normalizeString(block.text, options);

    if (block.type === 'heading' && block.level) {
      text = `${'#'.repeat(block.level)} ${text}`;
    }

    return text;
  });

  let normalizedText = textParts.join('\n\n');

  let truncated = false;
  if (maxChars && normalizedText.length > maxChars) {
    const result = truncateText(normalizedText, maxChars, truncate);
    normalizedText = result.text;
    truncated = result.truncated;
  }

  if (minChars && normalizedText.length < minChars) {
    return {
      text: '',
      meta: {
        charCount: 0,
        tokenEstimate: 0,
        language: options.languageHint || 'unknown',
        boilerplateRemoved: false,
        classifierUsed: false,
        hash: '',
        extractionTimeMs: Date.now() - startTime,
        blocksTotal: blocks.length,
        blocksAccepted: 0,
        truncated: false,
      },
      ...(debug && { blocks: [] }),
    };
  }

  const meta: NormalizationMeta = {
    charCount: normalizedText.length,
    tokenEstimate: Math.ceil(normalizedText.length / 4),
    language: options.languageHint || 'unknown',
    boilerplateRemoved: removeBoilerplate,
    classifierUsed: !!classifier,
    hash: generateHash(normalizedText),
    extractionTimeMs: Date.now() - startTime,
    blocksTotal: blocks.length,
    blocksAccepted: classifiedBlocks.length,
    truncated,
  };

  return {
    text: normalizedText,
    meta,
    ...(debug && { blocks: classifiedBlocks }),
  };
}
```

---

## Pipeline Integration (`src/core/scrape.ts`)

Add normalization after extraction, before LLM enhancement:

```ts
// After extractors run, before LLM enhancement:

async function applyNormalization(
  result: ScrapedData,
  context: ExtractionContext,
  options: ScrapeOptions,
  url: string
): Promise<void> {
  if (!options.normalize) {
    return;
  }

  try {
    const blocks = parseBlocks(context.$, {
      dropSelectors: options.normalize.dropSelectors,
      maxBlocks: options.normalize.maxBlocks,
      includeHtml: options.normalize.includeHtml,
    });

    const normalizeResult = await normalizeText(blocks, options.normalize, url);

    result.normalizedText = normalizeResult.text;
    result.normalizationMeta = normalizeResult.meta;

    if (options.normalize.debug && normalizeResult.blocks) {
      result.normalizedBlocks = normalizeResult.blocks;
    }
  } catch (error) {
    console.error('Normalization failed:', error);
    result.error = result.error
      ? `${result.error}; normalize: ${error instanceof Error ? error.message : String(error)}`
      : `normalize: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Called in scrape() and scrapeHtml():
await applyNormalization(intermediateResult, context, options, normalizedUrl);
```

---

## Embeddings Integration (`src/embeddings/input.ts`)

`EmbeddingOptions.preferNormalized` controls preference for `normalizedText`:

```ts
const rawInput = selectInput(data, options.input, options.preferNormalized);
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Block parsing fails | Caught by applyNormalization(), sets error field |
| Classifier throws | Error propagates; caught by applyNormalization() |
| Async classifier rejects | Error propagates; caught by applyNormalization() |
| Content too short (< minChars) | Return empty text with meta (no error) |
| No accepted blocks | Return empty text with meta (no error) |

Note: The default classifier is synchronous and does not throw. Custom async classifiers should handle their own errors or let them propagate to be caught by the pipeline.

---

## Security & Privacy

- No network access introduced.
- Classifier is pure/deterministic; avoid site-specific patterns in defaults.
- Limit regex checks to a bounded prefix (first 1000 chars).
- Enforce `maxBlocks` to avoid unbounded memory use.
- Do not populate `ContentBlock.html` unless `includeHtml: true` is explicitly set.
- Treat `ContentBlock.html` as unsafe; sanitize before rendering.
- Preserve current SSRF protections and HTML parsing safeguards.
- Hash uses SHA-256 (32 hex chars = 128 bits, collision-resistant).

---

## Backward Compatibility

- No changes for callers who omit `normalize`.
- New fields are additive and optional.
- `normalizedText` remains separate from `textContent` for backwards compatibility.

---

## Test Plan (Implemented)

### Unit Tests (`test/content/`)

- **Block Parser** (`blocks.test.ts`)
  - Parses headings and paragraphs with correct levels
  - Respects drop selectors
  - Respects maxBlocks

- **Classifier** (`classifier.test.ts`)
  - Rejects nav/footer/legal
  - Rejects boilerplate patterns
  - Accepts substantive content

- **Normalizer** (`normalizer.test.ts`)
  - Decodes entities and strips markdown links
  - Truncates at sentence boundaries
  - Respects minChars threshold

### Integration Tests (`test/core/`)

- **Scrape with normalize** (`scrape-normalize.test.ts`)
  - Produces normalized text and metadata
  - Emits normalized blocks when debug is enabled

---

## Future (Not Implemented Yet)

The following improvements are **not implemented** in code today, but are good candidates for future iterations:

- Preset configurations (`normalize: 'embedding' | 'display' | 'llm' | 'minimal'`).
- Per-block hashing and deduplication.
- `list-item` and `table-row` block types.
- Structured table extraction and `includeAltText` for media blocks.
- `replaceClassifier`, `onBlockClassified`, and classifier timeouts.
- Hash input size limits and streaming/iterator block parsing for huge documents.
- Dedicated sanitizer helper for `ContentBlock.html`.
- Language detection beyond `languageHint`.

---

## Public Exports (`src/index.ts`)

```ts
// Content normalization
export {
  parseBlocks,
  normalizeText,
  defaultBlockClassifier,
  combineClassifiers,
} from './content/index.js';

export type {
  BlockType,
  ContentBlock,
  ClassifierResult,
  ClassifierContext,
  ContentBlockClassifier,
  NormalizeOptions,
  NormalizationMeta,
  NormalizeResult,
  TruncateStrategy,
} from './content/types.js';
```

---

## Usage Examples

### Basic Usage

```ts
import { scrape } from 'scrapex';

const result = await scrape('https://example.com/article', {
  normalize: {
    mode: 'full',
    removeBoilerplate: true,
  },
});

console.log(result.normalizedText);
// Clean, boilerplate-free text ready for embedding or LLM
```

### Summary Mode with Character Limit

```ts
const result = await scrape(url, {
  normalize: {
    mode: 'summary',
    maxChars: 2000,
    truncate: 'sentence',
  },
});

// High-scoring blocks, truncated at sentence boundary
```

### Custom Classifier

```ts
import { scrape, defaultBlockClassifier, combineClassifiers } from 'scrapex';

// Add domain-specific rules
const myClassifier = combineClassifiers(
  defaultBlockClassifier,
  (block) => {
    // Reject author bios
    if (block.text.toLowerCase().includes('about the author')) {
      return { accept: false, label: 'author-bio' };
    }
    return { accept: true };
  }
);

const result = await scrape(url, {
  normalize: {
    blockClassifier: myClassifier,
    debug: true, // Include blocks for inspection
  },
});
```

### Standalone Normalization

```ts
import { parseBlocks, normalizeText } from 'scrapex';
import { load } from 'cheerio';

const $ = load(html);
const blocks = parseBlocks($);
const result = await normalizeText(blocks, {
  mode: 'full',
  maxChars: 5000,
});

console.log(result.text);
console.log(result.meta.tokenEstimate);
```
```

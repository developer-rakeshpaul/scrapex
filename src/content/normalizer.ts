import { createHash } from 'node:crypto';
import { defaultBlockClassifier } from './classifier.js';
import type {
  ClassifierContext,
  ContentBlock,
  ContentBlockClassifier,
  NormalizationMeta,
  NormalizeOptions,
  NormalizeResult,
} from './types.js';

/**
 * Normalize a text string with configurable transformations.
 *
 * Applies HTML entity decoding, markdown link stripping, Unicode normalization,
 * whitespace collapsing, and line break handling based on options.
 *
 * @param text - Raw text to normalize
 * @param options - Normalization options
 * @returns Cleaned and normalized text string
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
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
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
 * Truncate text at natural boundaries based on strategy.
 *
 * Strategies:
 * - `sentence`: Truncate at last sentence boundary (. ! ?) if within 50% of maxChars
 * - `word`: Truncate at last word boundary if within 80% of maxChars
 * - `char`: Hard truncate at maxChars (no boundary detection)
 *
 * @param text - Text to truncate
 * @param maxChars - Maximum character limit
 * @param strategy - Truncation strategy
 * @returns Truncated text and whether truncation occurred
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
    // TODO: Improve sentence detection to handle abbreviations (e.g., "Dr.", "U.S.A.")
    // Consider using: /[.!?](?:\s+[A-Z]|\s*$)/g to require capital after punctuation
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
 * Normalize content blocks into clean, embedding-ready text.
 *
 * Applies block classification (optional), text normalization, truncation,
 * and generates metadata including character count, token estimate, and content hash.
 *
 * @param blocks - Content blocks to normalize
 * @param options - Normalization options (mode, maxChars, classifier, etc.)
 * @param url - Source URL for classifier context
 * @returns Normalized text, metadata, and optionally classified blocks (when debug: true)
 *
 * @example
 * ```ts
 * const result = await normalizeText(blocks, {
 *   mode: 'summary',
 *   maxChars: 2000,
 *   removeBoilerplate: true,
 * });
 * console.log(result.text, result.meta.tokenEstimate);
 * ```
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
    maxBlocks,
    truncate = 'sentence',
    removeBoilerplate = true,
    debug = false,
  } = options;

  const classifier: ContentBlockClassifier | undefined =
    options.blockClassifier ?? (removeBoilerplate ? defaultBlockClassifier : undefined);

  const originalBlocksTotal = blocks.length;
  let blocksTruncated = false;
  if (maxBlocks && blocks.length > maxBlocks) {
    blocks = blocks.slice(0, maxBlocks);
    blocksTruncated = true;
  }

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
        blocksTotal: originalBlocksTotal,
        blocksAccepted: 0,
        truncated: blocksTruncated,
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
    blocksTotal: originalBlocksTotal,
    blocksAccepted: classifiedBlocks.length,
    truncated: truncated || blocksTruncated,
  };

  return {
    text: normalizedText,
    meta,
    ...(debug && { blocks: classifiedBlocks }),
  };
}

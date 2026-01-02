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

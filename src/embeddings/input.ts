import type { ScrapedData } from '../core/types.js';
import type { EmbeddingInputConfig } from './types.js';

/**
 * Select and prepare input text for embedding based on configuration.
 *
 * @param data - Scraped data to extract input from
 * @param config - Input configuration
 * @returns Selected and prepared text, or undefined if no valid input
 */
export function selectInput(
  data: Partial<ScrapedData>,
  config?: EmbeddingInputConfig
): string | undefined {
  // If transform function is provided, use it directly
  if (config?.transform) {
    const transformed = config.transform(data);
    return normalizeText(transformed);
  }

  // If custom text is provided and type is 'custom', use it
  if (config?.type === 'custom' && config.customText) {
    return normalizeText(config.customText);
  }

  // Select based on type
  const type = config?.type ?? 'textContent';

  switch (type) {
    case 'textContent':
      return selectTextContent(data);

    case 'title+summary':
      return selectTitleSummary(data);

    case 'custom':
      // Custom without customText - fall back to textContent
      return selectTextContent(data);

    default: {
      // Exhaustive check
      const _exhaustive: never = type;
      throw new Error(`Unknown input type: ${_exhaustive}`);
    }
  }
}

/**
 * Select textContent as input.
 */
function selectTextContent(data: Partial<ScrapedData>): string | undefined {
  if (data.textContent) {
    return normalizeText(data.textContent);
  }

  // Fallback chain: content (markdown) -> excerpt -> description
  if (data.content) {
    return normalizeText(stripMarkdown(data.content));
  }

  if (data.excerpt) {
    return normalizeText(data.excerpt);
  }

  if (data.description) {
    return normalizeText(data.description);
  }

  return undefined;
}

/**
 * Select title + summary (or fallbacks) as input.
 * Optimized for semantic search and classification.
 */
function selectTitleSummary(data: Partial<ScrapedData>): string | undefined {
  const parts: string[] = [];

  // Title is always included if available
  if (data.title) {
    parts.push(data.title);
  }

  // Prefer summary, fall back to excerpt or description
  if (data.summary) {
    parts.push(data.summary);
  } else if (data.excerpt) {
    parts.push(data.excerpt);
  } else if (data.description) {
    parts.push(data.description);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return normalizeText(parts.join('\n\n'));
}

/**
 * Normalize text for embedding:
 * - Collapse whitespace
 * - Trim leading/trailing whitespace
 * - Remove control characters
 */
function normalizeText(text: string): string {
  if (!text) {
    return '';
  }

  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally removing control characters for text sanitization
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  return (
    text
      // Remove control characters (except newlines and tabs)
      .replace(controlCharRegex, '')
      // Collapse multiple spaces/tabs to single space
      .replace(/[ \t]+/g, ' ')
      // Collapse multiple newlines to double newline (paragraph break)
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Trim entire text
      .trim()
  );
}

/**
 * Basic markdown stripping for when we need plain text from content.
 * Not comprehensive, but handles common cases.
 */
function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove emphasis
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
  );
}

/**
 * Check if the selected input meets minimum requirements.
 */
export function validateInput(text: string | undefined, minLength = 10): InputValidation {
  if (!text) {
    return {
      valid: false,
      reason: 'No input text available',
    };
  }

  if (text.length < minLength) {
    return {
      valid: false,
      reason: `Input too short (${text.length} < ${minLength} characters)`,
    };
  }

  // Check for meaningful content (not just whitespace/punctuation)
  const wordCount = text.split(/\s+/).filter((w) => w.length > 1).length;
  if (wordCount < 3) {
    return {
      valid: false,
      reason: `Input has too few words (${wordCount} < 3)`,
    };
  }

  return {
    valid: true,
    text,
    wordCount,
    charCount: text.length,
  };
}

/**
 * Result of input validation.
 */
export type InputValidation =
  | { valid: false; reason: string }
  | { valid: true; text: string; wordCount: number; charCount: number };

/**
 * Get a preview of what input would be selected.
 * Useful for debugging and testing.
 */
export function previewInput(
  data: Partial<ScrapedData>,
  config?: EmbeddingInputConfig,
  maxLength = 200
): string {
  const input = selectInput(data, config);

  if (!input) {
    return '[No input available]';
  }

  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength)}...`;
}

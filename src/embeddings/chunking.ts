import type { ChunkingConfig, TextChunk } from './types.js';

/**
 * Default chunk size in tokens.
 */
const DEFAULT_CHUNK_SIZE = 500;

/**
 * Default overlap in tokens.
 */
const DEFAULT_OVERLAP = 50;

/**
 * Default maximum input length in characters.
 */
const DEFAULT_MAX_INPUT_LENGTH = 100_000;

/**
 * Heuristic token counting: approximately 4 characters per token.
 * This is a reasonable approximation for English text.
 */
export function heuristicTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert token count to approximate character count.
 */
function tokensToChars(tokens: number): number {
  return tokens * 4;
}

/**
 * Create a tokenizer function based on configuration.
 */
export function createTokenizer(config?: ChunkingConfig['tokenizer']): (text: string) => number {
  if (!config || config === 'heuristic') {
    return heuristicTokenCount;
  }

  if (config === 'tiktoken') {
    // LIMITATION: tiktoken requires async initialization which is incompatible
    // with the synchronous tokenizer interface. The API accepts 'tiktoken' as
    // a value for future compatibility, but currently falls back to heuristic.
    //
    // For accurate OpenAI token counting, users should provide a custom
    // tokenizer function that wraps a pre-initialized tiktoken encoder:
    //
    // ```ts
    // import { get_encoding } from 'tiktoken';
    // const encoder = get_encoding('cl100k_base');
    // const tokenizer = (text: string) => encoder.encode(text).length;
    // ```
    return heuristicTokenCount;
  }

  // Custom tokenizer function
  return config;
}

/**
 * Find a natural break point in text (sentence or word boundary).
 * Prefers sentence boundaries (., !, ?) but falls back to word boundaries.
 */
function findBreakPoint(text: string, targetIndex: number): number {
  // Look for sentence boundary within 20% of target
  const searchStart = Math.max(0, targetIndex - Math.floor(targetIndex * 0.2));
  const searchEnd = Math.min(text.length, targetIndex + Math.floor(targetIndex * 0.2));
  const searchText = text.slice(searchStart, searchEnd);

  // Find last sentence boundary before target
  const sentenceMatch = /[.!?]\s+/g;
  let lastSentenceEnd = -1;

  for (const match of searchText.matchAll(sentenceMatch)) {
    const absolutePos = searchStart + match.index + match[0].length;
    if (absolutePos <= targetIndex) {
      lastSentenceEnd = absolutePos;
    }
  }

  if (lastSentenceEnd !== -1) {
    return lastSentenceEnd;
  }

  // Fall back to word boundary
  const wordBoundary = text.lastIndexOf(' ', targetIndex);
  if (wordBoundary > searchStart) {
    return wordBoundary + 1; // Include the space in previous chunk
  }

  // No good break point found, use target
  return targetIndex;
}

/**
 * Split text into overlapping chunks optimized for embedding.
 * Respects sentence boundaries when possible.
 */
export function chunkText(text: string, config?: ChunkingConfig): TextChunk[] {
  const chunkSize = config?.size ?? DEFAULT_CHUNK_SIZE;
  const rawOverlap = config?.overlap ?? DEFAULT_OVERLAP;
  const overlap = Math.min(rawOverlap, chunkSize - 1); // Ensure overlap < size
  const maxInputLength = config?.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const tokenizer = createTokenizer(config?.tokenizer);

  // Truncate if exceeding max input length
  const processedText = text.length > maxInputLength ? text.slice(0, maxInputLength) : text;

  // Normalize whitespace
  const normalizedText = processedText.replace(/\s+/g, ' ').trim();

  if (!normalizedText) {
    return [];
  }

  const totalTokens = tokenizer(normalizedText);

  // If text fits in one chunk, return as single chunk
  if (totalTokens <= chunkSize) {
    return [
      {
        text: normalizedText,
        startIndex: 0,
        endIndex: normalizedText.length,
        tokens: totalTokens,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  const chunkSizeChars = tokensToChars(chunkSize);
  const overlapChars = tokensToChars(overlap);

  let startIndex = 0;

  while (startIndex < normalizedText.length) {
    // Calculate target end position
    const targetEnd = Math.min(startIndex + chunkSizeChars, normalizedText.length);

    // Find natural break point if not at end
    const endIndex =
      targetEnd < normalizedText.length ? findBreakPoint(normalizedText, targetEnd) : targetEnd;

    const chunkText = normalizedText.slice(startIndex, endIndex).trim();

    if (chunkText) {
      chunks.push({
        text: chunkText,
        startIndex,
        endIndex,
        tokens: tokenizer(chunkText),
      });
    }

    // Move start position with overlap
    if (endIndex >= normalizedText.length) {
      break;
    }

    // Calculate next start with overlap
    const nextStart = endIndex - overlapChars;
    startIndex = Math.max(nextStart, startIndex + 1);

    // Find word boundary for overlap start
    if (startIndex < normalizedText.length) {
      const spaceIndex = normalizedText.indexOf(' ', startIndex);
      if (spaceIndex !== -1 && spaceIndex < startIndex + overlapChars) {
        startIndex = spaceIndex + 1;
      }
    }
  }

  return chunks;
}

/**
 * Estimate total tokens for a text without chunking.
 */
export function estimateTokens(text: string, tokenizer?: ChunkingConfig['tokenizer']): number {
  const count = createTokenizer(tokenizer);
  return count(text);
}

/**
 * Check if text needs chunking based on token count.
 */
export function needsChunking(
  text: string,
  maxTokens = DEFAULT_CHUNK_SIZE,
  tokenizer?: ChunkingConfig['tokenizer']
): boolean {
  const count = createTokenizer(tokenizer);
  return count(text) > maxTokens;
}

/**
 * Get statistics about potential chunking.
 */
export function getChunkingStats(
  text: string,
  config?: ChunkingConfig
): {
  inputLength: number;
  estimatedTokens: number;
  estimatedChunks: number;
  willTruncate: boolean;
} {
  const maxInputLength = config?.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const chunkSize = config?.size ?? DEFAULT_CHUNK_SIZE;
  const overlap = config?.overlap ?? DEFAULT_OVERLAP;
  const tokenizer = createTokenizer(config?.tokenizer);

  const inputLength = text.length;
  const willTruncate = inputLength > maxInputLength;
  const processedLength = willTruncate ? maxInputLength : inputLength;

  // Normalize for accurate token estimation
  const normalized = text.slice(0, processedLength).replace(/\s+/g, ' ').trim();
  const estimatedTokens = tokenizer(normalized);

  // Calculate estimated chunks
  let estimatedChunks = 1;
  if (estimatedTokens > chunkSize) {
    const effectiveChunkSize = chunkSize - overlap;
    estimatedChunks = Math.ceil((estimatedTokens - overlap) / effectiveChunkSize);
  }

  return {
    inputLength,
    estimatedTokens,
    estimatedChunks,
    willTruncate,
  };
}

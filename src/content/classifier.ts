import type {
  ClassifierResult,
  ContentBlock,
  ContentBlockClassifier,
} from './types.js';

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

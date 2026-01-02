import { describe, expect, it } from 'vitest';
import { defaultBlockClassifier } from '@/content/classifier.js';
import type { ContentBlock } from '@/content/types.js';

describe('defaultBlockClassifier', () => {
  it('rejects navigation and footer blocks', () => {
    const navBlock: ContentBlock = { type: 'nav', text: 'Main menu' };
    const footerBlock: ContentBlock = { type: 'footer', text: 'All rights reserved' };

    expect(defaultBlockClassifier(navBlock, { index: 0, totalBlocks: 2 }).accept).toBe(false);
    expect(defaultBlockClassifier(footerBlock, { index: 1, totalBlocks: 2 }).accept).toBe(false);
  });

  it('rejects boilerplate phrases', () => {
    const block: ContentBlock = { type: 'paragraph', text: 'Subscribe to our newsletter today' };
    const result = defaultBlockClassifier(block, { index: 0, totalBlocks: 1 });

    expect(result.accept).toBe(false);
    expect(result.label).toBe('boilerplate');
  });

  it('accepts substantive paragraph content', () => {
    const block: ContentBlock = {
      type: 'paragraph',
      text: 'This is a longer paragraph with enough information to be meaningful.',
    };
    const result = defaultBlockClassifier(block, { index: 0, totalBlocks: 1 });

    expect(result.accept).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('rejects very short fragments without punctuation', () => {
    const block: ContentBlock = { type: 'paragraph', text: 'Click here' };
    const result = defaultBlockClassifier(block, { index: 0, totalBlocks: 1 });

    expect(result.accept).toBe(false);
    expect(result.label).toBe('too-short');
  });

  it('accepts short sentences with punctuation', () => {
    const block: ContentBlock = { type: 'paragraph', text: 'All set.' };
    const result = defaultBlockClassifier(block, { index: 0, totalBlocks: 1 });

    expect(result.accept).toBe(true);
  });

  it('rejects media credits and captions', () => {
    const block: ContentBlock = { type: 'paragraph', text: 'Photo by Jane Doe' };
    const result = defaultBlockClassifier(block, { index: 0, totalBlocks: 1 });

    expect(result.accept).toBe(false);
    expect(result.label).toBe('media-credit');
  });

  it('assigns higher scores to headings by level', () => {
    const h1: ContentBlock = { type: 'heading', text: 'Title', level: 1 };
    const h2: ContentBlock = { type: 'heading', text: 'Section', level: 2 };
    const h3: ContentBlock = { type: 'heading', text: 'Subsection', level: 3 };

    const h1Result = defaultBlockClassifier(h1, { index: 0, totalBlocks: 3 });
    const h2Result = defaultBlockClassifier(h2, { index: 1, totalBlocks: 3 });
    const h3Result = defaultBlockClassifier(h3, { index: 2, totalBlocks: 3 });

    expect(h1Result.score).toBe(0.9);
    expect(h2Result.score).toBe(0.8);
    expect(h3Result.score).toBe(0.7);
  });

  it('uses a consistent score for quote and code blocks', () => {
    const quote: ContentBlock = { type: 'quote', text: 'A concise quote.' };
    const code: ContentBlock = { type: 'code', text: 'const x = 1;' };

    const quoteResult = defaultBlockClassifier(quote, { index: 0, totalBlocks: 2 });
    const codeResult = defaultBlockClassifier(code, { index: 1, totalBlocks: 2 });

    expect(quoteResult.score).toBe(0.7);
    expect(codeResult.score).toBe(0.7);
  });
});

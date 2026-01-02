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
});

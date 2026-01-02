import { describe, expect, it } from 'vitest';
import { normalizeText } from '@/content/normalizer.js';
import type { ContentBlock } from '@/content/types.js';

describe('normalizeText', () => {
  it('decodes entities, normalizes whitespace, and strips markdown links', async () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        text: 'Hello&nbsp;world &amp; [Link](https://example.com)',
      },
    ];

    const result = await normalizeText(blocks);
    expect(result.text).toBe('Hello world & Link');
  });

  it('truncates at sentence boundaries', async () => {
    const blocks: ContentBlock[] = [
      {
        type: 'paragraph',
        // Use longer text so sentence boundary falls past 50% of maxChars
        text: 'This is the first sentence. Second sentence is much longer than the first. Third sentence here.',
      },
    ];

    const result = await normalizeText(blocks, { maxChars: 50, truncate: 'sentence' });
    expect(result.text).toBe('This is the first sentence.');
    expect(result.meta.truncated).toBe(true);
  });

  it('returns empty text when below minChars', async () => {
    const blocks: ContentBlock[] = [{ type: 'paragraph', text: 'Short' }];
    const result = await normalizeText(blocks, { minChars: 10 });

    expect(result.text).toBe('');
    expect(result.meta.blocksAccepted).toBe(0);
  });
});

import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { parseBlocks } from '@/content/blocks.js';

describe('parseBlocks', () => {
  it('parses headings and paragraphs with levels', () => {
    const html = `
      <main>
        <h1>Main Title</h1>
        <p>First paragraph.</p>
        <h2>Section</h2>
        <p>Second paragraph.</p>
      </main>
    `;
    const $ = load(html);
    const blocks = parseBlocks($);

    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, text: 'Main Title' });
    expect(blocks[1]).toMatchObject({ type: 'paragraph', text: 'First paragraph.' });
    expect(blocks[2]).toMatchObject({ type: 'heading', level: 2, text: 'Section' });
    expect(blocks[3]).toMatchObject({ type: 'paragraph', text: 'Second paragraph.' });
  });

  it('respects drop selectors and removes noisy elements', () => {
    const html = `
      <body>
        <div class="ad">Sponsored block</div>
        <p>Keep this.</p>
        <script>console.log('drop');</script>
      </body>
    `;
    const $ = load(html);
    const blocks = parseBlocks($, { dropSelectors: ['.ad'] });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', text: 'Keep this.' });
  });

  it('caps blocks at maxBlocks', () => {
    const html = `
      <body>
        <p>One</p>
        <p>Two</p>
        <p>Three</p>
      </body>
    `;
    const $ = load(html);
    const blocks = parseBlocks($, { maxBlocks: 2 });

    expect(blocks).toHaveLength(2);
  });

  it('extracts table text content', () => {
    const html = `
      <body>
        <table>
          <tr><th>Column A</th><th>Column B</th></tr>
          <tr><td>Value 1</td><td>Value 2</td></tr>
        </table>
      </body>
    `;
    const $ = load(html);
    const blocks = parseBlocks($);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'table' });
    expect(blocks[0]?.text).toContain('Column A');
    expect(blocks[0]?.text).toContain('Value 1');
  });
});

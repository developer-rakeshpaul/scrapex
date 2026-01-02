import { describe, expect, it } from 'vitest';
import { scrapeHtml } from '@/core/scrape.js';

describe('scrapeHtml normalization', () => {
  it('produces normalized text and metadata', async () => {
    const html = `
      <html>
        <body>
          <nav>Home About Subscribe</nav>
          <main>
            <h1>Test Article</h1>
            <p>This is the first paragraph.</p>
            <p>This is the second paragraph.</p>
          </main>
          <footer>All rights reserved</footer>
        </body>
      </html>
    `;

    const result = await scrapeHtml(html, 'https://example.com/article', {
      normalize: {
        debug: true,
        removeBoilerplate: true,
      },
    });

    expect(result.normalizedText).toContain('Test Article');
    expect(result.normalizedText).toContain('This is the first paragraph.');
    expect(result.normalizedText).not.toContain('Subscribe');
    expect(result.normalizationMeta).toBeDefined();
    expect(result.normalizedBlocks).toBeDefined();
  });
});

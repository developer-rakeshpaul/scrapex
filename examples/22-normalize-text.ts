/**
 * Normalize text during scraping.
 *
 * Demonstrates boilerplate removal and normalized output.
 */
import { scrapeHtml } from '../src/index.js';

const html = `
  <html>
    <body>
      <nav>Home About Subscribe</nav>
      <main>
        <h1>Normalization Demo</h1>
        <p>This is the first paragraph.</p>
        <p>This is the second paragraph with <a href="/more">a link</a>.</p>
      </main>
      <footer>All rights reserved</footer>
    </body>
  </html>
`;

const result = await scrapeHtml(html, 'https://example.com/demo', {
  normalize: {
    mode: 'full',
    removeBoilerplate: true,
    stripLinks: true,
    debug: true,
  },
});

console.log('Normalized text:\n', result.normalizedText);
console.log('Normalization meta:', result.normalizationMeta);
console.log('Blocks:', result.normalizedBlocks?.length);

/**
 * 18-extractor-pipeline-debug.ts
 *
 * Demonstrates extractor ordering (priority), dependency on previous results,
 * and how extractor failures get surfaced via the `error` field.
 *
 * Run: npx tsx examples/18-extractor-pipeline-debug.ts
 */

import { type Extractor, type ScrapedData, scrapeHtml } from '../src/index.js';

const html = `
<!doctype html>
<html>
  <head>
    <title>Pipeline Demo</title>
    <meta name="description" content="A deterministic HTML fixture." />
  </head>
  <body>
    <article>
      <h1>Pipeline Demo</h1>
      <p>There is an <a href="/docs">internal link</a> and an <a href="https://example.com">external link</a>.</p>
    </article>
  </body>
</html>
`;

const setCustomTitle: Extractor = {
  name: 'set-custom-title',
  priority: 100,
  async extract(): Promise<Partial<ScrapedData>> {
    return { title: 'Overridden Title (custom extractor)' };
  },
};

const dependentExtractor: Extractor = {
  name: 'dependent',
  priority: 50,
  async extract(context): Promise<Partial<ScrapedData>> {
    return {
      custom: {
        titleSeenByDependent: context.results.title,
        hasDescription: Boolean(context.results.description),
      },
    };
  },
};

const failingExtractor: Extractor = {
  name: 'fails-on-purpose',
  priority: 10,
  async extract(): Promise<Partial<ScrapedData>> {
    throw new Error('Boom');
  },
};

async function main() {
  console.log('=== Extractor Pipeline Debug ===\n');

  const result = await scrapeHtml(html, 'https://local.test/pipeline', {
    extractors: [setCustomTitle, dependentExtractor, failingExtractor],
  });

  console.log('Title:', result.title);
  console.log('Description:', result.description);
  console.log('Custom:', result.custom);
  console.log('Error field:', result.error || '(none)');

  console.log('\nTip: Use extractor `priority` to control ordering (higher runs earlier).');
  console.log('Failures do not abort scraping; they accumulate into `result.error`.\n');
}

main().catch(console.error);


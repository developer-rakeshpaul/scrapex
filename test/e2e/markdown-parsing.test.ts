/**
 * Markdown Parsing - Documentation Examples Validation
 *
 * Tests markdown parsing examples from:
 * - docs/src/content/docs/guides/markdown-parsing.mdx
 * - docs/src/content/docs/api/parsers.mdx
 */
import { describe, expect, it } from 'vitest';
import { extractDomain } from '@/index.js';
import { MarkdownParser } from '@/parsers/index.js';

describe('Markdown Parsing (from docs)', () => {
  it('extracts sections, links, and code blocks', () => {
    const parser = new MarkdownParser();
    const markdown = `
# My Document

Check out [Example](https://example.com) for more info.

## Section One

- [Link 1](https://one.com) - First link
- [Link 2](https://two.com) - Second link

## Section Two

More content with [another link](https://three.com).

\`\`\`bash
npm install scrapex
\`\`\`
`;

    const result = parser.parse(markdown);

    expect(result.data.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.data.sections[0]?.title).toBe('My Document');
    expect(result.data.links.length).toBeGreaterThanOrEqual(4);
    expect(result.data.codeBlocks.length).toBe(1);
    expect(result.data.codeBlocks[0]?.language).toBe('bash');
  });

  it('filters links by domain (guide example)', () => {
    const parser = new MarkdownParser();
    const markdown = `
# Links

- [GitHub](https://github.com/user/repo)
- [npm](https://www.npmjs.com/package/scrapex)
- [Docs](https://example.com/docs)
`;

    const result = parser.parse(markdown);
    const githubLinks = result.data.links.filter(
      (link) => extractDomain(link.url) === 'github.com'
    );
    const npmLinks = result.data.links.filter((link) =>
      link.url.includes('npmjs.com/package/')
    );

    expect(githubLinks.length).toBe(1);
    expect(npmLinks.length).toBe(1);
  });
});

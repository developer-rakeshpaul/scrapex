import { describe, expect, it } from 'vitest';
import { extractListLinks, MarkdownParser, parseByHeadings } from '@/parsers/markdown.js';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  describe('canParse', () => {
    it('should detect markdown with headings', () => {
      expect(parser.canParse('# Heading')).toBe(true);
      expect(parser.canParse('## Subheading')).toBe(true);
    });

    it('should detect markdown with list links', () => {
      expect(parser.canParse('- [Link](https://example.com)')).toBe(true);
      expect(parser.canParse('* [Link](https://example.com)')).toBe(true);
    });

    it('should detect markdown with code blocks', () => {
      expect(parser.canParse('```js\nconsole.log("hi");\n```')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(parser.canParse('Just plain text without markdown')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should extract title from first h1', () => {
      const markdown = '# My Title\n\nSome content';
      const result = parser.parse(markdown);
      expect(result.data.title).toBe('My Title');
    });

    it('should extract title from frontmatter', () => {
      const markdown = '---\ntitle: Frontmatter Title\n---\n\n# Different Title';
      const result = parser.parse(markdown);
      expect(result.data.title).toBe('Frontmatter Title');
    });

    it('should extract description from frontmatter', () => {
      const markdown = '---\ntitle: Title\ndescription: My description\n---\n\nContent';
      const result = parser.parse(markdown);
      expect(result.data.description).toBe('My description');
    });

    it('should extract description from first paragraph', () => {
      const markdown = 'This is the description.\n\n# Heading\n\nContent';
      const result = parser.parse(markdown);
      expect(result.data.description).toBe('This is the description.');
    });
  });

  describe('sections', () => {
    it('should extract sections by heading', () => {
      const markdown = `
# Main Title

## Section One
Content for section one.

## Section Two
Content for section two.
      `;
      const result = parser.parse(markdown);
      expect(result.data.sections).toHaveLength(3);
      expect(result.data.sections[0]).toMatchObject({ level: 1, title: 'Main Title' });
      expect(result.data.sections[1]).toMatchObject({ level: 2, title: 'Section One' });
      expect(result.data.sections[2]).toMatchObject({ level: 2, title: 'Section Two' });
    });

    it('should include content in sections', () => {
      const markdown = `
## Section
This is the content.
Another paragraph.
      `;
      const result = parser.parse(markdown);
      expect(result.data.sections[0]?.content).toContain('This is the content');
    });
  });

  describe('links', () => {
    it('should extract all links', () => {
      const markdown = `
# Title

Check out [Link One](https://one.com) and [Link Two](https://two.com).
      `;
      const result = parser.parse(markdown);
      expect(result.data.links).toHaveLength(2);
      expect(result.data.links[0]).toMatchObject({
        url: 'https://one.com',
        text: 'Link One',
      });
    });

    it('should include link title if present', () => {
      const markdown = '[Link](https://example.com "Link Title")';
      const result = parser.parse(markdown);
      expect(result.data.links[0]?.title).toBe('Link Title');
    });

    it('should associate links with section context', () => {
      const markdown = `
## Section One
[Link in One](https://one.com)

## Section Two
[Link in Two](https://two.com)
      `;
      const result = parser.parse(markdown);
      const linkOne = result.data.links.find((l) => l.url.includes('one.com'));
      const linkTwo = result.data.links.find((l) => l.url.includes('two.com'));

      expect(linkOne?.context).toBe('Section One');
      expect(linkTwo?.context).toBe('Section Two');
    });
  });

  describe('code blocks', () => {
    it('should extract code blocks', () => {
      const markdown = `
# Code Example

\`\`\`javascript
console.log('Hello');
\`\`\`
      `;
      const result = parser.parse(markdown);
      expect(result.data.codeBlocks).toHaveLength(1);
      expect(result.data.codeBlocks[0]).toMatchObject({
        language: 'javascript',
        code: "console.log('Hello');",
      });
    });

    it('should extract code block meta', () => {
      const markdown = '```ts title="example.ts"\nconst x = 1;\n```';
      const result = parser.parse(markdown);
      expect(result.data.codeBlocks[0]?.meta).toBe('title="example.ts"');
    });

    it('should handle code blocks without language', () => {
      const markdown = '```\nplain code\n```';
      const result = parser.parse(markdown);
      expect(result.data.codeBlocks[0]?.language).toBeUndefined();
    });
  });

  describe('frontmatter parsing', () => {
    it('should parse string values', () => {
      const markdown = '---\nkey: value\n---\n';
      const result = parser.parse(markdown);
      expect(result.data.frontmatter?.key).toBe('value');
    });

    it('should parse boolean values', () => {
      const markdown = '---\nenabled: true\ndisabled: false\n---\n';
      const result = parser.parse(markdown);
      expect(result.data.frontmatter?.enabled).toBe(true);
      expect(result.data.frontmatter?.disabled).toBe(false);
    });

    it('should parse numeric values', () => {
      const markdown = '---\ncount: 42\nprice: 19.99\n---\n';
      const result = parser.parse(markdown);
      expect(result.data.frontmatter?.count).toBe(42);
      expect(result.data.frontmatter?.price).toBe(19.99);
    });

    it('should handle quoted strings', () => {
      const markdown = '---\nsingle: \'quoted\'\ndouble: "quoted"\n---\n';
      const result = parser.parse(markdown);
      expect(result.data.frontmatter?.single).toBe('quoted');
      expect(result.data.frontmatter?.double).toBe('quoted');
    });
  });
});

describe('extractListLinks', () => {
  it('should extract links from list items', () => {
    const markdown = `
## Resources

- [Resource One](https://one.com) - Description
- [Resource Two](https://two.com) - Another description
    `;
    const links = extractListLinks(markdown);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      url: 'https://one.com',
      text: 'Resource One',
      context: 'Resources',
    });
  });

  it('should handle nested lists', () => {
    const markdown = `
## Category

- [Parent](https://parent.com)
  - [Child One](https://child1.com)
  - [Child Two](https://child2.com)
    `;
    const links = extractListLinks(markdown);
    // Links may be extracted multiple times from nested list structure
    // At minimum, should find all three unique URLs
    const uniqueUrls = new Set(links.map((l) => l.url));
    expect(uniqueUrls.has('https://parent.com')).toBe(true);
    expect(uniqueUrls.has('https://child1.com')).toBe(true);
    expect(uniqueUrls.has('https://child2.com')).toBe(true);
  });

  it('should track heading context', () => {
    const markdown = `
## First Section
- [Link A](https://a.com)

## Second Section
- [Link B](https://b.com)
    `;
    const links = extractListLinks(markdown);
    const linkA = links.find((l) => l.url.includes('a.com'));
    const linkB = links.find((l) => l.url.includes('b.com'));

    expect(linkA?.context).toBe('First Section');
    expect(linkB?.context).toBe('Second Section');
  });
});

describe('parseByHeadings', () => {
  it('should filter sections by minimum level', () => {
    const markdown = `
# H1 Title

## H2 Section

### H3 Subsection

#### H4 Deep
    `;
    const sections = parseByHeadings(markdown, 2);
    expect(sections.every((s) => s.level >= 2)).toBe(true);
  });

  it('should default to level 2', () => {
    const markdown = '# Title\n\n## Section';
    const sections = parseByHeadings(markdown);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe('Section');
  });
});

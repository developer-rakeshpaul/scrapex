import type { Code, Heading, Link, ListItem, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString as mdastToString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import type {
  CodeBlock,
  MarkdownLink,
  MarkdownSection,
  ParsedMarkdown,
  ParserResult,
  SourceParser,
} from './types.js';

/**
 * Generic Markdown parser.
 * Extracts structure, links, and code blocks from markdown content.
 *
 * @example
 * ```ts
 * const parser = new MarkdownParser();
 * const result = parser.parse(markdownContent);
 * console.log(result.data.sections);
 * console.log(result.data.links);
 * ```
 */
export class MarkdownParser implements SourceParser<ParsedMarkdown> {
  readonly name = 'markdown';

  canParse(content: string): boolean {
    // Check for common markdown patterns
    return (
      content.includes('# ') ||
      content.includes('## ') ||
      content.includes('- [') ||
      content.includes('* [') ||
      content.includes('```')
    );
  }

  parse(content: string): ParserResult<ParsedMarkdown> {
    const tree = fromMarkdown(content);
    const sections: MarkdownSection[] = [];
    const allLinks: MarkdownLink[] = [];
    const codeBlocks: CodeBlock[] = [];
    let frontmatter: Record<string, unknown> | undefined;

    // Extract frontmatter if present
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontmatterContent = content.slice(3, endIndex).trim();
        frontmatter = this.parseFrontmatter(frontmatterContent);
      }
    }

    // Track current section
    let currentSection: MarkdownSection | null = null;

    // Process the AST
    visit(tree, (node) => {
      // Handle headings
      if (node.type === 'heading') {
        const heading = node as Heading;
        const title = mdastToString(heading);

        // Finalize previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        currentSection = {
          level: heading.depth,
          title,
          content: '',
          links: [],
        };
      }

      // Handle links
      if (node.type === 'link') {
        const link = node as Link;
        const text = mdastToString(link);
        const linkData: MarkdownLink = {
          url: link.url,
          text,
          title: link.title ?? undefined,
          context: currentSection?.title,
        };

        allLinks.push(linkData);
        if (currentSection) {
          currentSection.links.push(linkData);
        }
      }

      // Handle code blocks
      if (node.type === 'code') {
        const code = node as Code;
        codeBlocks.push({
          language: code.lang ?? undefined,
          code: code.value,
          meta: code.meta ?? undefined,
        });
      }

      // Accumulate content for current section
      if (currentSection && node.type === 'paragraph') {
        const text = mdastToString(node);
        currentSection.content += (currentSection.content ? '\n\n' : '') + text;
      }
    });

    // Finalize last section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Extract title from first h1 or frontmatter
    const title = (frontmatter?.title as string) ?? sections.find((s) => s.level === 1)?.title;

    // Extract description from frontmatter or first paragraph before any heading
    const description = (frontmatter?.description as string) ?? this.extractDescription(tree);

    return {
      data: {
        title,
        description,
        sections,
        links: allLinks,
        codeBlocks,
        frontmatter,
      },
    };
  }

  private parseFrontmatter(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: string | boolean | number = line.slice(colonIndex + 1).trim();

        // Parse simple types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

        result[key] = value;
      }
    }

    return result;
  }

  private extractDescription(tree: Root): string | undefined {
    // Find first paragraph before any heading
    for (const node of tree.children) {
      if (node.type === 'heading') break;
      if (node.type === 'paragraph') {
        return mdastToString(node);
      }
    }
    return undefined;
  }
}

/**
 * Extract links from a list-based markdown structure (like awesome lists)
 */
export function extractListLinks(markdown: string): MarkdownLink[] {
  const tree = fromMarkdown(markdown);
  const links: MarkdownLink[] = [];
  let currentHeading = '';

  visit(tree, (node) => {
    if (node.type === 'heading') {
      currentHeading = mdastToString(node as Heading);
    }

    if (node.type === 'listItem') {
      const listItem = node as ListItem;

      // Find links in this list item
      visit(listItem, 'link', (linkNode: Link) => {
        links.push({
          url: linkNode.url,
          text: mdastToString(linkNode),
          title: linkNode.title ?? undefined,
          context: currentHeading || undefined,
        });
      });
    }
  });

  return links;
}

/**
 * Parse markdown into sections by heading level
 */
export function parseByHeadings(markdown: string, minLevel = 2): MarkdownSection[] {
  const parser = new MarkdownParser();
  const result = parser.parse(markdown);
  return result.data.sections.filter((s) => s.level >= minLevel);
}

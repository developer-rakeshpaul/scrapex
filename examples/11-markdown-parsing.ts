/**
 * 11-markdown-parsing.ts
 *
 * Parse markdown content into structured data.
 * Extract sections, links, code blocks, and frontmatter.
 *
 * Run: npx tsx examples/11-markdown-parsing.ts
 */

import { extractListLinks, MarkdownParser, parseByHeadings } from '../src/parsers/index.js';

async function main() {
  console.log('=== Markdown Parsing Example ===\n');

  // Sample markdown content
  const markdown = `---
title: Getting Started with TypeScript
author: Jane Developer
date: 2024-01-15
tags:
  - typescript
  - tutorial
  - beginner
---

# Getting Started with TypeScript

TypeScript is a strongly typed programming language that builds on JavaScript.

## Installation

First, install TypeScript using npm:

\`\`\`bash
npm install -g typescript
\`\`\`

Then verify the installation:

\`\`\`bash
tsc --version
\`\`\`

## Basic Types

TypeScript provides several basic types:

- **string** - Text values
- **number** - Numeric values
- **boolean** - True/false values
- **array** - Lists of values

Learn more at [TypeScript Docs](https://www.typescriptlang.org/docs).

## Functions

Here's a simple function example:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

## Resources

Check out these helpful resources:

- [Official Documentation](https://www.typescriptlang.org/docs) - Complete reference
- [TypeScript Playground](https://www.typescriptlang.org/play) - Try it online
- [GitHub Repository](https://github.com/microsoft/TypeScript) - Source code
- [Stack Overflow](https://stackoverflow.com/questions/tagged/typescript) - Q&A

## Conclusion

TypeScript adds type safety to JavaScript, making your code more robust.
`;

  // Example 1: Full parsing with MarkdownParser
  console.log('--- MarkdownParser ---');

  const parser = new MarkdownParser();
  const result = parser.parse(markdown);

  console.log('Title:', result.data.title);
  console.log(`Description: ${result.data.description?.slice(0, 80) || 'No description'}`);

  console.log('\nFrontmatter:');
  console.log(JSON.stringify(result.data.frontmatter, null, 2));

  console.log('\nSections:');
  result.data.sections.forEach((section) => {
    console.log(`  ${'#'.repeat(section.level)} ${section.title}`);
    console.log(`     Content: ${section.content.slice(0, 50)}...`);
    console.log(`     Links: ${section.links.length}`);
  });

  console.log('\nCode Blocks:');
  result.data.codeBlocks.forEach((block, i) => {
    console.log(`  ${i + 1}. Language: ${block.language || 'plain'}`);
    console.log(`     Code: ${block.code.slice(0, 40)}...`);
  });

  console.log('\nAll Links:');
  result.data.links.forEach((link) => {
    console.log(`  - ${link.text}: ${link.url}`);
    if (link.context) console.log(`    (in section: ${link.context})`);
  });

  // Example 2: Extract links from lists
  console.log('\n--- extractListLinks() ---');

  const listLinks = extractListLinks(markdown);
  console.log('Links found in lists:');
  listLinks.forEach((link) => {
    console.log(`  - ${link.text}: ${link.url}`);
  });

  // Example 3: Parse by headings
  console.log('\n--- parseByHeadings() ---');

  const sections = parseByHeadings(markdown, 2); // Only h2 and above
  console.log('H2+ Sections:');
  sections.forEach((section) => {
    console.log(`  ${section.title} (level ${section.level})`);
  });

  // Example 4: Processing scraped content
  console.log('\n--- Use with Scraped Content ---');
  console.log(`
// Scrape a page and parse its markdown content
import { scrape } from 'scrapex';
import { MarkdownParser } from 'scrapex/parsers';

const result = await scrape('https://github.com/user/repo');
const parser = new MarkdownParser();
const parsed = parser.parse(result.content);

// Access structured data
console.log(parsed.data.sections);
console.log(parsed.data.codeBlocks);
console.log(parsed.data.links);
  `);
}

main().catch(console.error);

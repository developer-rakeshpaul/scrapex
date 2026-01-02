/**
 * 12-github-parsing.ts
 *
 * GitHub-specific utilities for parsing repos.
 *
 * Run: npx tsx examples/12-github-parsing.ts
 */

import {
  extractListLinks,
  fetchRepoMeta,
  groupByCategory,
  isGitHubRepo,
  parseGitHubUrl,
  toRawUrl,
} from '../src/parsers/index.js';

async function main() {
  console.log('=== GitHub Parsing Example ===\n');

  // Example 1: URL detection
  console.log('--- URL Detection ---');

  const urls = [
    'https://github.com/microsoft/TypeScript',
    'https://github.com/user/repo/blob/main/README.md',
    'https://example.com/page',
  ];

  urls.forEach((url) => {
    console.log(`${url}`);
    console.log(`  isGitHubRepo: ${isGitHubRepo(url)}`);
  });

  // Example 2: Parse GitHub URL
  console.log('\n--- parseGitHubUrl() ---');

  const parsed = parseGitHubUrl('https://github.com/microsoft/TypeScript/tree/main/src');
  console.log('Parsed:', parsed);
  // { owner: 'microsoft', repo: 'TypeScript' }

  // Example 3: Convert to raw URL
  console.log('\n--- toRawUrl() ---');

  const repoUrl = 'https://github.com/microsoft/TypeScript';
  const rawReadme = toRawUrl(repoUrl, 'main', 'README.md');
  console.log('Raw URL:', rawReadme);
  // https://raw.githubusercontent.com/microsoft/TypeScript/main/README.md

  // Example 4: Extract links from markdown and group by category
  console.log('\n--- extractListLinks() + groupByCategory() ---');

  const markdown = `
# Resources

## Libraries

- [Redux](https://github.com/reduxjs/redux) - State management
- [MobX](https://github.com/mobxjs/mobx) - Simple state management

## Tools

- [TypeScript](https://github.com/microsoft/TypeScript) - The language
- [ESLint](https://eslint.org/) - Linting utility

## Articles

- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - Free book
`;

  const links = extractListLinks(markdown);
  console.log('Total links found:', links.length);

  const grouped = groupByCategory(links);
  console.log('\nGrouped by category:');
  grouped.forEach((categoryLinks, category) => {
    console.log(`  ${category}: ${categoryLinks.length} links`);
    categoryLinks.forEach((link) => {
      console.log(`    - ${link.text}: ${link.url}`);
    });
  });

  // Example 5: Fetch repo metadata (requires token)
  console.log('\n--- fetchRepoMeta() ---');
  console.log(`
// Requires GitHub personal access token for full functionality
import { fetchRepoMeta } from 'scrapex/parsers';

const meta = await fetchRepoMeta('microsoft', 'TypeScript', process.env.GITHUB_TOKEN);

console.log(meta);
// {
//   repoOwner: 'microsoft',
//   repoName: 'TypeScript',
//   // ... additional metadata when API is implemented
// }
  `);

  // Demo fetchRepoMeta (basic info only without token)
  const meta = await fetchRepoMeta('microsoft', 'TypeScript');
  console.log('Basic meta (no API call):', meta);

  // Example 6: Complete workflow
  console.log('\n--- Complete Workflow ---');
  console.log(`
import { scrape } from 'scrapex';
import { extractListLinks, groupByCategory, isGitHubRepo, parseGitHubUrl } from 'scrapex/parsers';

// 1. Scrape a page with links
const result = await scrape('https://example.com/resources');

// 2. Extract links from the content
const links = extractListLinks(result.content);

// 3. Filter GitHub repos
const repos = links.filter(link => isGitHubRepo(link.url));

// 4. Parse repo info
for (const link of repos) {
  const info = parseGitHubUrl(link.url);
  console.log(\`\${info?.owner}/\${info?.repo}: \${link.text}\`);
}

// 5. Group by section
const grouped = groupByCategory(links);
  `);
}

main().catch(console.error);

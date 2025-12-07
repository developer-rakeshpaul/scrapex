import { extractListLinks } from './markdown.js';
import type { GitHubMeta, MarkdownLink } from './types.js';

/**
 * GitHub-specific utilities for parsing awesome lists and repositories.
 * These can be composed with the MarkdownParser for enhanced GitHub parsing.
 */

/**
 * Check if a URL is a GitHub repository
 */
export function isGitHubRepo(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(url);
}

/**
 * Check if a URL is a GitHub awesome list (README.md in a repo)
 */
export function isAwesomeList(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('github.com') &&
    (lowerUrl.includes('awesome') || lowerUrl.includes('/readme'))
  );
}

/**
 * Extract GitHub repo info from URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match || !match[1] || !match[2]) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

/**
 * Convert a GitHub repo URL to raw content URL
 */
export function toRawUrl(url: string, branch = 'main', file = 'README.md'): string {
  const info = parseGitHubUrl(url);
  if (!info) return url;
  return `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${branch}/${file}`;
}

/**
 * Extract links from an awesome list markdown content.
 * Filters and enhances links with GitHub-specific metadata.
 */
export function parseAwesomeList(markdown: string): AwesomeListResult {
  const allLinks = extractListLinks(markdown);

  // Categorize links
  const repositories: EnhancedLink[] = [];
  const tools: EnhancedLink[] = [];
  const articles: EnhancedLink[] = [];
  const other: EnhancedLink[] = [];

  for (const link of allLinks) {
    const enhanced: EnhancedLink = {
      ...link,
      category: link.context,
      isGitHub: link.url.includes('github.com'),
    };

    if (isGitHubRepo(link.url)) {
      const info = parseGitHubUrl(link.url);
      if (info) {
        enhanced.repoOwner = info.owner;
        enhanced.repoName = info.repo;
      }
      repositories.push(enhanced);
    } else if (
      link.url.includes('medium.com') ||
      link.url.includes('dev.to') ||
      link.url.includes('blog')
    ) {
      articles.push(enhanced);
    } else if (
      link.text.toLowerCase().includes('tool') ||
      link.context?.toLowerCase().includes('tool')
    ) {
      tools.push(enhanced);
    } else {
      other.push(enhanced);
    }
  }

  return {
    repositories,
    tools,
    articles,
    other,
    total: allLinks.length,
  };
}

/**
 * Enhanced link with GitHub-specific metadata
 */
export interface EnhancedLink extends MarkdownLink {
  category?: string;
  isGitHub?: boolean;
  repoOwner?: string;
  repoName?: string;
}

/**
 * Result from parsing an awesome list
 */
export interface AwesomeListResult {
  repositories: EnhancedLink[];
  tools: EnhancedLink[];
  articles: EnhancedLink[];
  other: EnhancedLink[];
  total: number;
}

/**
 * Fetch GitHub API metadata for a repository
 * Note: This is a placeholder - actual implementation would need GitHub API access
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
  _token?: string
): Promise<GitHubMeta> {
  // This would make actual API calls in a full implementation
  // For now, return basic info
  return {
    repoOwner: owner,
    repoName: repo,
  };
}

/**
 * Group links by their category/section
 */
export function groupByCategory(links: MarkdownLink[]): Map<string, MarkdownLink[]> {
  const groups = new Map<string, MarkdownLink[]>();

  for (const link of links) {
    const category = link.context || 'Uncategorized';
    const existing = groups.get(category) || [];
    existing.push(link);
    groups.set(category, existing);
  }

  return groups;
}

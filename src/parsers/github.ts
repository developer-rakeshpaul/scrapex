import type { GitHubMeta, MarkdownLink } from './types.js';

/**
 * GitHub-specific utilities for parsing repositories.
 */

/**
 * Check if a URL is a GitHub repository
 */
export function isGitHubRepo(url: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(url);
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

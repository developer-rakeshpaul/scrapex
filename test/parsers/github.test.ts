import { describe, expect, it } from 'vitest';
import { groupByCategory, isGitHubRepo, parseGitHubUrl, toRawUrl } from '@/parsers/github.js';
import type { MarkdownLink } from '@/parsers/types.js';

// Test repo: https://github.com/developer-rakeshpaul/scrapex
const TEST_REPO = 'https://github.com/developer-rakeshpaul/scrapex';
const TEST_OWNER = 'developer-rakeshpaul';
const TEST_REPO_NAME = 'scrapex';

describe('GitHub utilities', () => {
  describe('isGitHubRepo', () => {
    it('should return true for valid GitHub repo URLs', () => {
      expect(isGitHubRepo(TEST_REPO)).toBe(true);
      expect(isGitHubRepo(`${TEST_REPO}/`)).toBe(true);
      expect(isGitHubRepo('http://github.com/developer-rakeshpaul/scrapex')).toBe(true);
      expect(isGitHubRepo('https://www.github.com/developer-rakeshpaul/scrapex')).toBe(true);
    });

    it('should return false for non-repo URLs', () => {
      expect(isGitHubRepo('https://github.com')).toBe(false);
      expect(isGitHubRepo('https://github.com/developer-rakeshpaul')).toBe(false);
      expect(isGitHubRepo(`${TEST_REPO}/issues`)).toBe(false);
      expect(isGitHubRepo(`${TEST_REPO}/blob/main/README.md`)).toBe(false);
      expect(isGitHubRepo('https://gitlab.com/developer-rakeshpaul/scrapex')).toBe(false);
    });
  });

  describe('parseGitHubUrl', () => {
    it('should extract owner and repo', () => {
      const result = parseGitHubUrl(TEST_REPO);
      expect(result).toEqual({ owner: TEST_OWNER, repo: TEST_REPO_NAME });
    });

    it('should handle URLs with trailing paths', () => {
      const result = parseGitHubUrl(`${TEST_REPO}/issues/123`);
      expect(result).toEqual({ owner: TEST_OWNER, repo: TEST_REPO_NAME });
    });

    it('should remove .git suffix', () => {
      const result = parseGitHubUrl(`${TEST_REPO}.git`);
      expect(result).toEqual({ owner: TEST_OWNER, repo: TEST_REPO_NAME });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubUrl('https://example.com')).toBeNull();
      expect(parseGitHubUrl('https://github.com')).toBeNull();
      expect(parseGitHubUrl('https://github.com/developer-rakeshpaul')).toBeNull();
    });
  });

  describe('toRawUrl', () => {
    it('should convert to raw.githubusercontent.com URL', () => {
      const result = toRawUrl(TEST_REPO);
      expect(result).toBe(
        `https://raw.githubusercontent.com/${TEST_OWNER}/${TEST_REPO_NAME}/main/README.md`
      );
    });

    it('should use custom branch', () => {
      const result = toRawUrl(TEST_REPO, 'master');
      expect(result).toBe(
        `https://raw.githubusercontent.com/${TEST_OWNER}/${TEST_REPO_NAME}/master/README.md`
      );
    });

    it('should use custom file', () => {
      const result = toRawUrl(TEST_REPO, 'main', 'CONTRIBUTING.md');
      expect(result).toBe(
        `https://raw.githubusercontent.com/${TEST_OWNER}/${TEST_REPO_NAME}/main/CONTRIBUTING.md`
      );
    });

    it('should return original URL if not a GitHub repo', () => {
      const url = 'https://example.com/not-github';
      expect(toRawUrl(url)).toBe(url);
    });
  });
});

describe('groupByCategory', () => {
  it('should group links by context', () => {
    const links: MarkdownLink[] = [
      { url: 'https://a.com', text: 'A', context: 'Category One' },
      { url: 'https://b.com', text: 'B', context: 'Category One' },
      { url: 'https://c.com', text: 'C', context: 'Category Two' },
    ];

    const groups = groupByCategory(links);
    expect(groups.get('Category One')).toHaveLength(2);
    expect(groups.get('Category Two')).toHaveLength(1);
  });

  it('should use "Uncategorized" for links without context', () => {
    const links: MarkdownLink[] = [
      { url: 'https://a.com', text: 'A' },
      { url: 'https://b.com', text: 'B', context: undefined },
    ];

    const groups = groupByCategory(links);
    expect(groups.get('Uncategorized')).toHaveLength(2);
  });

  it('should return empty map for empty input', () => {
    const groups = groupByCategory([]);
    expect(groups.size).toBe(0);
  });
});

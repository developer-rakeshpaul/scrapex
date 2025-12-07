import { describe, expect, it } from 'vitest';
import {
  groupByCategory,
  isAwesomeList,
  isGitHubRepo,
  parseAwesomeList,
  parseGitHubUrl,
  toRawUrl,
} from '@/parsers/github.js';
import type { MarkdownLink } from '@/parsers/types.js';

describe('GitHub utilities', () => {
  describe('isGitHubRepo', () => {
    it('should return true for valid GitHub repo URLs', () => {
      expect(isGitHubRepo('https://github.com/owner/repo')).toBe(true);
      expect(isGitHubRepo('https://github.com/owner/repo/')).toBe(true);
      expect(isGitHubRepo('http://github.com/owner/repo')).toBe(true);
      expect(isGitHubRepo('https://www.github.com/owner/repo')).toBe(true);
    });

    it('should return false for non-repo URLs', () => {
      expect(isGitHubRepo('https://github.com')).toBe(false);
      expect(isGitHubRepo('https://github.com/owner')).toBe(false);
      expect(isGitHubRepo('https://github.com/owner/repo/issues')).toBe(false);
      expect(isGitHubRepo('https://github.com/owner/repo/blob/main/file.js')).toBe(false);
      expect(isGitHubRepo('https://gitlab.com/owner/repo')).toBe(false);
    });
  });

  describe('isAwesomeList', () => {
    it('should return true for awesome list URLs', () => {
      expect(isAwesomeList('https://github.com/sindresorhus/awesome-nodejs')).toBe(true);
      expect(isAwesomeList('https://github.com/owner/awesome-stuff')).toBe(true);
      expect(isAwesomeList('https://github.com/owner/repo/blob/main/README.md')).toBe(true);
    });

    it('should return false for non-awesome URLs', () => {
      expect(isAwesomeList('https://github.com/owner/regular-repo')).toBe(false);
      expect(isAwesomeList('https://example.com/awesome')).toBe(false);
    });
  });

  describe('parseGitHubUrl', () => {
    it('should extract owner and repo', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should handle URLs with trailing paths', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/issues/123');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should remove .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubUrl('https://example.com')).toBeNull();
      expect(parseGitHubUrl('https://github.com')).toBeNull();
      expect(parseGitHubUrl('https://github.com/owner')).toBeNull();
    });
  });

  describe('toRawUrl', () => {
    it('should convert to raw.githubusercontent.com URL', () => {
      const result = toRawUrl('https://github.com/owner/repo');
      expect(result).toBe('https://raw.githubusercontent.com/owner/repo/main/README.md');
    });

    it('should use custom branch', () => {
      const result = toRawUrl('https://github.com/owner/repo', 'master');
      expect(result).toBe('https://raw.githubusercontent.com/owner/repo/master/README.md');
    });

    it('should use custom file', () => {
      const result = toRawUrl('https://github.com/owner/repo', 'main', 'CONTRIBUTING.md');
      expect(result).toBe('https://raw.githubusercontent.com/owner/repo/main/CONTRIBUTING.md');
    });

    it('should return original URL if not a GitHub repo', () => {
      const url = 'https://example.com/not-github';
      expect(toRawUrl(url)).toBe(url);
    });
  });
});

describe('parseAwesomeList', () => {
  it('should categorize GitHub repositories', () => {
    const markdown = `
## Libraries

- [react](https://github.com/facebook/react) - A library for building UIs
- [vue](https://github.com/vuejs/vue) - Progressive framework
    `;
    const result = parseAwesomeList(markdown);
    expect(result.repositories).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should extract repo info for GitHub links', () => {
    const markdown = '- [React](https://github.com/facebook/react)';
    const result = parseAwesomeList(markdown);
    expect(result.repositories[0]).toMatchObject({
      repoOwner: 'facebook',
      repoName: 'react',
      isGitHub: true,
    });
  });

  it('should categorize articles', () => {
    const markdown = `
## Articles

- [Blog Post](https://medium.com/article) - A great article
- [Dev Post](https://dev.to/post) - Another article
- [Blog](https://myblog.com/post) - Blog post
    `;
    const result = parseAwesomeList(markdown);
    expect(result.articles).toHaveLength(3);
  });

  it('should categorize tools', () => {
    const markdown = `
## Tools

- [CLI Tool](https://example.com/cli-tool) - Command line tool
    `;
    const result = parseAwesomeList(markdown);
    expect(result.tools).toHaveLength(1);
  });

  it('should put uncategorized links in other', () => {
    const markdown = `
## Resources

- [Random Link](https://example.com/random) - Something else
    `;
    const result = parseAwesomeList(markdown);
    expect(result.other).toHaveLength(1);
  });

  it('should include category context', () => {
    const markdown = `
## Development

- [Library](https://github.com/owner/lib) - A library
    `;
    const result = parseAwesomeList(markdown);
    expect(result.repositories[0]?.category).toBe('Development');
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

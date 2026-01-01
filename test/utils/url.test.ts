import { describe, expect, it } from 'vitest';
import {
  extractDomain,
  getPath,
  getProtocol,
  isExternalUrl,
  isValidUrl,
  matchesUrlPattern,
  normalizeUrl,
  resolveUrl,
} from '@/utils/url.js';

describe('url utilities', () => {
  describe('isValidUrl', () => {
    it('should return true for valid http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('http://example.com:8080')).toBe(true);
    });

    it('should return true for valid https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///path/to/file')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('should remove trailing slashes (except root)', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('should remove UTM tracking parameters', () => {
      const url = 'https://example.com/page?utm_source=test&utm_medium=email&name=value';
      const normalized = normalizeUrl(url);
      expect(normalized).toBe('https://example.com/page?name=value');
      expect(normalized).not.toContain('utm_source');
      expect(normalized).not.toContain('utm_medium');
    });

    it('should remove common tracking parameters', () => {
      const url = 'https://example.com?fbclid=abc&gclid=def&ref=test';
      const normalized = normalizeUrl(url);
      expect(normalized).not.toContain('fbclid');
      expect(normalized).not.toContain('gclid');
      expect(normalized).not.toContain('ref=');
    });

    it('should return original string for invalid URLs', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain without www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
      expect(extractDomain('https://example.com')).toBe('example.com');
    });

    it('should handle subdomains', () => {
      expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
      expect(extractDomain('https://www.blog.example.com')).toBe('blog.example.com');
    });

    it('should return empty string for invalid URLs', () => {
      expect(extractDomain('not-a-url')).toBe('');
    });
  });

  describe('resolveUrl', () => {
    const baseUrl = 'https://example.com/path/page.html';

    it('should resolve relative URLs', () => {
      expect(resolveUrl('/absolute', baseUrl)).toBe('https://example.com/absolute');
      expect(resolveUrl('./relative', baseUrl)).toBe('https://example.com/path/relative');
      expect(resolveUrl('../up', baseUrl)).toBe('https://example.com/up');
    });

    it('should return absolute URLs unchanged', () => {
      expect(resolveUrl('https://other.com/page', baseUrl)).toBe('https://other.com/page');
    });

    it('should return undefined for null/undefined input', () => {
      expect(resolveUrl(null, baseUrl)).toBeUndefined();
      expect(resolveUrl(undefined, baseUrl)).toBeUndefined();
      expect(resolveUrl('', baseUrl)).toBeUndefined();
    });

    it('should resolve protocol-relative URLs using base URL protocol', () => {
      // Protocol-relative URLs inherit the protocol from the base URL
      expect(resolveUrl('//cdn.example.com/script.js', 'https://example.com')).toBe(
        'https://cdn.example.com/script.js'
      );
      expect(resolveUrl('//cdn.example.com/script.js', 'http://example.com')).toBe(
        'http://cdn.example.com/script.js'
      );
    });

    it('should handle protocol-relative URLs with paths', () => {
      expect(resolveUrl('//other.com/path/to/resource', baseUrl)).toBe(
        'https://other.com/path/to/resource'
      );
    });

    it('should handle protocol-relative URLs with query strings', () => {
      expect(resolveUrl('//cdn.example.com/script.js?v=1.0', baseUrl)).toBe(
        'https://cdn.example.com/script.js?v=1.0'
      );
      expect(resolveUrl('//cdn.example.com/api?foo=bar&baz=qux', baseUrl)).toBe(
        'https://cdn.example.com/api?foo=bar&baz=qux'
      );
    });

    it('should handle protocol-relative URLs with fragments', () => {
      expect(resolveUrl('//cdn.example.com/page#section', baseUrl)).toBe(
        'https://cdn.example.com/page#section'
      );
      expect(resolveUrl('//cdn.example.com/docs#api-reference', baseUrl)).toBe(
        'https://cdn.example.com/docs#api-reference'
      );
    });

    it('should handle protocol-relative URLs with ports', () => {
      expect(resolveUrl('//cdn.example.com:8080/resource', baseUrl)).toBe(
        'https://cdn.example.com:8080/resource'
      );
      expect(resolveUrl('//localhost:3000/api', baseUrl)).toBe(
        'https://localhost:3000/api'
      );
    });

    it('should handle protocol-relative URLs with query strings, fragments, and ports combined', () => {
      expect(resolveUrl('//cdn.example.com:8080/path?v=1#section', baseUrl)).toBe(
        'https://cdn.example.com:8080/path?v=1#section'
      );
    });
  });

  describe('isExternalUrl', () => {
    it('should detect external URLs', () => {
      expect(isExternalUrl('https://other.com', 'example.com')).toBe(true);
      expect(isExternalUrl('https://sub.other.com', 'example.com')).toBe(true);
    });

    it('should detect internal URLs', () => {
      expect(isExternalUrl('https://example.com/page', 'example.com')).toBe(false);
      expect(isExternalUrl('https://www.example.com/page', 'example.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isExternalUrl('not-a-url', 'example.com')).toBe(false);
    });
  });

  describe('getProtocol', () => {
    it('should extract protocol', () => {
      expect(getProtocol('https://example.com')).toBe('https:');
      expect(getProtocol('http://example.com')).toBe('http:');
    });

    it('should return empty string for invalid URLs', () => {
      expect(getProtocol('not-a-url')).toBe('');
    });
  });

  describe('getPath', () => {
    it('should extract path', () => {
      expect(getPath('https://example.com/path/to/page')).toBe('/path/to/page');
      expect(getPath('https://example.com')).toBe('/');
    });

    it('should return empty string for invalid URLs', () => {
      expect(getPath('not-a-url')).toBe('');
    });
  });

  describe('matchesUrlPattern', () => {
    it('should match exact URLs', () => {
      expect(matchesUrlPattern('https://example.com/path', 'https://example.com/path')).toBe(true);
    });

    it('should match URL prefixes', () => {
      expect(matchesUrlPattern('https://example.com/path/sub', 'https://example.com/path')).toBe(
        true
      );
    });

    it('should match wildcard patterns', () => {
      expect(matchesUrlPattern('https://example.com/blog/post-1', 'https://example.com/blog/*')).toBe(
        true
      );
      expect(
        matchesUrlPattern('https://example.com/any/path', 'https://example.com/*/path')
      ).toBe(true);
      expect(matchesUrlPattern('https://sub.example.com/page', 'https://*.example.com/*')).toBe(
        true
      );
    });

    it('should not match non-matching patterns', () => {
      expect(matchesUrlPattern('https://other.com', 'https://example.com/*')).toBe(false);
    });
  });
});

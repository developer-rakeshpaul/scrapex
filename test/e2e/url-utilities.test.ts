/**
 * URL Utilities - Documentation Examples Validation
 *
 * Tests all URL utility examples from docs/src/content/docs/api/utilities.mdx
 */

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
} from '@/index.js';

describe('URL Utilities (from docs/api/utilities.mdx)', () => {
  describe('isValidUrl()', () => {
    it('validates URLs correctly - documentation examples', () => {
      // From docs:
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('extractDomain()', () => {
    it('extracts domains correctly - documentation examples', () => {
      // From docs:
      expect(extractDomain('https://www.example.com/page')).toBe('example.com');
      expect(extractDomain('https://blog.example.com/post')).toBe('blog.example.com');
      expect(extractDomain('https://example.com:8080/api')).toBe('example.com');
      expect(extractDomain('invalid')).toBe('');
    });
  });

  describe('normalizeUrl()', () => {
    it('normalizes URLs correctly - documentation examples', () => {
      // Lowercases URLs
      expect(normalizeUrl('HTTPS://Example.COM/')).toBe('https://example.com/');

      // Removes default ports (443 for https)
      expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page');

      // Removes tracking params like utm_source
      expect(normalizeUrl('https://example.com?b=2&a=1&utm_source=site')).toBe(
        'https://example.com/?b=2&a=1'
      );
    });

    it('handles real-world messy URLs', () => {
      // Tracking parameters removal
      expect(normalizeUrl('https://example.com?fbclid=123&gclid=456&utm_medium=email')).toBe(
        'https://example.com/'
      );

      // IDN Domains should be punycoded by standard URL normalization
      const idnUrl = 'https://MÜNCHEN.com';
      expect(normalizeUrl(idnUrl)).toBe('https://xn--mnchen-3ya.com/');

      // Fragment preservation (current implementation behavior)
      expect(normalizeUrl('https://example.com/page#section')).toBe(
        'https://example.com/page#section'
      );
    });
  });

  describe('resolveUrl()', () => {
    it('resolves relative URLs correctly - documentation examples', () => {
      // From docs:
      expect(resolveUrl('../other', 'https://example.com/page/')).toBe('https://example.com/other');

      expect(resolveUrl('/about', 'https://example.com/blog/post')).toBe(
        'https://example.com/about'
      );

      // Absolute URLs get trailing slash
      expect(resolveUrl('https://other.com', 'https://example.com')).toBe('https://other.com/');
    });

    it('handles protocol-relative URLs', () => {
      expect(resolveUrl('//cdn.example.com/lib.js', 'https://example.com')).toBe(
        'https://cdn.example.com/lib.js'
      );
      expect(resolveUrl('//cdn.example.com/lib.js', 'http://example.com')).toBe(
        'http://cdn.example.com/lib.js'
      );
    });
  });

  describe('isExternalUrl()', () => {
    it('detects external URLs correctly - documentation examples', () => {
      // From docs:
      const baseDomain = extractDomain('https://example.com');

      expect(isExternalUrl('https://other.com', baseDomain)).toBe(true);
      expect(isExternalUrl('https://example.com/page', baseDomain)).toBe(false);
      expect(isExternalUrl('/page', baseDomain)).toBe(false);
    });
  });

  describe('getProtocol()', () => {
    it('extracts protocol correctly - documentation examples', () => {
      // From docs:
      expect(getProtocol('https://example.com/path')).toBe('https:');
    });
  });

  describe('getPath()', () => {
    it('extracts path correctly - documentation examples', () => {
      // From docs:
      expect(getPath('https://example.com/docs/intro?ref=nav')).toBe('/docs/intro');
    });
  });

  describe('matchesUrlPattern()', () => {
    it('matches URL patterns correctly - documentation examples', () => {
      // From docs:
      expect(matchesUrlPattern('https://example.com/docs/a', 'https://example.com/docs/*')).toBe(
        true
      );

      expect(matchesUrlPattern('https://example.com/blog', 'https://example.com/docs/*')).toBe(
        false
      );
    });
  });
});

import { describe, expect, it } from 'vitest';
import { ScrapeError } from '@/core/errors.js';

describe('ScrapeError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new ScrapeError('Test error', 'FETCH_FAILED');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('FETCH_FAILED');
      expect(error.name).toBe('ScrapeError');
      expect(error.statusCode).toBeUndefined();
    });

    it('should create error with status code', () => {
      const error = new ScrapeError('Not found', 'NOT_FOUND', 404);
      expect(error.statusCode).toBe(404);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new ScrapeError('Wrapper error', 'FETCH_FAILED', undefined, cause);
      expect(error.cause).toBe(cause);
    });

    it('should capture stack trace', () => {
      const error = new ScrapeError('Test error', 'FETCH_FAILED');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ScrapeError');
    });
  });

  describe('from', () => {
    it('should return same error if already ScrapeError', () => {
      const original = new ScrapeError('Original', 'TIMEOUT');
      const result = ScrapeError.from(original);
      expect(result).toBe(original);
    });

    it('should wrap standard Error', () => {
      const original = new Error('Standard error');
      const result = ScrapeError.from(original, 'PARSE_ERROR');
      expect(result.message).toBe('Standard error');
      expect(result.code).toBe('PARSE_ERROR');
      expect(result.cause).toBe(original);
    });

    it('should handle string errors', () => {
      const result = ScrapeError.from('String error', 'INVALID_URL');
      expect(result.message).toBe('String error');
      expect(result.code).toBe('INVALID_URL');
    });

    it('should handle unknown errors', () => {
      const result = ScrapeError.from({ weird: 'object' });
      expect(result.message).toBe('[object Object]');
      expect(result.code).toBe('FETCH_FAILED');
    });
  });

  describe('isRetryable', () => {
    it('should return true for FETCH_FAILED', () => {
      const error = new ScrapeError('Fetch failed', 'FETCH_FAILED');
      expect(error.isRetryable()).toBe(true);
    });

    it('should return true for TIMEOUT', () => {
      const error = new ScrapeError('Timeout', 'TIMEOUT');
      expect(error.isRetryable()).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(new ScrapeError('Invalid', 'INVALID_URL').isRetryable()).toBe(false);
      expect(new ScrapeError('Blocked', 'BLOCKED').isRetryable()).toBe(false);
      expect(new ScrapeError('Not found', 'NOT_FOUND').isRetryable()).toBe(false);
      expect(new ScrapeError('Robots', 'ROBOTS_BLOCKED').isRetryable()).toBe(false);
      expect(new ScrapeError('Parse', 'PARSE_ERROR').isRetryable()).toBe(false);
      expect(new ScrapeError('LLM', 'LLM_ERROR').isRetryable()).toBe(false);
      expect(new ScrapeError('Validation', 'VALIDATION_ERROR').isRetryable()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const error = new ScrapeError('Test error', 'NOT_FOUND', 404);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ScrapeError',
        message: 'Test error',
        code: 'NOT_FOUND',
        statusCode: 404,
        stack: expect.any(String),
      });
    });

    it('should handle undefined statusCode', () => {
      const error = new ScrapeError('Test', 'TIMEOUT');
      const json = error.toJSON();
      expect(json.statusCode).toBeUndefined();
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { getErrorCodeFromStatus, isRetryableStatus } from '../../src/common/errors.js';
import {
  createHeaders,
  isPrivateHost,
  isRetryableError,
  validateUrl,
  withRetry,
  withTimeout,
} from '../../src/common/http-base.js';
import { ScrapeError } from '../../src/core/errors.js';

describe('common/http-base', () => {
  describe('isPrivateHost', () => {
    it('identifies private IPv4 addresses', () => {
      expect(isPrivateHost('10.0.0.1')).toBe(true);
      expect(isPrivateHost('10.255.255.255')).toBe(true);
      expect(isPrivateHost('172.16.0.1')).toBe(true);
      expect(isPrivateHost('172.31.255.255')).toBe(true);
      expect(isPrivateHost('192.168.0.1')).toBe(true);
      expect(isPrivateHost('192.168.255.255')).toBe(true);
      expect(isPrivateHost('127.0.0.1')).toBe(true);
      expect(isPrivateHost('0.0.0.0')).toBe(true);
    });

    it('identifies private IPv6 addresses', () => {
      expect(isPrivateHost('::1')).toBe(true);
      expect(isPrivateHost('fc00::1')).toBe(true);
      expect(isPrivateHost('fd00::1')).toBe(true);
      expect(isPrivateHost('fe80::1')).toBe(true);
    });

    it('identifies localhost', () => {
      expect(isPrivateHost('localhost')).toBe(true);
      expect(isPrivateHost('LOCALHOST')).toBe(true);
    });

    it('allows public addresses', () => {
      expect(isPrivateHost('8.8.8.8')).toBe(false);
      expect(isPrivateHost('1.1.1.1')).toBe(false);
      expect(isPrivateHost('142.250.80.46')).toBe(false);
      expect(isPrivateHost('example.com')).toBe(false);
      expect(isPrivateHost('api.openai.com')).toBe(false);
    });

    it('identifies link-local addresses', () => {
      expect(isPrivateHost('169.254.1.1')).toBe(true);
    });
  });

  describe('validateUrl', () => {
    it('accepts valid HTTPS URLs', () => {
      const url = validateUrl('https://api.openai.com/v1/embeddings');
      expect(url.hostname).toBe('api.openai.com');
    });

    it('rejects HTTP URLs by default', () => {
      expect(() => validateUrl('http://api.example.com')).toThrow(ScrapeError);
      expect(() => validateUrl('http://api.example.com')).toThrow('HTTPS required');
    });

    it('allows HTTP when requireHttps is false', () => {
      const url = validateUrl('http://example.com', { requireHttps: false });
      expect(url.hostname).toBe('example.com');
    });

    it('rejects private addresses by default', () => {
      expect(() => validateUrl('https://192.168.1.1')).toThrow(ScrapeError);
      expect(() => validateUrl('https://192.168.1.1')).toThrow('Private/internal');
    });

    it('allows private addresses when allowPrivate is true', () => {
      const url = validateUrl('https://192.168.1.1', { allowPrivate: true });
      expect(url.hostname).toBe('192.168.1.1');
    });

    it('allows localhost with appropriate options', () => {
      const url = validateUrl('http://localhost:11434', {
        requireHttps: false,
        allowPrivate: true,
      });
      expect(url.hostname).toBe('localhost');
    });

    it('rejects invalid URLs', () => {
      expect(() => validateUrl('not-a-url')).toThrow(ScrapeError);
      expect(() => validateUrl('not-a-url')).toThrow('Invalid URL');
    });
  });

  describe('isRetryableError', () => {
    it('considers rate limit errors retryable', () => {
      const error = new ScrapeError('Rate limited', 'BLOCKED', 429);
      expect(isRetryableError(error)).toBe(true);
    });

    it('considers server errors retryable', () => {
      const error500 = new ScrapeError('Server error', 'LLM_ERROR', 500);
      const error502 = new ScrapeError('Bad gateway', 'LLM_ERROR', 502);
      const error503 = new ScrapeError('Unavailable', 'LLM_ERROR', 503);
      const error504 = new ScrapeError('Gateway timeout', 'LLM_ERROR', 504);

      expect(isRetryableError(error500)).toBe(true);
      expect(isRetryableError(error502)).toBe(true);
      expect(isRetryableError(error503)).toBe(true);
      expect(isRetryableError(error504)).toBe(true);
    });

    it('considers timeout errors retryable', () => {
      const error = new ScrapeError('Timeout', 'TIMEOUT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('considers fetch failures retryable', () => {
      const error = new ScrapeError('Connection failed', 'FETCH_FAILED');
      expect(isRetryableError(error)).toBe(true);
    });

    it('does not retry auth errors', () => {
      const error = new ScrapeError('Unauthorized', 'BLOCKED', 401);
      expect(isRetryableError(error)).toBe(false);
    });

    it('does not retry not found errors', () => {
      const error = new ScrapeError('Not found', 'NOT_FOUND', 404);
      expect(isRetryableError(error)).toBe(false);
    });

    it('handles network error codes', () => {
      const econnreset = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
      const etimedout = Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
      const econnrefused = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });

      expect(isRetryableError(econnreset)).toBe(true);
      expect(isRetryableError(etimedout)).toBe(true);
      expect(isRetryableError(econnrefused)).toBe(true);
    });
  });

  describe('withRetry', () => {
    it('succeeds on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const { result, attempts } = await withRetry(fn);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ScrapeError('Error', 'TIMEOUT'))
        .mockResolvedValue('success');

      const { result, attempts } = await withRetry(fn, { maxAttempts: 3, backoffMs: 10 });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after max attempts', async () => {
      const error = new ScrapeError('Error', 'TIMEOUT');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, backoffMs: 10 })).rejects.toThrow('Error');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not retry non-retryable errors', async () => {
      const error = new ScrapeError('Auth failed', 'BLOCKED', 401);
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxAttempts: 3, backoffMs: 10 })).rejects.toThrow('Auth failed');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ScrapeError('Error', 'TIMEOUT'))
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, backoffMs: 10 }, onRetry);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });

  describe('withTimeout', () => {
    it('resolves if function completes in time', async () => {
      const result = await withTimeout(async () => 'success', 1000);
      expect(result).toBe('success');
    });

    it('rejects if function times out', async () => {
      const slowFn = async (signal: AbortSignal) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (signal.aborted) throw new Error('Aborted');
        return 'success';
      };

      await expect(withTimeout(slowFn, 10)).rejects.toThrow();
    });

    it('passes abort signal to function', async () => {
      let receivedSignal: AbortSignal | undefined;

      await withTimeout(async (signal) => {
        receivedSignal = signal;
        return 'success';
      }, 1000);

      expect(receivedSignal).toBeDefined();
      expect(receivedSignal?.aborted).toBe(false);
    });
  });

  describe('createHeaders', () => {
    it('creates basic headers', () => {
      const headers = createHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('adds Authorization header with API key', () => {
      const headers = createHeaders('sk-test-key');
      expect(headers.Authorization).toBe('Bearer sk-test-key');
    });

    it('merges additional headers', () => {
      const headers = createHeaders('sk-key', { 'X-Custom': 'value' });
      expect(headers.Authorization).toBe('Bearer sk-key');
      expect(headers['X-Custom']).toBe('value');
    });
  });
});

describe('common/errors', () => {
  describe('getErrorCodeFromStatus', () => {
    it('maps 401 to BLOCKED', () => {
      expect(getErrorCodeFromStatus(401)).toBe('BLOCKED');
    });

    it('maps 403 to BLOCKED', () => {
      expect(getErrorCodeFromStatus(403)).toBe('BLOCKED');
    });

    it('maps 404 to NOT_FOUND', () => {
      expect(getErrorCodeFromStatus(404)).toBe('NOT_FOUND');
    });

    it('maps 429 to BLOCKED', () => {
      expect(getErrorCodeFromStatus(429)).toBe('BLOCKED');
    });

    it('maps 408 to TIMEOUT', () => {
      expect(getErrorCodeFromStatus(408)).toBe('TIMEOUT');
    });

    it('maps 5xx to LLM_ERROR', () => {
      expect(getErrorCodeFromStatus(500)).toBe('LLM_ERROR');
      expect(getErrorCodeFromStatus(502)).toBe('LLM_ERROR');
      expect(getErrorCodeFromStatus(503)).toBe('LLM_ERROR');
    });

    it('maps other codes to FETCH_FAILED', () => {
      expect(getErrorCodeFromStatus(400)).toBe('FETCH_FAILED');
      expect(getErrorCodeFromStatus(422)).toBe('FETCH_FAILED');
    });
  });

  describe('isRetryableStatus', () => {
    it('identifies retryable status codes', () => {
      expect(isRetryableStatus(408)).toBe(true);
      expect(isRetryableStatus(429)).toBe(true);
      expect(isRetryableStatus(500)).toBe(true);
      expect(isRetryableStatus(502)).toBe(true);
      expect(isRetryableStatus(503)).toBe(true);
      expect(isRetryableStatus(504)).toBe(true);
    });

    it('identifies non-retryable status codes', () => {
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(403)).toBe(false);
      expect(isRetryableStatus(404)).toBe(false);
      expect(isRetryableStatus(422)).toBe(false);
    });
  });
});

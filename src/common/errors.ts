/**
 * Error normalization utilities for HTTP providers.
 * Maps HTTP status codes to consistent ScrapeError codes.
 */

import { ScrapeError, type ScrapeErrorCode } from '../core/errors.js';

/**
 * HTTP status code to ScrapeError code mapping.
 */
export function getErrorCodeFromStatus(status: number): ScrapeErrorCode {
  if (status === 401 || status === 403) {
    return 'BLOCKED';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 429) {
    return 'BLOCKED';
  }
  if (status === 408) {
    return 'TIMEOUT';
  }
  if (status >= 500) {
    return 'LLM_ERROR';
  }
  return 'FETCH_FAILED';
}

/**
 * Retryable HTTP status codes.
 */
export const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
] as const;

/**
 * Check if an HTTP status code is retryable.
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(status as (typeof RETRYABLE_STATUS_CODES)[number]);
}

/**
 * Parse error message from API response body.
 */
export async function parseErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      // Common error formats
      if (typeof json.error === 'object' && json.error !== null) {
        const error = json.error as Record<string, unknown>;
        return String(error.message ?? error.msg ?? JSON.stringify(error));
      }
      if (typeof json.error === 'string') {
        return json.error;
      }
      if (typeof json.message === 'string') {
        return json.message;
      }
      if (typeof json.detail === 'string') {
        return json.detail;
      }
      return text;
    } catch {
      return text || `HTTP ${response.status} ${response.statusText}`;
    }
  } catch {
    return `HTTP ${response.status} ${response.statusText}`;
  }
}

/**
 * Create a ScrapeError from an HTTP response.
 */
export async function createHttpError(
  response: Response,
  providerName: string,
  errorMapper?: (body: unknown) => string
): Promise<ScrapeError> {
  const code = getErrorCodeFromStatus(response.status);

  let message: string;
  if (errorMapper) {
    try {
      const body = await response.json();
      message = errorMapper(body);
    } catch {
      message = await parseErrorBody(response);
    }
  } else {
    message = await parseErrorBody(response);
  }

  return new ScrapeError(
    `${providerName} API error (${response.status}): ${message}`,
    code,
    response.status
  );
}

/**
 * Normalize any error to ScrapeError.
 */
export function normalizeError(
  error: unknown,
  providerName: string,
  defaultCode: ScrapeErrorCode = 'LLM_ERROR'
): ScrapeError {
  if (error instanceof ScrapeError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for abort/timeout
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new ScrapeError(`${providerName} request timed out`, 'TIMEOUT', undefined, error);
    }

    // Check for network errors
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
      return new ScrapeError(
        `${providerName} connection failed: ${error.message}`,
        'FETCH_FAILED',
        undefined,
        error
      );
    }

    return new ScrapeError(
      `${providerName} error: ${error.message}`,
      defaultCode,
      undefined,
      error
    );
  }

  return new ScrapeError(`${providerName} error: ${String(error)}`, defaultCode);
}

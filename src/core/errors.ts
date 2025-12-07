/**
 * Error codes for scraping failures
 */
export type ScrapeErrorCode =
  | 'FETCH_FAILED'
  | 'TIMEOUT'
  | 'INVALID_URL'
  | 'BLOCKED'
  | 'NOT_FOUND'
  | 'ROBOTS_BLOCKED'
  | 'PARSE_ERROR'
  | 'LLM_ERROR'
  | 'VALIDATION_ERROR';

/**
 * Custom error class for scraping failures with structured error codes
 */
export class ScrapeError extends Error {
  public readonly code: ScrapeErrorCode;
  public readonly statusCode?: number;

  constructor(message: string, code: ScrapeErrorCode, statusCode?: number, cause?: Error) {
    super(message, { cause });
    this.name = 'ScrapeError';
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScrapeError);
    }
  }

  /**
   * Create a ScrapeError from an unknown error
   */
  static from(error: unknown, code: ScrapeErrorCode = 'FETCH_FAILED'): ScrapeError {
    if (error instanceof ScrapeError) {
      return error;
    }

    if (error instanceof Error) {
      return new ScrapeError(error.message, code, undefined, error);
    }

    return new ScrapeError(String(error), code);
  }

  /**
   * Check if error is retryable (network issues, timeouts)
   */
  isRetryable(): boolean {
    return this.code === 'FETCH_FAILED' || this.code === 'TIMEOUT';
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
    };
  }
}

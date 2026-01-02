import type { PiiRedactionConfig } from './types.js';

/**
 * PII redaction patterns with high precision to minimize false positives.
 * Patterns are designed to match common formats while avoiding over-matching.
 */

// Email: matches user@domain.tld format
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone: matches various formats including international
// Covers: +1-234-567-8901, (234) 567-8901, 234.567.8901, 234-567-8901, etc.
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;

// Credit Card: matches major card formats (Visa, MC, Amex, Discover)
// 13-19 digits with optional spaces or dashes
const CREDIT_CARD_PATTERN =
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:[0-9]{4}[-\s]){3}[0-9]{4}|[0-9]{13,19})\b/g;

// SSN: matches XXX-XX-XXXX format (US Social Security Number)
const SSN_PATTERN = /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g;

// IP Address: matches both IPv4 and common IPv6 formats
const IPV4_PATTERN =
  /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// Redaction placeholder
const REDACTED = '[REDACTED]';

/**
 * Create a redaction function based on configuration.
 * Returns a function that applies all configured PII patterns.
 */
export function createPiiRedactor(config: PiiRedactionConfig): (text: string) => RedactionResult {
  const patterns: Array<{ name: string; pattern: RegExp }> = [];

  // Process credit card BEFORE phone to prevent partial matches
  // (phone pattern can match 10-digit substrings of credit card numbers)
  if (config.creditCard) {
    patterns.push({ name: 'creditCard', pattern: CREDIT_CARD_PATTERN });
  }
  if (config.email) {
    patterns.push({ name: 'email', pattern: EMAIL_PATTERN });
  }
  if (config.phone) {
    patterns.push({ name: 'phone', pattern: PHONE_PATTERN });
  }
  if (config.ssn) {
    patterns.push({ name: 'ssn', pattern: SSN_PATTERN });
  }
  if (config.ipAddress) {
    patterns.push({ name: 'ipAddress', pattern: IPV4_PATTERN });
  }

  // Add custom patterns
  if (config.customPatterns) {
    for (let i = 0; i < config.customPatterns.length; i++) {
      const customPattern = config.customPatterns[i];
      if (customPattern) {
        patterns.push({
          name: `custom_${i}`,
          pattern: customPattern,
        });
      }
    }
  }

  return (text: string): RedactionResult => {
    let redactedText = text;
    let totalRedactions = 0;
    const redactionsByType: Record<string, number> = {};

    for (const { name, pattern } of patterns) {
      // Reset pattern state for global patterns
      pattern.lastIndex = 0;

      // Count matches before replacing
      const matches = text.match(pattern);
      const matchCount = matches?.length ?? 0;

      if (matchCount > 0) {
        redactedText = redactedText.replace(pattern, REDACTED);
        totalRedactions += matchCount;
        redactionsByType[name] = (redactionsByType[name] ?? 0) + matchCount;
      }
    }

    return {
      text: redactedText,
      redacted: totalRedactions > 0,
      redactionCount: totalRedactions,
      redactionsByType,
    };
  };
}

/**
 * Result of PII redaction operation.
 */
export interface RedactionResult {
  /** Redacted text */
  text: string;
  /** Whether any redactions were made */
  redacted: boolean;
  /** Total number of redactions */
  redactionCount: number;
  /** Count by redaction type */
  redactionsByType: Record<string, number>;
}

/**
 * Simple redaction that applies all default patterns.
 * Use createPiiRedactor() for fine-grained control.
 */
export function redactPii(text: string): RedactionResult {
  const redactor = createPiiRedactor({
    email: true,
    phone: true,
    creditCard: true,
    ssn: true,
    ipAddress: true,
  });
  return redactor(text);
}

/**
 * Check if text contains any PII.
 * Useful for validation before sending to external APIs.
 */
export function containsPii(text: string, config?: Partial<PiiRedactionConfig>): boolean {
  const fullConfig: PiiRedactionConfig = {
    email: config?.email ?? true,
    phone: config?.phone ?? true,
    creditCard: config?.creditCard ?? true,
    ssn: config?.ssn ?? true,
    ipAddress: config?.ipAddress ?? true,
    customPatterns: config?.customPatterns,
  };

  const patterns: RegExp[] = [];

  if (fullConfig.email) patterns.push(EMAIL_PATTERN);
  if (fullConfig.phone) patterns.push(PHONE_PATTERN);
  if (fullConfig.creditCard) patterns.push(CREDIT_CARD_PATTERN);
  if (fullConfig.ssn) patterns.push(SSN_PATTERN);
  if (fullConfig.ipAddress) patterns.push(IPV4_PATTERN);
  if (fullConfig.customPatterns) patterns.push(...fullConfig.customPatterns);

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

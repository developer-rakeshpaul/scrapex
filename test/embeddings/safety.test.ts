import { describe, expect, it } from 'vitest';
import { containsPii, createPiiRedactor, redactPii } from '@/embeddings/safety.js';

describe('PII Safety', () => {
  describe('redactPii', () => {
    it('should redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for more info.';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.text).toBe('Contact me at [REDACTED] for more info.');
      expect(result.redactionCount).toBe(1);
      expect(result.redactionsByType.email).toBe(1);
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at (555) 123-4567 or +1-555-987-6543.';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactionCount).toBe(2);
    });

    it('should redact credit card numbers', () => {
      const text = 'Card: 4111-1111-1111-1111 or 5500000000000004';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.text).not.toContain('4111');
      expect(result.text).not.toContain('5500');
    });

    it('should redact SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.text).toBe('SSN: [REDACTED]');
      expect(result.redactionsByType.ssn).toBe(1);
    });

    it('should redact IP addresses', () => {
      const text = 'Server IP: 192.168.1.1 and 10.0.0.254';
      const result = redactPii(text);

      expect(result.redacted).toBe(true);
      expect(result.text).not.toContain('192.168');
      expect(result.text).not.toContain('10.0.0');
      expect(result.redactionCount).toBe(2);
    });

    it('should not modify text without PII', () => {
      const text = 'This is a normal sentence without any personal information.';
      const result = redactPii(text);

      expect(result.redacted).toBe(false);
      expect(result.text).toBe(text);
      expect(result.redactionCount).toBe(0);
    });
  });

  describe('createPiiRedactor', () => {
    it('should create a redactor with selective patterns', () => {
      const redactor = createPiiRedactor({
        email: true,
        phone: false,
        creditCard: false,
        ssn: false,
        ipAddress: false,
      });

      const text = 'Email: test@example.com, Phone: 555-123-4567';
      const result = redactor(text);

      expect(result.text).toContain('[REDACTED]');
      expect(result.text).toContain('555-123-4567'); // Phone not redacted
      expect(result.redactionsByType.email).toBe(1);
      expect(result.redactionsByType.phone).toBeUndefined();
    });

    it('should support custom patterns', () => {
      const redactor = createPiiRedactor({
        email: false,
        phone: false,
        creditCard: false,
        ssn: false,
        ipAddress: false,
        customPatterns: [/API_KEY_[A-Z0-9]+/g],
      });

      const text = 'My key is API_KEY_ABC123XYZ and another is API_KEY_DEF456.';
      const result = redactor(text);

      expect(result.redacted).toBe(true);
      expect(result.text).not.toContain('API_KEY_ABC123XYZ');
      expect(result.text).not.toContain('API_KEY_DEF456');
      expect(result.redactionCount).toBe(2);
      expect(result.redactionsByType['custom_0']).toBe(2);
    });
  });

  describe('containsPii', () => {
    it('should detect email', () => {
      expect(containsPii('Email: user@test.com')).toBe(true);
    });

    it('should detect phone', () => {
      expect(containsPii('Phone: 555-123-4567')).toBe(true);
    });

    it('should return false for clean text', () => {
      expect(containsPii('Hello, this is a test.')).toBe(false);
    });

    it('should respect selective config', () => {
      expect(containsPii('Email: user@test.com', { email: false })).toBe(false);
    });
  });
});

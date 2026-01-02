import { describe, expect, it } from 'vitest';
import type { ScrapedData } from '@/core/types.js';
import { previewInput, selectInput, validateInput } from '@/embeddings/input.js';

describe('Input Selection', () => {
  const sampleData: Partial<ScrapedData> = {
    title: 'Test Title',
    description: 'Test description',
    textContent: 'This is the main text content of the article.',
    content: '# Heading\n\nThis is **markdown** content.',
    excerpt: 'This is an excerpt...',
    summary: 'This is a summary.',
  };

  describe('selectInput', () => {
    it('should default to textContent', () => {
      const input = selectInput(sampleData);
      expect(input).toBe('This is the main text content of the article.');
    });

    it('should select textContent explicitly', () => {
      const input = selectInput(sampleData, { type: 'textContent' });
      expect(input).toBe('This is the main text content of the article.');
    });

    it('should select title+summary', () => {
      const input = selectInput(sampleData, { type: 'title+summary' });
      expect(input).toContain('Test Title');
      expect(input).toContain('This is a summary.');
    });

    it('should fallback to excerpt when summary is missing', () => {
      const dataWithoutSummary = { ...sampleData, summary: undefined };
      const input = selectInput(dataWithoutSummary, { type: 'title+summary' });
      expect(input).toContain('This is an excerpt...');
    });

    it('should use transform function when provided', () => {
      const input = selectInput(sampleData, {
        transform: (data) => `${data.title} - ${data.description}`,
      });
      expect(input).toBe('Test Title - Test description');
    });

    it('should use customText when type is custom', () => {
      const input = selectInput(sampleData, {
        type: 'custom',
        customText: 'Custom input text',
      });
      expect(input).toBe('Custom input text');
    });

    it('should fallback to content when textContent is missing', () => {
      const dataWithoutText = { ...sampleData, textContent: undefined };
      const input = selectInput(dataWithoutText, { type: 'textContent' });
      // Should strip markdown and return plain text
      expect(input).toContain('Heading');
      expect(input).toContain('markdown content');
    });

    it('should fallback to excerpt when textContent and content are missing', () => {
      const minimalData = { excerpt: 'Just an excerpt' };
      const input = selectInput(minimalData, { type: 'textContent' });
      expect(input).toBe('Just an excerpt');
    });

    it('should return undefined when no input available', () => {
      const input = selectInput({}, { type: 'textContent' });
      expect(input).toBeUndefined();
    });

    it('should normalize whitespace', () => {
      const dataWithBadWhitespace = {
        textContent: 'Hello   world.\n\n\n\n\nNew paragraph.',
      };
      const input = selectInput(dataWithBadWhitespace);
      expect(input).toBe('Hello world.\n\nNew paragraph.');
    });
  });

  describe('validateInput', () => {
    it('should reject undefined input', () => {
      const result = validateInput(undefined);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('No input text available');
      }
    });

    it('should reject short input', () => {
      const result = validateInput('Hi', 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('too short');
      }
    });

    it('should reject input with too few words', () => {
      // Use a long enough string (> 10 chars) but with too few real words
      const result = validateInput('Aaaaaa Bbbbb');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('too few words');
      }
    });

    it('should accept valid input', () => {
      const result = validateInput('This is a valid input text with enough words.');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.wordCount).toBeGreaterThan(3);
        expect(result.charCount).toBeGreaterThan(10);
      }
    });
  });

  describe('previewInput', () => {
    it('should return preview of selected input', () => {
      const preview = previewInput(sampleData, undefined, 20);
      expect(preview).toContain('...');
      expect(preview.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    it('should return full text if shorter than maxLength', () => {
      const shortData = { textContent: 'Short text' };
      const preview = previewInput(shortData, undefined, 100);
      expect(preview).toBe('Short text');
    });

    it('should indicate when no input available', () => {
      const preview = previewInput({});
      expect(preview).toBe('[No input available]');
    });
  });
});

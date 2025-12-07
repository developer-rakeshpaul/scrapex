import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { enhance, extract } from '@/llm/enhancer.js';
import type { LLMProvider } from '@/llm/types.js';
import type { ScrapedData } from '@/core/types.js';

// Mock LLM provider for testing
function createMockProvider(responses: Record<string, unknown>): LLMProvider {
  return {
    name: 'mock',
    complete: vi.fn().mockResolvedValue('mock response'),
    completeJSON: vi.fn().mockImplementation(async (prompt: string) => {
      // Return different responses based on prompt content
      if (prompt.includes('Summarize')) {
        return responses.summary ?? { summary: 'Mock summary' };
      }
      if (prompt.includes('tags or keywords')) {
        return responses.tags ?? { tags: ['mock', 'tags'] };
      }
      if (prompt.includes('named entities')) {
        return (
          responses.entities ?? {
            people: [],
            organizations: [],
            technologies: [],
            locations: [],
            concepts: [],
          }
        );
      }
      if (prompt.includes('Classify')) {
        return responses.classify ?? { contentType: 'article', confidence: 0.9 };
      }
      // Default for extract
      return responses.extract ?? {};
    }),
  };
}

// Sample scraped data for testing
const sampleData: ScrapedData = {
  url: 'https://example.com/article',
  canonicalUrl: 'https://example.com/article',
  domain: 'example.com',
  title: 'Test Article',
  description: 'Test description',
  content: 'This is the main content of the article.',
  textContent: 'This is the main content of the article.',
  excerpt: 'This is the excerpt.',
  wordCount: 100,
  contentType: 'article',
  keywords: [],
  scrapedAt: new Date().toISOString(),
  scrapeTimeMs: 100,
};

describe('enhance', () => {
  it('should return empty object when no types specified', async () => {
    const provider = createMockProvider({});
    const result = await enhance(sampleData, provider, []);
    expect(result).toEqual({});
    expect(provider.completeJSON).not.toHaveBeenCalled();
  });

  describe('summarize', () => {
    it('should add summary when summarize type is specified', async () => {
      const provider = createMockProvider({
        summary: { summary: 'Generated summary of the content.' },
      });

      const result = await enhance(sampleData, provider, ['summarize']);
      expect(result.summary).toBe('Generated summary of the content.');
    });
  });

  describe('tags', () => {
    it('should add suggested tags when tags type is specified', async () => {
      const provider = createMockProvider({
        tags: { tags: ['javascript', 'testing', 'web'] },
      });

      const result = await enhance(sampleData, provider, ['tags']);
      expect(result.suggestedTags).toEqual(['javascript', 'testing', 'web']);
    });
  });

  describe('entities', () => {
    it('should add entities when entities type is specified', async () => {
      const provider = createMockProvider({
        entities: {
          people: ['John Doe'],
          organizations: ['Acme Corp'],
          technologies: ['JavaScript'],
          locations: ['New York'],
          concepts: ['Web Development'],
        },
      });

      const result = await enhance(sampleData, provider, ['entities']);
      expect(result.entities).toMatchObject({
        people: ['John Doe'],
        organizations: ['Acme Corp'],
        technologies: ['JavaScript'],
      });
    });
  });

  describe('classify', () => {
    it('should update contentType when confidence is high', async () => {
      const provider = createMockProvider({
        classify: { contentType: 'docs', confidence: 0.85 },
      });

      const result = await enhance(sampleData, provider, ['classify']);
      expect(result.contentType).toBe('docs');
    });

    it('should not update contentType when confidence is low', async () => {
      const provider = createMockProvider({
        classify: { contentType: 'docs', confidence: 0.5 },
      });

      const result = await enhance(sampleData, provider, ['classify']);
      expect(result.contentType).toBeUndefined();
    });
  });

  describe('multiple enhancements', () => {
    it('should run multiple enhancements in parallel', async () => {
      const provider = createMockProvider({
        summary: { summary: 'Summary' },
        tags: { tags: ['tag1', 'tag2'] },
      });

      const result = await enhance(sampleData, provider, ['summarize', 'tags']);

      expect(result.summary).toBe('Summary');
      expect(result.suggestedTags).toEqual(['tag1', 'tag2']);
      // Should have been called twice (once for each enhancement)
      expect(provider.completeJSON).toHaveBeenCalledTimes(2);
    });
  });

  describe('content preparation', () => {
    it('should use excerpt if available', async () => {
      const provider = createMockProvider({
        summary: { summary: 'Summary' },
      });

      await enhance(sampleData, provider, ['summarize']);

      const call = (provider.completeJSON as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain(sampleData.excerpt);
    });

    it('should fallback to truncated textContent', async () => {
      const dataWithoutExcerpt: ScrapedData = {
        ...sampleData,
        excerpt: '',
        textContent: 'A'.repeat(3000),
      };
      const provider = createMockProvider({
        summary: { summary: 'Summary' },
      });

      await enhance(dataWithoutExcerpt, provider, ['summarize']);

      const call = (provider.completeJSON as ReturnType<typeof vi.fn>).mock.calls[0];
      // Should be truncated to 2000 chars
      expect(call[0].length).toBeLessThan(3000 + 500); // Content + metadata
    });
  });
});

describe('extract', () => {
  it('should extract data using custom schema', async () => {
    const provider = createMockProvider({
      extract: {
        productName: 'Widget',
        price: 29.99,
        inStock: true,
      },
    });

    const schema = {
      productName: 'string',
      price: 'number',
      inStock: 'boolean',
    };

    const result = await extract<{ productName: string; price: number; inStock: boolean }>(
      sampleData,
      provider,
      schema
    );

    expect(result).toEqual({
      productName: 'Widget',
      price: 29.99,
      inStock: true,
    });
  });

  it('should handle optional fields', async () => {
    const provider = createMockProvider({
      extract: {
        name: 'Test',
      },
    });

    const schema = {
      name: 'string',
      optionalField: 'string?',
    };

    const result = await extract<{ name: string; optionalField?: string }>(
      sampleData,
      provider,
      schema
    );

    expect(result.name).toBe('Test');
    expect(result.optionalField).toBeUndefined();
  });

  it('should handle array fields', async () => {
    const provider = createMockProvider({
      extract: {
        tags: ['one', 'two', 'three'],
        scores: [1, 2, 3],
      },
    });

    const schema = {
      tags: 'string[]',
      scores: 'number[]',
    };

    const result = await extract<{ tags: string[]; scores: number[] }>(
      sampleData,
      provider,
      schema
    );

    expect(result.tags).toEqual(['one', 'two', 'three']);
    expect(result.scores).toEqual([1, 2, 3]);
  });

  it('should include URL and title in prompt', async () => {
    const provider = createMockProvider({ extract: { field: 'value' } });

    await extract(sampleData, provider, { field: 'string' });

    const call = (provider.completeJSON as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(sampleData.url);
    expect(call[0]).toContain(sampleData.title);
  });

  it('should truncate long content', async () => {
    const longData: ScrapedData = {
      ...sampleData,
      textContent: 'A'.repeat(10000),
    };
    const provider = createMockProvider({ extract: { field: 'value' } });

    await extract(longData, provider, { field: 'string' });

    const call = (provider.completeJSON as ReturnType<typeof vi.fn>).mock.calls[0];
    // Content should be truncated to 4000 chars
    expect(call[0].includes('A'.repeat(4000))).toBe(true);
    expect(call[0].includes('A'.repeat(5000))).toBe(false);
  });
});

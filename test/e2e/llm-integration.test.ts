/**
 * LLM Integration - Documentation Examples Validation
 *
 * Tests LLM integration examples from:
 * - docs/src/content/docs/index.mdx
 * - docs/src/content/docs/guides/llm-integration.mdx
 * - docs/src/content/docs/api/llm-providers.mdx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scrapeHtml } from '@/index.js';
import { ask } from '@/llm/index.js';
import type { LLMProvider } from '@/llm/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures');
const articleHtml = readFileSync(path.join(fixturesDir, 'article-real-world.html'), 'utf8').replace(
  /\{\{BASE_URL\}\}/g,
  'https://example.com'
);

const mockProvider: LLMProvider = {
  name: 'mock-llm',
  async complete(prompt: string): Promise<string> {
    if (prompt.includes('main argument')) {
      return 'The author argues that robust scraping requires normalization.';
    }
    return 'Mock response.';
  },
  async completeJSON<T>(prompt: string, schema: { parse: (input: unknown) => T }): Promise<T> {
    if (prompt.startsWith('Summarize the following content')) {
      return schema.parse({ summary: 'Mock summary of the article.' });
    }
    if (prompt.startsWith('Extract 5-10 relevant tags')) {
      return schema.parse({ tags: ['scraping', 'normalization', 'automation'] });
    }
    if (prompt.startsWith('Extract named entities')) {
      return schema.parse({
        people: ['Alex Doe'],
        organizations: ['Example Corp'],
        technologies: ['scrapex'],
        locations: ['Remote'],
        concepts: ['web scraping'],
      });
    }
    if (prompt.startsWith('Classify the following content')) {
      return schema.parse({ contentType: 'article', confidence: 0.9 });
    }
    if (prompt.includes('Analyze the sentiment')) {
      return schema.parse({ tone: 'positive', score: 0.8, reasoning: 'Test response.' });
    }

    return schema.parse({ author: 'Alex Doe', topics: ['scraping', 'data'] });
  },
};

describe('LLM Integration (from docs)', () => {
  it('enhances scraped content with summaries, entities, tags, and classification', async () => {
    const result = await scrapeHtml(articleHtml, 'https://example.com/blog/deep-dive', {
      llm: mockProvider,
      enhance: ['summarize', 'entities', 'tags', 'classify'],
      extract: {
        author: 'string',
        topics: 'string[]',
      },
    });

    expect(result.summary).toBe('Mock summary of the article.');
    expect(result.entities?.technologies).toContain('scrapex');
    expect(result.suggestedTags).toContain('scraping');
    expect(result.contentType).toBe('article');
    expect(result.extracted?.author).toBe('Alex Doe');
  });

  it('supports ask() with simple and structured prompts', async () => {
    const data = await scrapeHtml(articleHtml, 'https://example.com/blog/deep-dive');

    const response = await ask(data, mockProvider, 'What is the main argument?', {
      key: 'mainArgument',
    });
    expect(response.custom?.mainArgument).toContain('robust scraping');

    const sentiment = await ask(data, mockProvider, 'Analyze the sentiment', {
      key: 'sentiment',
      schema: { tone: 'string', score: 'number', reasoning: 'string' },
    });
    expect(sentiment.custom?.sentiment).toEqual({
      tone: 'positive',
      score: 0.8,
      reasoning: 'Test response.',
    });
  });
});

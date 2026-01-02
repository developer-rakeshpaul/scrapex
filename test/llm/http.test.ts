import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpLLMProvider, zodToJsonSchema } from '../../src/llm/http.js';
import {
  createAnthropic,
  createGroq,
  createLMStudio,
  createOllama,
  createOpenAI,
  createOpenRouter,
  createTogether,
} from '../../src/llm/presets.js';

describe('llm/http', () => {
  describe('HttpLLMProvider', () => {
    it('creates a provider with required config', () => {
      const provider = new HttpLLMProvider({
        baseUrl: 'https://api.example.com/v1/chat/completions',
        model: 'test-model',
        headers: { Authorization: 'Bearer test-key' },
        // Allow HTTPS requirement check to pass
      });

      expect(provider.name).toBe('http-llm');
    });

    it('rejects HTTP URLs by default', () => {
      expect(
        () =>
          new HttpLLMProvider({
            baseUrl: 'http://api.example.com/v1/chat',
            model: 'test-model',
          })
      ).toThrow('HTTPS required');
    });

    it('allows HTTP for local providers', () => {
      const provider = new HttpLLMProvider({
        baseUrl: 'http://localhost:11434/v1/chat/completions',
        model: 'llama3.2',
        requireHttps: false,
        allowPrivate: true,
      });

      expect(provider.name).toBe('http-llm');
    });
  });

  describe('zodToJsonSchema', () => {
    it('converts ZodObject to JSON Schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toEqual({
        name: { type: 'string' },
        age: { type: 'number' },
      });
      expect(jsonSchema.required).toEqual(['name', 'age']);
    });

    it('converts ZodArray to JSON Schema', () => {
      const schema = z.array(z.string());

      const jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;

      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.items).toEqual({ type: 'string' });
    });

    it('converts ZodEnum to JSON Schema', () => {
      const schema = z.enum(['a', 'b', 'c']);

      const jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;

      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.enum).toEqual(['a', 'b', 'c']);
    });

    it('handles optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const jsonSchema = zodToJsonSchema(schema) as {
        required: string[];
        properties: Record<string, unknown>;
      };

      expect(jsonSchema.required).toContain('required');
      expect(jsonSchema.required).not.toContain('optional');
    });

    it('converts nested objects', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
        }),
      });

      const jsonSchema = zodToJsonSchema(schema) as {
        properties: Record<
          string,
          { type: string; properties: Record<string, unknown>; required: string[] }
        >;
      };

      expect(jsonSchema.properties.user.type).toBe('object');
      expect(jsonSchema.properties.user.properties).toEqual({
        name: { type: 'string' },
      });
      expect(jsonSchema.properties.user.required).toEqual(['name']);
    });
  });
});

describe('llm/presets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createOpenAI', () => {
    it('throws without API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => createOpenAI()).toThrow('OpenAI API key required');
    });

    it('uses env var if no apiKey provided', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const provider = createOpenAI();
      expect(provider.name).toBe('http-llm');
    });

    it('uses provided apiKey', () => {
      delete process.env.OPENAI_API_KEY;
      const provider = createOpenAI({ apiKey: 'sk-test-key' });
      expect(provider.name).toBe('http-llm');
    });

    it('accepts custom model', () => {
      const provider = createOpenAI({
        apiKey: 'sk-test',
        model: 'gpt-4-turbo',
      });
      expect(provider.name).toBe('http-llm');
    });

    it('accepts custom baseUrl', () => {
      const provider = createOpenAI({
        apiKey: 'sk-test',
        baseUrl: 'https://custom.openai.com/v1/chat/completions',
      });
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createAnthropic', () => {
    it('throws without API key', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => createAnthropic()).toThrow('Anthropic API key required');
    });

    it('uses env var if no apiKey provided', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const provider = createAnthropic();
      expect(provider.name).toBe('http-llm');
    });

    it('accepts custom model', () => {
      const provider = createAnthropic({
        apiKey: 'sk-ant-test',
        model: 'claude-3-opus-20240229',
      });
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createGroq', () => {
    it('throws without API key', () => {
      delete process.env.GROQ_API_KEY;
      expect(() => createGroq()).toThrow('Groq API key required');
    });

    it('uses env var if no apiKey provided', () => {
      process.env.GROQ_API_KEY = 'gsk-test';
      const provider = createGroq();
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createOllama', () => {
    it('creates provider for local Ollama', () => {
      const provider = createOllama({ model: 'llama3.2' });
      expect(provider.name).toBe('http-llm');
    });

    it('accepts custom baseUrl', () => {
      const provider = createOllama({
        model: 'mistral',
        baseUrl: 'http://192.168.1.100:11434/v1/chat/completions',
      });
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createLMStudio', () => {
    it('creates provider for local LM Studio', () => {
      const provider = createLMStudio({ model: 'local-model' });
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createTogether', () => {
    it('throws without API key', () => {
      delete process.env.TOGETHER_API_KEY;
      expect(() => createTogether()).toThrow('Together API key required');
    });

    it('uses env var if no apiKey provided', () => {
      process.env.TOGETHER_API_KEY = 'tog-test';
      const provider = createTogether();
      expect(provider.name).toBe('http-llm');
    });
  });

  describe('createOpenRouter', () => {
    it('throws without API key', () => {
      delete process.env.OPENROUTER_API_KEY;
      expect(() => createOpenRouter({ model: 'anthropic/claude-3.5-sonnet' })).toThrow(
        'OpenRouter API key required'
      );
    });

    it('uses env var if no apiKey provided', () => {
      process.env.OPENROUTER_API_KEY = 'or-test';
      const provider = createOpenRouter({ model: 'anthropic/claude-3.5-sonnet' });
      expect(provider.name).toBe('http-llm');
    });
  });
});

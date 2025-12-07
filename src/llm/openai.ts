import type { z } from 'zod';
import { ScrapeError } from '@/core/errors.js';
import type { CompletionOptions, LLMProvider, OpenAICompatibleConfig } from './types.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI-compatible provider
 *
 * Works with:
 * - OpenAI API
 * - Ollama (http://localhost:11434/v1)
 * - LM Studio (http://localhost:1234/v1)
 * - LocalAI
 * - vLLM
 * - Any OpenAI-compatible API
 *
 * Requires `openai` as a peer dependency.
 *
 * @example
 * ```ts
 * // OpenAI
 * const provider = new OpenAIProvider({ apiKey: 'sk-...' });
 *
 * // Ollama
 * const provider = new OpenAIProvider({
 *   baseUrl: 'http://localhost:11434/v1',
 *   model: 'llama3.2',
 *   apiKey: 'ollama' // Ollama doesn't require a real key
 * });
 *
 * // LM Studio
 * const provider = new OpenAIProvider({
 *   baseUrl: 'http://localhost:1234/v1',
 *   model: 'local-model',
 *   apiKey: 'lm-studio'
 * });
 * ```
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: unknown;
  private model: string;

  constructor(config: OpenAICompatibleConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

    // Only require API key for OpenAI (not for local providers)
    if (!apiKey && baseUrl === DEFAULT_BASE_URL) {
      throw new ScrapeError(
        'OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey in config.',
        'LLM_ERROR'
      );
    }

    this.model = config.model ?? DEFAULT_MODEL;

    // Dynamic import to avoid requiring the SDK if not used
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OpenAI } = require('openai') as typeof import('openai');
      this.client = new OpenAI({
        apiKey: apiKey ?? 'local', // Use 'local' as placeholder for local providers
        baseURL: baseUrl,
      });
    } catch {
      throw new ScrapeError(
        'openai package is required for OpenAI provider. Install with: npm install openai',
        'LLM_ERROR'
      );
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    try {
      const client = this.client as import('openai').OpenAI;
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
        temperature: options.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ScrapeError('Empty response from OpenAI', 'LLM_ERROR');
      }

      return content;
    } catch (error) {
      if (error instanceof ScrapeError) throw error;
      throw new ScrapeError(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
        'LLM_ERROR',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  async completeJSON<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    const client = this.client as import('openai').OpenAI;

    try {
      // Use JSON mode for structured outputs
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        {
          role: 'system',
          content:
            options.systemPrompt ??
            'You are a helpful assistant that extracts information from content.',
        },
        { role: 'user', content: prompt },
      ];

      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
        temperature: options.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ScrapeError('Empty response from OpenAI', 'LLM_ERROR');
      }

      const parsed = JSON.parse(content);
      return schema.parse(parsed);
    } catch (error) {
      // Fallback to regular completion with JSON instruction
      if (error instanceof ScrapeError) throw error;

      // If structured output failed, try regular completion
      const jsonPrompt = `${prompt}

Respond ONLY with valid JSON matching this schema:
${JSON.stringify(zodToJsonSchema(schema), null, 2)}

Do not include any explanation or markdown formatting. Just the JSON object.`;

      const response = await this.complete(jsonPrompt, {
        ...options,
        systemPrompt: 'You respond only with valid JSON.',
      });

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return schema.parse(parsed);
      } catch (parseError) {
        throw new ScrapeError(
          `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          'VALIDATION_ERROR',
          undefined,
          parseError instanceof Error ? parseError : undefined
        );
      }
    }
  }
}

/**
 * Convert a Zod schema to JSON Schema for structured outputs
 */
function zodToJsonSchema(schema: z.ZodType<unknown>): object {
  const def = (schema as z.ZodType<unknown> & { _def: { typeName: string } })._def;

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, object> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodType<unknown>);
        // Assume all fields are required unless wrapped in ZodOptional
        const valueDef = (value as z.ZodType<unknown> & { _def: { typeName: string } })._def;
        if (valueDef.typeName !== 'ZodOptional') {
          required.push(key);
        }
      }
      return { type: 'object', properties, required };
    }
    case 'ZodArray': {
      const arrayDef = def as unknown as { type: z.ZodType<unknown> };
      return { type: 'array', items: zodToJsonSchema(arrayDef.type) };
    }
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum': {
      const enumDef = def as unknown as { values: string[] };
      return { type: 'string', enum: enumDef.values };
    }
    case 'ZodOptional': {
      const optionalDef = def as unknown as { innerType: z.ZodType<unknown> };
      return zodToJsonSchema(optionalDef.innerType);
    }
    default:
      return { type: 'string' };
  }
}

// Convenience factory functions

/**
 * Create an OpenAI provider with default settings
 */
export function createOpenAI(config?: OpenAICompatibleConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}

/**
 * Create an Ollama provider
 *
 * @example
 * ```ts
 * const provider = createOllama({ model: 'llama3.2' });
 * ```
 */
export function createOllama(
  config: { model: string; port?: number } = { model: 'llama3.2' }
): OpenAIProvider {
  return new OpenAIProvider({
    baseUrl: `http://localhost:${config.port ?? 11434}/v1`,
    model: config.model,
    apiKey: 'ollama',
  });
}

/**
 * Create an LM Studio provider
 *
 * @example
 * ```ts
 * const provider = createLMStudio({ model: 'local-model' });
 * ```
 */
export function createLMStudio(
  config: { model: string; port?: number } = { model: 'local-model' }
): OpenAIProvider {
  return new OpenAIProvider({
    baseUrl: `http://localhost:${config.port ?? 1234}/v1`,
    model: config.model,
    apiKey: 'lm-studio',
  });
}

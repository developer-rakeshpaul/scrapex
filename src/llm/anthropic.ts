import type { z } from 'zod';
import { ScrapeError } from '@/core/errors.js';
import type { AnthropicConfig, CompletionOptions, LLMProvider } from './types.js';

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Anthropic Claude provider
 *
 * Requires @anthropic-ai/sdk as a peer dependency.
 *
 * @example
 * ```ts
 * const provider = new AnthropicProvider({ apiKey: 'sk-...' });
 * const result = await scrape(url, { llm: provider, enhance: ['summarize'] });
 * ```
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: unknown;
  private model: string;

  constructor(config: AnthropicConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ScrapeError(
        'Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass apiKey in config.',
        'LLM_ERROR'
      );
    }

    this.model = config.model ?? DEFAULT_MODEL;

    // Dynamic import to avoid requiring the SDK if not used
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Anthropic } = require('@anthropic-ai/sdk') as typeof import('@anthropic-ai/sdk');
      this.client = new Anthropic({
        apiKey,
        baseURL: config.baseUrl,
      });
    } catch {
      throw new ScrapeError(
        '@anthropic-ai/sdk is required for Anthropic provider. Install with: npm install @anthropic-ai/sdk',
        'LLM_ERROR'
      );
    }
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    try {
      const client = this.client as import('@anthropic-ai/sdk').Anthropic;
      const response = await client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        system: options.systemPrompt,
        temperature: options.temperature,
      });

      const content = response.content[0];
      if (content?.type === 'text' && content.text) {
        return content.text;
      }

      throw new ScrapeError('Unexpected or empty response from Anthropic', 'LLM_ERROR');
    } catch (error) {
      if (error instanceof ScrapeError) throw error;
      throw new ScrapeError(
        `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`,
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
    const jsonPrompt = `${prompt}

Respond ONLY with valid JSON matching this schema:
${JSON.stringify(zodToJsonSchema(schema), null, 2)}

Do not include any explanation or markdown formatting. Just the JSON object.`;

    const response = await this.complete(jsonPrompt, {
      ...options,
      systemPrompt:
        options.systemPrompt ?? 'You are a helpful assistant that responds only with valid JSON.',
    });

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return schema.parse(parsed);
    } catch (error) {
      throw new ScrapeError(
        `Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_ERROR',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Convert a Zod schema to a simple JSON Schema representation
 * (simplified version for prompt engineering)
 */
function zodToJsonSchema(schema: z.ZodType<unknown>): object {
  const def = (schema as z.ZodType<unknown> & { _def: { typeName: string } })._def;

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, object> = {};
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodType<unknown>);
      }
      return { type: 'object', properties };
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
    default:
      return { type: 'string' };
  }
}

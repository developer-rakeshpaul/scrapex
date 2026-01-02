/**
 * HTTP-based LLM Provider using native fetch.
 * Provides a unified interface for any REST-based LLM API.
 */

import type { z } from 'zod';
import { type BaseHttpConfig, BaseHttpProvider } from '../common/http-base.js';
import { ScrapeError } from '../core/errors.js';
import type { CompletionOptions, LLMProvider } from './types.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * HTTP LLM provider configuration.
 */
export interface HttpLLMConfig<TRequest = unknown, TResponse = unknown, TError = unknown>
  extends BaseHttpConfig<TError> {
  /**
   * Build request body from prompt and options.
   * @default OpenAI-compatible format with messages array
   */
  requestBuilder?: (prompt: string, options: CompletionOptions) => TRequest;
  /**
   * Extract completion text from response.
   * @default (res) => res.choices[0].message.content
   */
  responseMapper?: (response: TResponse) => string;
  /**
   * Enable JSON mode - adds response_format to request.
   * For OpenAI-compatible APIs, this adds { response_format: { type: "json_object" } }
   */
  jsonMode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// HTTP LLM Provider
// ─────────────────────────────────────────────────────────────

/**
 * HTTP-based LLM provider.
 * Works with any REST API using native fetch.
 */
export class HttpLLMProvider<TRequest = unknown, TResponse = unknown, TError = unknown>
  extends BaseHttpProvider
  implements LLMProvider
{
  readonly name: string;

  private readonly requestBuilder: (prompt: string, options: CompletionOptions) => TRequest;
  private readonly responseMapper: (response: TResponse) => string;
  private readonly jsonMode: boolean;

  constructor(config: HttpLLMConfig<TRequest, TResponse, TError>) {
    super(config as unknown as BaseHttpConfig);
    this.name = 'http-llm';
    this.jsonMode = config.jsonMode ?? false;

    // Default request builder: OpenAI-compatible format
    this.requestBuilder =
      config.requestBuilder ??
      ((prompt: string, opts: CompletionOptions) => {
        const messages: Array<{ role: string; content: string }> = [];

        if (opts.systemPrompt) {
          messages.push({ role: 'system', content: opts.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const request: Record<string, unknown> = {
          model: this.model,
          messages,
        };

        if (opts.temperature !== undefined) {
          request.temperature = opts.temperature;
        }
        if (opts.maxTokens !== undefined) {
          request.max_tokens = opts.maxTokens;
        }

        return request as TRequest;
      });

    // Default response mapper: OpenAI-compatible format
    this.responseMapper =
      config.responseMapper ??
      ((response: TResponse) => {
        const resp = response as Record<string, unknown>;

        // OpenAI format: { choices: [{ message: { content: "..." } }] }
        if (Array.isArray(resp.choices) && resp.choices.length > 0) {
          const choice = resp.choices[0] as { message?: { content?: string } };
          if (choice.message?.content) {
            return choice.message.content;
          }
        }

        // Anthropic format: { content: [{ type: "text", text: "..." }] }
        if (Array.isArray(resp.content)) {
          const textBlock = resp.content.find((c: { type?: string }) => c.type === 'text') as
            | { text?: string }
            | undefined;
          if (textBlock?.text) {
            return textBlock.text;
          }
        }

        throw new ScrapeError(
          'Unable to parse LLM response. Provide a custom responseMapper.',
          'VALIDATION_ERROR'
        );
      });
  }

  /**
   * Generate a text completion.
   */
  async complete(prompt: string, options: CompletionOptions = {}): Promise<string> {
    let body = this.requestBuilder(prompt, options);

    // Add JSON mode if enabled
    if (this.jsonMode && typeof body === 'object' && body !== null) {
      body = {
        ...body,
        response_format: { type: 'json_object' },
      } as TRequest;
    }

    const { data } = await this.fetch<TResponse>(this.baseUrl, { body });

    const content = this.responseMapper(data);
    if (!content) {
      throw new ScrapeError('Empty response from LLM', 'LLM_ERROR');
    }

    return content;
  }

  /**
   * Generate a structured JSON completion with Zod validation.
   */
  async completeJSON<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: CompletionOptions = {}
  ): Promise<T> {
    // Build a prompt that requests JSON output
    const jsonPrompt = `${prompt}

Respond ONLY with valid JSON matching this schema:
${JSON.stringify(zodToJsonSchema(schema), null, 2)}

Do not include any explanation or markdown formatting. Just the JSON object.`;

    // Use JSON mode if available
    const useJsonMode = this.jsonMode;
    let body = this.requestBuilder(jsonPrompt, {
      ...options,
      systemPrompt:
        options.systemPrompt ?? 'You are a helpful assistant that responds only with valid JSON.',
    });

    if (useJsonMode && typeof body === 'object' && body !== null) {
      body = {
        ...body,
        response_format: { type: 'json_object' },
      } as TRequest;
    }

    const { data } = await this.fetch<TResponse>(this.baseUrl, { body });
    const content = this.responseMapper(data);

    if (!content) {
      throw new ScrapeError('Empty response from LLM', 'LLM_ERROR');
    }

    try {
      // Try to extract JSON from response (in case of markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
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

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Convert a Zod schema to a JSON Schema representation.
 * Uses Zod's built-in toJSONSchema method (Zod 4+).
 * Used for prompting LLMs to return structured data.
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): object {
  // Zod 4+ has built-in toJSONSchema method
  if (typeof (schema as unknown as { toJSONSchema: () => object }).toJSONSchema === 'function') {
    const jsonSchema = (schema as unknown as { toJSONSchema: () => object }).toJSONSchema();
    // Remove $schema key as it's not needed for LLM prompting
    const { $schema, ...rest } = jsonSchema as { $schema?: string; [key: string]: unknown };
    return rest;
  }

  // Fallback for older Zod versions using _def.type
  const def = (schema as z.ZodType<unknown> & { _def: { type: string } })._def;
  const type = def.type;

  switch (type) {
    case 'object': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, object> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodType<unknown>);
        const valueDef = (value as z.ZodType<unknown> & { _def: { type: string } })._def;
        if (valueDef.type !== 'optional') {
          required.push(key);
        }
      }
      return { type: 'object', properties, required };
    }
    case 'array': {
      const arrayDef = def as unknown as { element: z.ZodType<unknown> };
      return { type: 'array', items: zodToJsonSchema(arrayDef.element) };
    }
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'enum': {
      const enumDef = def as unknown as { entries: Record<string, string> };
      return { type: 'string', enum: Object.values(enumDef.entries) };
    }
    case 'optional': {
      const optionalDef = def as unknown as { innerType: z.ZodType<unknown> };
      return zodToJsonSchema(optionalDef.innerType);
    }
    default:
      return { type: 'string' };
  }
}

// Re-export types for convenience
export type { z as ZodType } from 'zod';

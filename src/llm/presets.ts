/**
 * Preset factory functions for common LLM providers.
 * All presets use the HttpLLMProvider with appropriate configuration.
 */

import { type HttpLLMConfig, HttpLLMProvider } from './http.js';
import type { LLMProvider } from './types.js';

// ─────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────

/**
 * Create an OpenAI LLM provider.
 *
 * @example
 * ```ts
 * const provider = createOpenAI({ apiKey: 'sk-...' });
 * const result = await scrape(url, { llm: provider, enhance: ['summarize'] });
 * ```
 */
export function createOpenAI(options?: {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): LLMProvider {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey option.');
  }

  return new HttpLLMProvider({
    baseUrl: options?.baseUrl ?? 'https://api.openai.com/v1/chat/completions',
    model: options?.model ?? 'gpt-4o-mini',
    headers: { Authorization: `Bearer ${apiKey}` },
    jsonMode: true,
  });
}

// ─────────────────────────────────────────────────────────────
// Anthropic
// ─────────────────────────────────────────────────────────────

/**
 * Anthropic API response shape.
 */
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Create an Anthropic Claude LLM provider.
 *
 * @example
 * ```ts
 * const provider = createAnthropic({ apiKey: 'sk-...' });
 * const result = await scrape(url, { llm: provider, enhance: ['summarize'] });
 * ```
 */
export function createAnthropic(options?: { apiKey?: string; model?: string }): LLMProvider {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass apiKey option.'
    );
  }

  const model = options?.model ?? 'claude-3-5-haiku-20241022';

  return new HttpLLMProvider<unknown, AnthropicResponse>({
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    requestBuilder: (prompt, opts) => ({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [{ role: 'user', content: prompt }],
      ...(opts.systemPrompt && { system: opts.systemPrompt }),
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    }),
    responseMapper: (res) => res.content.find((item) => item.type === 'text')?.text ?? '',
  });
}

// ─────────────────────────────────────────────────────────────
// Groq
// ─────────────────────────────────────────────────────────────

/**
 * Create a Groq LLM provider.
 * Groq provides fast inference for open-source models.
 *
 * @example
 * ```ts
 * const provider = createGroq({ model: 'llama-3.1-70b-versatile' });
 * ```
 */
export function createGroq(options?: { apiKey?: string; model?: string }): LLMProvider {
  const apiKey = options?.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key required. Set GROQ_API_KEY env var or pass apiKey option.');
  }

  return new HttpLLMProvider({
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: options?.model ?? 'llama-3.1-70b-versatile',
    headers: { Authorization: `Bearer ${apiKey}` },
    jsonMode: true,
  });
}

// ─────────────────────────────────────────────────────────────
// Ollama (Local)
// ─────────────────────────────────────────────────────────────

/**
 * Create an Ollama LLM provider for local models.
 *
 * @example
 * ```ts
 * const provider = createOllama({ model: 'llama3.2' });
 * ```
 */
export function createOllama(options: { model: string; baseUrl?: string }): LLMProvider {
  return new HttpLLMProvider({
    baseUrl: options.baseUrl ?? 'http://localhost:11434/v1/chat/completions',
    model: options.model,
    requireHttps: false,
    allowPrivate: true,
  });
}

// ─────────────────────────────────────────────────────────────
// LM Studio (Local)
// ─────────────────────────────────────────────────────────────

/**
 * Create an LM Studio LLM provider for local models.
 *
 * @example
 * ```ts
 * const provider = createLMStudio({ model: 'local-model' });
 * ```
 */
export function createLMStudio(options: { model: string; baseUrl?: string }): LLMProvider {
  return new HttpLLMProvider({
    baseUrl: options.baseUrl ?? 'http://localhost:1234/v1/chat/completions',
    model: options.model,
    requireHttps: false,
    allowPrivate: true,
  });
}

// ─────────────────────────────────────────────────────────────
// Together AI
// ─────────────────────────────────────────────────────────────

/**
 * Create a Together AI LLM provider.
 *
 * @example
 * ```ts
 * const provider = createTogether({ model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo' });
 * ```
 */
export function createTogether(options?: { apiKey?: string; model?: string }): LLMProvider {
  const apiKey = options?.apiKey ?? process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Together API key required. Set TOGETHER_API_KEY env var or pass apiKey option.'
    );
  }

  return new HttpLLMProvider({
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    model: options?.model ?? 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    headers: { Authorization: `Bearer ${apiKey}` },
    jsonMode: true,
  });
}

// ─────────────────────────────────────────────────────────────
// OpenRouter
// ─────────────────────────────────────────────────────────────

/**
 * Create an OpenRouter LLM provider.
 * OpenRouter provides access to many models through a unified API.
 *
 * @example
 * ```ts
 * const provider = createOpenRouter({
 *   model: 'anthropic/claude-3.5-sonnet',
 * });
 * ```
 */
export function createOpenRouter(options: {
  apiKey?: string;
  model: string;
  siteUrl?: string;
  siteName?: string;
}): LLMProvider {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key required. Set OPENROUTER_API_KEY env var or pass apiKey option.'
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  if (options.siteUrl) {
    headers['HTTP-Referer'] = options.siteUrl;
  }
  if (options.siteName) {
    headers['X-Title'] = options.siteName;
  }

  return new HttpLLMProvider({
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: options.model,
    headers,
  });
}

// ─────────────────────────────────────────────────────────────
// Generic HTTP Provider
// ─────────────────────────────────────────────────────────────

/**
 * Create a generic HTTP LLM provider.
 * Use this for any OpenAI-compatible API.
 *
 * @example
 * ```ts
 * const provider = createHttpLLM({
 *   baseUrl: 'https://my-api.com/v1/chat/completions',
 *   model: 'my-model',
 *   headers: { Authorization: 'Bearer ...' },
 * });
 * ```
 */
export function createHttpLLM<TRequest = unknown, TResponse = unknown, TError = unknown>(
  config: HttpLLMConfig<TRequest, TResponse, TError>
): LLMProvider {
  return new HttpLLMProvider(config);
}

/**
 * LLM module for scrapex.
 *
 * Provides LLM integration with support for multiple providers:
 * - OpenAI (GPT-4, GPT-4o-mini, etc.)
 * - Anthropic (Claude)
 * - Groq (Llama, Mixtral)
 * - Ollama (local models)
 * - LM Studio (local models)
 * - Together AI
 * - OpenRouter
 * - Any OpenAI-compatible API
 *
 * @example Using preset factory functions
 * ```ts
 * import { createOpenAI, createAnthropic } from 'scrapex/llm';
 *
 * const openai = createOpenAI({ apiKey: 'sk-...' });
 * const anthropic = createAnthropic({ apiKey: 'sk-...' });
 *
 * const result = await scrape(url, {
 *   llm: openai,
 *   enhance: ['summarize'],
 * });
 * ```
 */

export type { AskOptions } from './enhancer.js';
// Enhancers
export { ask, enhance, extract } from './enhancer.js';
export type { HttpLLMConfig } from './http.js';
// HTTP Provider (provider-agnostic implementation)
export { HttpLLMProvider, zodToJsonSchema } from './http.js';

// Preset factory functions
export {
  createAnthropic,
  createGroq,
  createHttpLLM,
  createLMStudio,
  createOllama,
  createOpenAI,
  createOpenRouter,
  createTogether,
} from './presets.js';
// Types
export type {
  ClassifyResult,
  CompletionOptions,
  EntitiesResult,
  LLMProvider,
  SummaryResult,
  TagsResult,
} from './types.js';
// Zod schemas
export {
  ClassifySchema,
  EntitiesSchema,
  SummarySchema,
  TagsSchema,
} from './types.js';
